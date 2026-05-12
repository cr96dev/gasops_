// pages/api/qbo/conciliar/mensual.js
// Compara totales Supabase vs QBO sync_audit del mes anterior
// Envia email con reporte detallado
// GET/POST /api/qbo/conciliar/mensual?mes=YYYY-MM
// Default: mes anterior

import { supabaseAdmin } from '../../../../lib/qbo/supabaseAdmin'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

function parseDestinatarios() {
  const raw = process.env.ALERT_EMAIL_TO || ''
  return raw.split(',').map(e => e.trim()).filter(e => e.length > 0).map(email => ({ email }))
}

async function enviarEmailBrevo(subject, htmlContent) {
  if (!process.env.BREVO_API_KEY) return { skipped: true, reason: 'no_api_key' }
  const destinatarios = parseDestinatarios()
  if (destinatarios.length === 0) return { skipped: true, reason: 'no_recipients' }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: process.env.ALERT_EMAIL_FROM_NAME || 'Hidrocom QBO Sync',
          email: process.env.ALERT_EMAIL_FROM || 'noreply@hidrocom.net'
        },
        to: destinatarios,
        subject,
        htmlContent
      })
    })
    const responseText = await response.text()
    if (!response.ok) return { sent: false, error: `Brevo ${response.status}: ${responseText}` }
    const data = JSON.parse(responseText)
    return { sent: true, messageId: data.messageId }
  } catch (err) {
    return { sent: false, error: err.message }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Use POST or GET' })
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.INTERNAL_API_SECRET}` && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Determinar mes (default: mes anterior)
  let mes = req.query.mes
  if (!mes) {
    const hoy = new Date()
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    mes = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`
  }

  const fechaInicio = `${mes}-01`
  const [anio, mesNum] = mes.split('-').map(Number)
  const ultimoDia = new Date(anio, mesNum, 0).getDate()
  const fechaFin = `${mes}-${String(ultimoDia).padStart(2, '0')}`

  try {
    // 1. Totales Supabase del mes
    const [ventasRes, lubRes, tiendaRes] = await Promise.all([
      supabaseAdmin.from('ventas').select('estacion_id, regular_ingresos, premium_ingresos, diesel_ingresos, diesel_plus_ingresos, qbo_processed').gte('fecha', fechaInicio).lte('fecha', fechaFin),
      supabaseAdmin.from('ventas_lubricantes').select('estacion_id, total_venta, qbo_processed').gte('fecha', fechaInicio).lte('fecha', fechaFin),
      supabaseAdmin.from('tienda_facturas_fel').select('estacion_id, monto, qbo_processed').gte('fecha', fechaInicio).lte('fecha', fechaFin)
    ])

    // 2. Estaciones para nombre
    const { data: estaciones } = await supabaseAdmin.from('estaciones').select('id, nombre')
    const estNombre = {}
    estaciones?.forEach(e => { estNombre[e.id] = e.nombre })

    // 3. Totales por estacion y categoria
    const porEstacion = {}
    const initEst = (estId) => {
      if (!porEstacion[estId]) {
        porEstacion[estId] = {
          nombre: estNombre[estId] || 'Desconocida',
          combustible: { total: 0, procesado: 0 },
          lubricantes: { total: 0, procesado: 0 },
          tienda: { total: 0, procesado: 0 }
        }
      }
    }

    for (const v of ventasRes.data || []) {
      initEst(v.estacion_id)
      const total = parseFloat(v.regular_ingresos || 0) + parseFloat(v.premium_ingresos || 0) +
                    parseFloat(v.diesel_ingresos || 0) + parseFloat(v.diesel_plus_ingresos || 0)
      porEstacion[v.estacion_id].combustible.total += total
      if (v.qbo_processed) porEstacion[v.estacion_id].combustible.procesado += total
    }
    for (const v of lubRes.data || []) {
      initEst(v.estacion_id)
      const total = parseFloat(v.total_venta || 0)
      porEstacion[v.estacion_id].lubricantes.total += total
      if (v.qbo_processed) porEstacion[v.estacion_id].lubricantes.procesado += total
    }
    for (const v of tiendaRes.data || []) {
      initEst(v.estacion_id)
      const total = parseFloat(v.monto || 0)
      porEstacion[v.estacion_id].tienda.total += total
      if (v.qbo_processed) porEstacion[v.estacion_id].tienda.procesado += total
    }

    // 4. Totales en qbo_sync_audit del mes
    const { data: audits } = await supabaseAdmin
      .from('qbo_sync_audit')
      .select('estacion, categoria, monto_total, status')
      .gte('fecha_proceso', fechaInicio)
      .lte('fecha_proceso', fechaFin)
      .eq('status', 'SUCCESS')

    // 5. Calcular totales globales
    const totalGlobal = {
      combustible: { supabase: 0, supabase_procesado: 0, qbo: 0 },
      lubricantes: { supabase: 0, supabase_procesado: 0, qbo: 0 },
      tienda: { supabase: 0, supabase_procesado: 0, qbo: 0 }
    }
    for (const est of Object.values(porEstacion)) {
      totalGlobal.combustible.supabase += est.combustible.total
      totalGlobal.combustible.supabase_procesado += est.combustible.procesado
      totalGlobal.lubricantes.supabase += est.lubricantes.total
      totalGlobal.lubricantes.supabase_procesado += est.lubricantes.procesado
      totalGlobal.tienda.supabase += est.tienda.total
      totalGlobal.tienda.supabase_procesado += est.tienda.procesado
    }
    for (const a of audits || []) {
      const cat = a.categoria?.toLowerCase()
      if (totalGlobal[cat]) totalGlobal[cat].qbo += parseFloat(a.monto_total || 0)
    }

    // 6. Diferencias
    const diffs = {
      combustible: totalGlobal.combustible.supabase_procesado - totalGlobal.combustible.qbo,
      lubricantes: totalGlobal.lubricantes.supabase_procesado - totalGlobal.lubricantes.qbo,
      tienda: totalGlobal.tienda.supabase_procesado - totalGlobal.tienda.qbo
    }
    const totalDiff = diffs.combustible + diffs.lubricantes + diffs.tienda
    const hayDiscrepancia = Math.abs(totalDiff) > 0.01

    // 7. Construir HTML
    const fmtMonto = (n) => 'Q' + n.toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2})

    const emoji = hayDiscrepancia ? '⚠️' : '✅'
    const status = hayDiscrepancia ? 'CON DIFERENCIAS' : 'CONCILIADO'
    const color = hayDiscrepancia ? '#f59e0b' : '#2ca01c'

    const subject = `${emoji} QBO Conciliacion ${mes} ${status} - Diff: ${fmtMonto(totalDiff)}`

    const filaCategoria = (cat, sup, supProc, qbo, diff) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${cat}</strong></td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">${fmtMonto(sup)}</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">${fmtMonto(supProc)}</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">${fmtMonto(qbo)}</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb; color: ${Math.abs(diff) > 0.01 ? '#dc2626' : '#1f2937'};"><strong>${fmtMonto(diff)}</strong></td>
      </tr>
    `

    const html = `
