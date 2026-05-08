// pages/api/qbo/sync/daily.js
// Endpoint principal: procesa todas las ventas de combustible de un dia
// POST /api/qbo/sync/daily?fecha=YYYY-MM-DD
// Si no se da fecha, usa "ayer"

import { qboApi } from '../../../../lib/qbo/apiClient'
import { supabaseAdmin } from '../../../../lib/qbo/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  if (req.headers.authorization !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Default: ayer
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const fechaDefault = ayer.toISOString().split('T')[0]
  const fecha = req.query.fecha || fechaDefault

  const startTime = Date.now()
  const log = []
  const resultados = {
    combustible: { exitos: 0, errores: 0, omitidos: 0, detalle: [] }
  }

  try {
    log.push(`[Sync] Iniciando sync para ${fecha}`)

    // Cargar todos los mapeos de una sola vez
    const [estacionesRes, customersRes, itemsRes] = await Promise.all([
      supabaseAdmin.from('qbo_mapping_estaciones').select('*').eq('activo', true),
      supabaseAdmin.from('qbo_mapping_customers').select('*').eq('activo', true).eq('qbo_customer_type', 'CF_BY_STATION'),
      supabaseAdmin.from('qbo_mapping_skus').select('*').in('sku', ['COMB-REG', 'COMB-PREM', 'COMB-DIESEL', 'COMB-DIESELP'])
    ])

    const estacionesByCodigo = {}
    estacionesRes.data?.forEach(e => { estacionesByCodigo[e.estacion_codigo] = e })

    const estacionesByGasOpsId = {}
    estacionesRes.data?.forEach(e => { if (e.gasops_estacion_id) estacionesByGasOpsId[e.gasops_estacion_id] = e })

    const customersByEstacion = {}
    customersRes.data?.forEach(c => { customersByEstacion[c.estacion_codigo] = c })

    const itemsBySku = {}
    itemsRes.data?.forEach(i => { itemsBySku[i.sku] = i })

    log.push(`[Sync] Mapeos cargados: ${estacionesRes.data?.length} estaciones, ${customersRes.data?.length} customers CF, ${itemsRes.data?.length} items`)

    // ============================================
    // COMBUSTIBLE (1 SR por estacion-dia)
    // ============================================
    const { data: ventas } = await supabaseAdmin
      .from('ventas')
      .select('*')
      .eq('fecha', fecha)
      .eq('qbo_processed', false)

    log.push(`[Sync] Combustible: ${ventas?.length || 0} ventas pendientes`)

    for (const venta of ventas || []) {
      const estacion = estacionesByGasOpsId[venta.estacion_id]
      if (!estacion) {
        resultados.combustible.errores++
        resultados.combustible.detalle.push({
          venta_id: venta.id,
          error: `Estacion no mapeada: ${venta.estacion_id}`
        })
        continue
      }

      const customer = customersByEstacion[estacion.estacion_codigo]
      if (!customer) {
        resultados.combustible.errores++
        resultados.combustible.detalle.push({
          venta_id: venta.id,
          estacion: estacion.estacion_nombre,
          error: 'Customer CF no mapeado'
        })
        continue
      }

      // Construir lineas
      const lines = []
      const productos = [
        { sku: 'COMB-REG', litros: venta.regular_litros, ingresos: venta.regular_ingresos, nombre: 'Combustible Regular' },
        { sku: 'COMB-PREM', litros: venta.premium_litros, ingresos: venta.premium_ingresos, nombre: 'Combustible Premium' },
        { sku: 'COMB-DIESEL', litros: venta.diesel_litros, ingresos: venta.diesel_ingresos, nombre: 'Diesel' },
        { sku: 'COMB-DIESELP', litros: venta.diesel_plus_litros, ingresos: venta.diesel_plus_ingresos, nombre: 'Diesel Plus' }
      ]

      for (const p of productos) {
        const ingresos = parseFloat(p.ingresos || 0)
        if (ingresos > 0) {
          lines.push({
            DetailType: 'SalesItemLineDetail',
            Amount: ingresos,
            Description: `${p.nombre} - ${p.litros} litros`,
            SalesItemLineDetail: {
              ItemRef: { value: itemsBySku[p.sku].qbo_item_id },
              Qty: parseFloat(p.litros),
              ClassRef: { value: estacion.qbo_class_id }
            }
          })
        }
      }

      if (lines.length === 0) {
        resultados.combustible.omitidos++
        // Marcar como procesado igual (sin SR) para no reintentar
        await supabaseAdmin
          .from('ventas')
          .update({
            qbo_processed: true,
            qbo_sales_receipt_id: 'SKIPPED-NO-INCOME',
            qbo_processed_at: new Date().toISOString()
          })
          .eq('id', venta.id)
        continue
      }

      const salesReceipt = {
        TxnDate: fecha,
        CustomerRef: { value: customer.qbo_customer_id },
        ClassRef: { value: estacion.qbo_class_id },
        Line: lines,
        PrivateNote: `Auto: combustible ${estacion.estacion_codigo} ${fecha}`
      }

      try {
        const result = await qboApi('POST', '/salesreceipt', salesReceipt)
        const sr = result.SalesReceipt

        await supabaseAdmin
          .from('ventas')
          .update({
            qbo_processed: true,
            qbo_sales_receipt_id: sr.Id,
            qbo_processed_at: new Date().toISOString()
          })
          .eq('id', venta.id)

        // Audit log
        await supabaseAdmin.from('qbo_sync_audit').insert({
          fecha_proceso: fecha,
          bucket_key: `${fecha}|${estacion.estacion_codigo}|Combustible|CF`,
          estacion: estacion.estacion_codigo,
          categoria: 'Combustible',
          customer_type: 'CF',
          customer_nit: customer.nit,
          fel_count: 1,
          fel_ids: [venta.id],
          monto_total: parseFloat(sr.TotalAmt),
          qbo_sales_receipt_id: sr.Id,
          status: 'SUCCESS',
          attempts: 1
        })

        resultados.combustible.exitos++
        resultados.combustible.detalle.push({
          estacion: estacion.estacion_nombre,
          sr_id: sr.Id,
          monto: sr.TotalAmt,
          lineas: lines.length
        })

      } catch (err) {
        resultados.combustible.errores++
        resultados.combustible.detalle.push({
          estacion: estacion.estacion_nombre,
          error: err.message
        })

        // Audit log de error
        await supabaseAdmin.from('qbo_sync_audit').insert({
          fecha_proceso: fecha,
          bucket_key: `${fecha}|${estacion.estacion_codigo}|Combustible|CF`,
          estacion: estacion.estacion_codigo,
          categoria: 'Combustible',
          customer_type: 'CF',
          customer_nit: customer.nit,
          fel_count: 1,
          fel_ids: [venta.id],
          status: 'FAILED',
          error_message: err.message,
          attempts: 1
        })
      }
    }

    const duracionMs = Date.now() - startTime

    return res.status(200).json({
      success: true,
      fecha,
      duracion_ms: duracionMs,
      duracion_seg: (duracionMs / 1000).toFixed(2),
      resultados
    })

  } catch (err) {
    console.error('[Sync] Error fatal:', err.message)
    return res.status(500).json({
      error: err.message,
      log,
      resultados
    })
  }
}
