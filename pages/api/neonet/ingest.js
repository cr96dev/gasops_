// pages/api/neonet/ingest.js
//
// Recibe un PDF de estado de cuenta Neonet en base64 desde el Apps Script,
// lo parsea, resuelve afiliacion -> estacion + variante, y aplica el cobro
// a la columna apropiada (ventas.neonet o ventas.neolink), con auditoria.
//
// Seguridad: HMAC-SHA256 del body con NEONET_HMAC_SECRET.
// Idempotencia: email_message_id es UNIQUE en neonet_consumos.

import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/qbo/supabaseAdmin'

// Disable body parser para poder leer raw body y verificar HMAC
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb'  // PDFs Neonet son pequeños, pero margen amplio
    }
  }
}

const NOTIFY_EMAIL = 'adoffice569@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── 1. Validar HMAC ──────────────────────────────────────────
  const secret = process.env.NEONET_HMAC_SECRET
  if (!secret) {
    console.error('[neonet/ingest] NEONET_HMAC_SECRET no configurado en env')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const sigHeader = req.headers['x-hmac-signature']
  if (!sigHeader) {
    return res.status(401).json({ error: 'Missing X-HMAC-Signature' })
  }

  const rawBody = JSON.stringify(req.body)
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expectedSig))) {
    return res.status(401).json({ error: 'Invalid HMAC signature' })
  }

  // ── 2. Validar payload ───────────────────────────────────────
  const {
    afiliacion_codigo,
    email_message_id,
    email_date,
    pdf_base64,
    pdf_filename
  } = req.body

  if (!afiliacion_codigo || !email_message_id || !pdf_base64) {
    return res.status(400).json({
      error: 'Faltan campos requeridos: afiliacion_codigo, email_message_id, pdf_base64'
    })
  }

  // ── 3. Idempotencia: ya procesamos este email? ───────────────
  const { data: existente } = await supabaseAdmin
    .from('neonet_consumos')
    .select('id, estado')
    .eq('email_message_id', email_message_id)
    .maybeSingle()

  if (existente && existente.estado === 'aplicado') {
    return res.status(200).json({
      success: true,
      ya_procesado: true,
      consumo_id: existente.id
    })
  }

  // ── 4. Parsear PDF ───────────────────────────────────────────
  let parsedPdf
  try {
    parsedPdf = await parsearPdfNeonet(pdf_base64)
  } catch (err) {
    console.error('[neonet/ingest] Error parseando PDF', err)
    await supabaseAdmin.from('neonet_consumos').insert({
      afiliacion_codigo,
      fecha_consumo: email_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      total_q: 0,
      email_message_id,
      pdf_filename,
      estado: 'fallido',
      error_msg: `PDF parse error: ${err.message}`
    })
    return res.status(422).json({ error: 'No se pudo parsear el PDF', detalle: err.message })
  }

  const { fecha_consumo, total_q, detalle } = parsedPdf

  // ── 5. Resolver afiliacion -> estacion + variante ────────────
  const { data: afiliacion } = await supabaseAdmin
    .from('neonet_afiliaciones')
    .select('estacion_id, variante, activo')
    .eq('afiliacion_codigo', afiliacion_codigo)
    .maybeSingle()

  if (!afiliacion) {
    // Afiliacion desconocida: registrar y notificar
    await supabaseAdmin.from('neonet_consumos').insert({
      afiliacion_codigo,
      fecha_consumo,
      total_q,
      detalle_json: detalle,
      email_message_id,
      pdf_filename,
      estado: 'fallido',
      error_msg: 'Afiliacion no registrada en neonet_afiliaciones'
    })
    await notificarAfiliacionDesconocida(afiliacion_codigo, email_message_id, pdf_filename, total_q)
    return res.status(200).json({
      success: false,
      motivo: 'afiliacion_desconocida',
      afiliacion_codigo
    })
  }

  if (!afiliacion.activo) {
    return res.status(200).json({
      success: false,
      motivo: 'afiliacion_inactiva',
      afiliacion_codigo
    })
  }

  const { estacion_id, variante } = afiliacion
  const columna = variante === 'neolink' ? 'neolink' : 'neonet'

  // ── 6. Buscar fila ventas para esa fecha+estacion ────────────
  const { data: ventaRow } = await supabaseAdmin
    .from('ventas')
    .select(`id, ${columna}`)
    .eq('fecha', fecha_consumo)
    .eq('estacion_id', estacion_id)
    .maybeSingle()

  const valorAnterior = ventaRow ? parseFloat(ventaRow[columna] || 0) : null
  const valorNuevo = total_q
  const diferencia = valorAnterior !== null ? valorNuevo - valorAnterior : null

  if (!ventaRow) {
    // No existe fila ventas todavia. Dejar pendiente_destino.
    await supabaseAdmin.from('neonet_consumos').insert({
      afiliacion_codigo,
      fecha_consumo,
      total_q,
      detalle_json: detalle,
      email_message_id,
      pdf_filename,
      estacion_id,
      variante,
      estado: 'sin_venta_destino',
      error_msg: 'Fila ventas para esa fecha/estacion no existe aun'
    })
    return res.status(200).json({
      success: true,
      motivo: 'sin_venta_destino_aun',
      total_q,
      fecha_consumo
    })
  }

  // ── 7. Aplicar update + audit en una transaccion logica ──────
  const { error: errUpdate } = await supabaseAdmin
    .from('ventas')
    .update({ [columna]: valorNuevo, qbo_processed: false, qbo_processed_prod: false })
    .eq('id', ventaRow.id)

  if (errUpdate) {
    await supabaseAdmin.from('neonet_consumos').insert({
      afiliacion_codigo,
      fecha_consumo,
      total_q,
      detalle_json: detalle,
      email_message_id,
      pdf_filename,
      estacion_id,
      variante,
      valor_anterior: valorAnterior,
      valor_nuevo: valorNuevo,
      diferencia,
      estado: 'fallido',
      error_msg: `Update ventas falló: ${errUpdate.message}`
    })
    return res.status(500).json({ error: 'Update falló', detalle: errUpdate.message })
  }

  await supabaseAdmin.from('neonet_consumos').insert({
    afiliacion_codigo,
    fecha_consumo,
    total_q,
    detalle_json: detalle,
    email_message_id,
    pdf_filename,
    estacion_id,
    variante,
    aplicado_a_tabla: 'ventas',
    aplicado_a_id: ventaRow.id,
    valor_anterior: valorAnterior,
    valor_nuevo: valorNuevo,
    diferencia,
    estado: 'aplicado'
  })

  return res.status(200).json({
    success: true,
    afiliacion_codigo,
    estacion_id,
    variante,
    fecha_consumo,
    total_q,
    valor_anterior: valorAnterior,
    diferencia
  })
}