<html><body style="font-family: -apple-system, sans-serif; padding: 24px; max-width: 880px; margin: 0 auto; color: #1f2937;">
  <h2 style="color: ${color}; margin-bottom: 8px;">${emoji} Hidrocom QBO Conciliacion Mensual — ${status}</h2>
  <p style="color: #6b7280; margin-top: 0;">
    Mes analizado: <strong>${mes}</strong> · Generado: ${new Date().toISOString()}
  </p>

  <h3 style="margin-top: 24px;">Resumen por categoria</h3>
  <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 8px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="text-align: left; padding: 10px; border: 1px solid #e5e7eb;">Categoria</th>
        <th style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">Total Supabase</th>
        <th style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">Procesado a QBO</th>
        <th style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">Audit QBO</th>
        <th style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">Diferencia</th>
      </tr>
    </thead>
    <tbody>
      ${filaCategoria('Combustible', totalGlobal.combustible.supabase, totalGlobal.combustible.supabase_procesado, totalGlobal.combustible.qbo, diffs.combustible)}
      ${filaCategoria('Lubricantes', totalGlobal.lubricantes.supabase, totalGlobal.lubricantes.supabase_procesado, totalGlobal.lubricantes.qbo, diffs.lubricantes)}
      ${filaCategoria('Tienda', totalGlobal.tienda.supabase, totalGlobal.tienda.supabase_procesado, totalGlobal.tienda.qbo, diffs.tienda)}
      <tr style="background: #f9fafb; font-weight: 600;">
        <td style="padding: 10px; border: 1px solid #e5e7eb;">TOTAL</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">${fmtMonto(totalGlobal.combustible.supabase + totalGlobal.lubricantes.supabase + totalGlobal.tienda.supabase)}</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">${fmtMonto(totalGlobal.combustible.supabase_procesado + totalGlobal.lubricantes.supabase_procesado + totalGlobal.tienda.supabase_procesado)}</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb;">${fmtMonto(totalGlobal.combustible.qbo + totalGlobal.lubricantes.qbo + totalGlobal.tienda.qbo)}</td>
        <td style="text-align: right; padding: 10px; border: 1px solid #e5e7eb; color: ${Math.abs(totalDiff) > 0.01 ? '#dc2626' : '#1f2937'};">${fmtMonto(totalDiff)}</td>
      </tr>
    </tbody>
  </table>

  <h3 style="margin-top: 24px;">Detalle por estacion</h3>
  <table style="border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 8px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb;">Estacion</th>
        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">Combustible</th>
        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">Lubricantes</th>
        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">Tienda</th>
      </tr>
    </thead>
    <tbody>
      ${Object.values(porEstacion).sort((a, b) => b.combustible.total - a.combustible.total).map(est => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${est.nombre}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">${fmtMonto(est.combustible.total)}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">${fmtMonto(est.lubricantes.total)}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">${fmtMonto(est.tienda.total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <p style="margin-top: 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
    Reporte automatico de Hidrocom QBO Integrator · Conciliacion mes ${mes}
  </p>
</body></html>
    `

    const emailResult = await enviarEmailBrevo(subject, html)

    return res.status(200).json({
      success: true,
      mes,
      fechaInicio,
      fechaFin,
      hay_discrepancia: hayDiscrepancia,
      totales: totalGlobal,
      diferencias: diffs,
      diferencia_total: totalDiff,
      estaciones_count: Object.keys(porEstacion).length,
      email: emailResult
    })

  } catch (err) {
    console.error('[Conciliacion] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
