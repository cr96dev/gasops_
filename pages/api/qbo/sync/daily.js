// pages/api/qbo/sync/daily.js
// Endpoint principal: procesa ventas de combustible + lubricantes de un dia
// POST /api/qbo/sync/daily?fecha=YYYY-MM-DD
// Si no se da fecha, usa "ayer"

import { qboApi } from '../../../../lib/qbo/apiClient'
import { supabaseAdmin } from '../../../../lib/qbo/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  if (req.headers.authorization !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const fechaDefault = ayer.toISOString().split('T')[0]
  const fecha = req.query.fecha || fechaDefault

  const startTime = Date.now()
  const resultados = {
    combustible: { exitos: 0, errores: 0, omitidos: 0, detalle: [] },
    lubricantes: { exitos: 0, errores: 0, omitidos: 0, detalle: [] }
  }

  try {
    // Cargar mapeos de una sola vez
    const [estacionesRes, customersRes, itemsRes] = await Promise.all([
      supabaseAdmin.from('qbo_mapping_estaciones').select('*').eq('activo', true),
      supabaseAdmin.from('qbo_mapping_customers').select('*').eq('activo', true).eq('qbo_customer_type', 'CF_BY_STATION'),
      supabaseAdmin.from('qbo_mapping_skus').select('*')
    ])

    const estacionesByGasOpsId = {}
    estacionesRes.data?.forEach(e => { if (e.gasops_estacion_id) estacionesByGasOpsId[e.gasops_estacion_id] = e })

    const customersByEstacion = {}
    customersRes.data?.forEach(c => { customersByEstacion[c.estacion_codigo] = c })

    const itemsBySku = {}
    itemsRes.data?.forEach(i => { itemsBySku[i.sku] = i })

    // ============================================
    // 1. COMBUSTIBLE (1 SR por estacion-dia)
    // ============================================
    const { data: ventasCombustible } = await supabaseAdmin
      .from('ventas')
      .select('*')
      .eq('fecha', fecha)
      .eq('qbo_processed', false)

    for (const venta of ventasCombustible || []) {
      const estacion = estacionesByGasOpsId[venta.estacion_id]
      if (!estacion) {
        resultados.combustible.errores++
        resultados.combustible.detalle.push({ venta_id: venta.id, error: 'Estacion no mapeada' })
        continue
      }

      const customer = customersByEstacion[estacion.estacion_codigo]
      if (!customer) {
        resultados.combustible.errores++
        resultados.combustible.detalle.push({ estacion: estacion.estacion_nombre, error: 'Customer CF no mapeado' })
        continue
      }

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
        await supabaseAdmin.from('ventas').update({
          qbo_processed: true,
          qbo_sales_receipt_id: 'SKIPPED-NO-INCOME',
          qbo_processed_at: new Date().toISOString()
        }).eq('id', venta.id)
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

        await supabaseAdmin.from('ventas').update({
          qbo_processed: true,
          qbo_sales_receipt_id: sr.Id,
          qbo_processed_at: new Date().toISOString()
        }).eq('id', venta.id)

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
        resultados.combustible.detalle.push({ estacion: estacion.estacion_nombre, error: err.message })
      }
    }

    // ============================================
    // 2. LUBRICANTES (1 SR por estacion-dia)
    // ============================================
    const { data: ventasLub } = await supabaseAdmin
      .from('ventas_lubricantes')
      .select('*, ventas_lubricantes_detalle(*)')
      .eq('fecha', fecha)
      .eq('qbo_processed', false)

    for (const venta of ventasLub || []) {
      const estacion = estacionesByGasOpsId[venta.estacion_id]
      if (!estacion) {
        resultados.lubricantes.errores++
        resultados.lubricantes.detalle.push({ venta_id: venta.id, error: 'Estacion no mapeada' })
        continue
      }

      const customer = customersByEstacion[estacion.estacion_codigo]
      if (!customer) {
        resultados.lubricantes.errores++
        resultados.lubricantes.detalle.push({ estacion: estacion.estacion_nombre, error: 'Customer CF no mapeado' })
        continue
      }

      const totalVenta = parseFloat(venta.total_venta || 0)
      if (totalVenta <= 0) {
        resultados.lubricantes.omitidos++
        await supabaseAdmin.from('ventas_lubricantes').update({
          qbo_processed: true,
          qbo_sales_receipt_id: 'SKIPPED-NO-INCOME',
          qbo_processed_at: new Date().toISOString()
        }).eq('id', venta.id)
        continue
      }

      const detalles = venta.ventas_lubricantes_detalle || []
      const lines = []

      if (detalles.length > 0) {
        // CON DETALLE: 1 linea por SKU
        for (const d of detalles) {
          lines.push({
            DetailType: 'SalesItemLineDetail',
            Amount: parseFloat(d.subtotal),
            Description: `${d.nombre || d.sku} x${d.cantidad}`,
            SalesItemLineDetail: {
              ItemRef: { value: itemsBySku['LUB-GEN'].qbo_item_id },
              Qty: parseFloat(d.cantidad || 1),
              UnitPrice: parseFloat(d.precio_unitario || d.subtotal),
              ClassRef: { value: estacion.qbo_class_id }
            }
          })
        }
      } else {
        // SIN DETALLE: 1 linea generica
        lines.push({
          DetailType: 'SalesItemLineDetail',
          Amount: totalVenta,
          Description: `Lubricantes - venta agregada del dia`,
          SalesItemLineDetail: {
            ItemRef: { value: itemsBySku['LUB-GEN'].qbo_item_id },
            Qty: 1,
            UnitPrice: totalVenta,
            ClassRef: { value: estacion.qbo_class_id }
          }
        })
      }

      const salesReceipt = {
        TxnDate: fecha,
        CustomerRef: { value: customer.qbo_customer_id },
        ClassRef: { value: estacion.qbo_class_id },
        Line: lines,
        PrivateNote: `Auto: lubricantes ${estacion.estacion_codigo} ${fecha}`
      }

      try {
        const result = await qboApi('POST', '/salesreceipt', salesReceipt)
        const sr = result.SalesReceipt

        await supabaseAdmin.from('ventas_lubricantes').update({
          qbo_processed: true,
          qbo_sales_receipt_id: sr.Id,
          qbo_processed_at: new Date().toISOString()
        }).eq('id', venta.id)

        await supabaseAdmin.from('qbo_sync_audit').insert({
          fecha_proceso: fecha,
          bucket_key: `${fecha}|${estacion.estacion_codigo}|Lubricantes|CF`,
          estacion: estacion.estacion_codigo,
          categoria: 'Lubricantes',
          customer_type: 'CF',
          customer_nit: customer.nit,
          fel_count: detalles.length || 1,
          fel_ids: [venta.id],
          monto_total: parseFloat(sr.TotalAmt),
          qbo_sales_receipt_id: sr.Id,
          status: 'SUCCESS',
          attempts: 1
        })

        resultados.lubricantes.exitos++
        resultados.lubricantes.detalle.push({
          estacion: estacion.estacion_nombre,
          sr_id: sr.Id,
          monto: sr.TotalAmt,
          lineas: lines.length,
          con_detalle: detalles.length > 0
        })
      } catch (err) {
        resultados.lubricantes.errores++
        resultados.lubricantes.detalle.push({ estacion: estacion.estacion_nombre, error: err.message })
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
    return res.status(500).json({ error: err.message, resultados })
  }
}