// ─── Parser PDF ─────────────────────────────────────────────────
// Estado de cuenta Neonet trae listado de transacciones y total al final.
// Pattern observado: "TOTAL ... Q1,234.56" o similar.
// pdf-parse devuelve texto plano; aplicamos regex sobre el texto.
async function parsearPdfNeonet(base64) {
  const pdfParse = (await import('pdf-parse')).default
  const buffer = Buffer.from(base64, 'base64')
  const data = await pdfParse(buffer)
  const text = data.text

  // Total: buscar último "TOTAL" + monto, o suma de transacciones
  // Patron flexible — afinar despues con muestras reales
  const totalMatch = text.match(/TOTAL[\s:]*Q?\s*([\d,]+\.\d{2})/i)
  if (!totalMatch) {
    throw new Error('No se encontró TOTAL en el PDF')
  }
  const total_q = parseFloat(totalMatch[1].replace(/,/g, ''))

  // Fecha consumo: buscar fecha al inicio del estado, formato DD/MM/YYYY o YYYY-MM-DD
  // Asumimos que el PDF cubre 1 dia (el dia anterior al envio)
  let fecha_consumo = null
  const fechaMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (fechaMatch) {
    const [, dd, mm, yyyy] = fechaMatch
    fecha_consumo = `${yyyy}-${mm}-${dd}`
  } else {
    // Fallback: ayer
    const ayer = new Date(Date.now() - 24*60*60*1000)
    fecha_consumo = ayer.toISOString().split('T')[0]
  }

  // Detalle: extraer lineas de transacciones (best effort)
  // Cada linea probablemente: <hora> <auth> <monto>
  const detalle = []
  const lineas = text.split('\n')
  for (const linea of lineas) {
    const m = linea.match(/^\s*(\d{2}:\d{2}(?::\d{2})?)\s+.*?Q?\s*([\d,]+\.\d{2})\s*$/)
    if (m) {
      detalle.push({
        hora: m[1],
        monto: parseFloat(m[2].replace(/,/g, '')),
        linea_original: linea.trim()
      })
    }
  }

  return { fecha_consumo, total_q, detalle }
}

// ─── Notificacion ───────────────────────────────────────────────
async function notificarAfiliacionDesconocida(afiliacion, msgId, pdfName, total) {
  const BREVO_KEY = process.env.BREVO_API_KEY
  if (!BREVO_KEY) {
    console.warn('[neonet/ingest] BREVO_API_KEY no configurada; skip notify')
    return
  }
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'GasOps Neonet', email: 'noreply@hidrocom.net' },
        to: [{ email: NOTIFY_EMAIL }],
        subject: `Afiliación Neonet desconocida: ${afiliacion}`,
        htmlContent: `
          <p>Llegó un estado de cuenta Neonet con afiliación <b>${afiliacion}</b> que no está mapeada.</p>
          <p>Total: Q${total}</p>
          <p>PDF: ${pdfName}</p>
          <p>Email ID: ${msgId}</p>
          <p>Agregar fila a <code>neonet_afiliaciones</code> para que se procese automáticamente.</p>
        `
      })
    })
  } catch (err) {
    console.error('[neonet/ingest] Brevo notify falló', err)
  }
}
