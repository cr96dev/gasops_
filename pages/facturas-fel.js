import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import * as XLSX from 'xlsx'

export default function FacturasFEL({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [items, setItems] = useState({})
  const [vista, setVista] = useState('diaria')
  const [filtros, setFiltros] = useState({
    estacion: 'todas',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: new Date().toISOString().split('T')[0],
    busqueda: ''
  })
  const { toasts, toast } = useToast()

  useEffect(() => {
    if (!session) { router.push('/'); return }
    async function init() {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || p.rol !== 'admin') { router.push('/dashboard'); return }
      setPerfil(p)
      const { data: ests } = await supabase.from('estaciones').select('*').eq('activa', true).order('nombre')
      setEstaciones(ests || [])
      setLoading(false)
    }
    init()
  }, [session])

  function aplicarVista(v) {
    setVista(v)
    const hoy = new Date()
    const iso = (d) => d.toISOString().split('T')[0]
    if (v === 'diaria') {
      setFiltros(f => ({ ...f, fechaInicio: iso(hoy), fechaFin: iso(hoy) }))
    } else if (v === 'ayer') {
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
      setFiltros(f => ({ ...f, fechaInicio: iso(ayer), fechaFin: iso(ayer) }))
    } else if (v === 'semanal') {
      const ini = new Date(); ini.setDate(hoy.getDate() - 6)
      setFiltros(f => ({ ...f, fechaInicio: iso(ini), fechaFin: iso(hoy) }))
    } else if (v === 'mensual') {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      setFiltros(f => ({ ...f, fechaInicio: iso(ini), fechaFin: iso(hoy) }))
    } else if (v === 'mes_anterior') {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      setFiltros(f => ({ ...f, fechaInicio: iso(ini), fechaFin: iso(fin) }))
    } else if (v === 'anual') {
      const ini = new Date(hoy.getFullYear(), 0, 1)
      setFiltros(f => ({ ...f, fechaInicio: iso(ini), fechaFin: iso(hoy) }))
    }
  }

  async function buscar() {
    setCargando(true)
    let query = supabase.from('facturas')
      .select('*, estaciones(nombre)')
      .eq('sincronizado_infile', true)
      .gte('fecha_emision', filtros.fechaInicio)
      .lte('fecha_emision', filtros.fechaFin)
      .order('fecha_emision', { ascending: false })
      .order('created_at', { ascending: false })

    if (filtros.estacion !== 'todas') {
      query = query.eq('estacion_id', filtros.estacion)
    }

    const { data } = await query.limit(500)
    setFacturas(data || [])
    setCargando(false)
  }

  async function verItems(facturaId) {
    if (detalleAbierto === facturaId) { setDetalleAbierto(null); return }
    setDetalleAbierto(facturaId)
    if (items[facturaId]) return
    const { data } = await supabase.from('facturas_fel_items')
      .select('*').eq('factura_id', facturaId).order('id')
    setItems(prev => ({ ...prev, [facturaId]: data || [] }))
  }

  useEffect(() => { if (!loading) buscar() }, [loading])

  const facturasFiltradas = facturas.filter(f => {
    if (!filtros.busqueda) return true
    const b = filtros.busqueda.toLowerCase()
    return (
      f.numero_factura?.toLowerCase().includes(b) ||
      f.proveedor?.toLowerCase().includes(b) ||
      f.notas?.toLowerCase().includes(b)
    )
  })

  // Totalizadores
  const totalMonto = facturasFiltradas.reduce((s, f) => s + parseFloat(f.monto || 0), 0)
  const totalFacturas = facturasFiltradas.length
  const promedio = totalFacturas > 0 ? totalMonto / totalFacturas : 0

  // Totales por estación
  const totalesPorEstacion = {}
  facturasFiltradas.forEach(f => {
    const nombre = f.estaciones?.nombre || 'Sin estación'
    if (!totalesPorEstacion[nombre]) totalesPorEstacion[nombre] = { facturas: 0, monto: 0 }
    totalesPorEstacion[nombre].facturas++
    totalesPorEstacion[nombre].monto += parseFloat(f.monto || 0)
  })

  // Totales por fecha
  const totalesPorFecha = {}
  facturasFiltradas.forEach(f => {
    const fecha = f.fecha_emision
    if (!totalesPorFecha[fecha]) totalesPorFecha[fecha] = { facturas: 0, monto: 0 }
    totalesPorFecha[fecha].facturas++
    totalesPorFecha[fecha].monto += parseFloat(f.monto || 0)
  })

  async function exportarExcel() {
    setExportando(true)
    const wb = XLSX.utils.book_new()

    // Hoja 1: Detalle de facturas
    const filas = facturasFiltradas.map(f => ({
      Fecha: f.fecha_emision,
      Estación: f.estaciones?.nombre || '',
      'No. Factura': f.numero_factura,
      Cliente: f.proveedor,
      'Monto (Q)': parseFloat(f.monto || 0),
      UUID: f.notas?.split('UUID: ')[1] || '',
    }))
    const ws1 = XLSX.utils.json_to_sheet(filas)
    ws1['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 38 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Facturas')

    // Hoja 2: Resumen por estación
    const filasEst = Object.entries(totalesPorEstacion)
      .sort((a, b) => b[1].monto - a[1].monto)
      .map(([nombre, datos]) => ({
        Estación: nombre,
        'No. Facturas': datos.facturas,
        'Total (Q)': parseFloat(datos.monto.toFixed(2)),
        '% del total': parseFloat(((datos.monto / totalMonto) * 100).toFixed(1))
      }))
    filasEst.push({ Estación: 'TOTAL', 'No. Facturas': totalFacturas, 'Total (Q)': parseFloat(totalMonto.toFixed(2)), '% del total': 100 })
    const ws2 = XLSX.utils.json_to_sheet(filasEst)
    ws2['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Por estación')

    // Hoja 3: Resumen por fecha
    const filasFecha = Object.entries(totalesPorFecha)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fecha, datos]) => ({
        Fecha: fecha,
        'No. Facturas': datos.facturas,
        'Total (Q)': parseFloat(datos.monto.toFixed(2)),
      }))
    filasFecha.push({ Fecha: 'TOTAL', 'No. Facturas': totalFacturas, 'Total (Q)': parseFloat(totalMonto.toFixed(2)) })
    const ws3 = XLSX.utils.json_to_sheet(filasFecha)
    ws3['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Por fecha')

    // Hoja 4: Items vendidos
    const itemsData = []
    for (const f of facturasFiltradas) {
      if (!items[f.id]) {
        const { data } = await supabase.from('facturas_fel_items').select('*').eq('factura_id', f.id)
        if (data) {
          data.forEach(item => {
            itemsData.push({
              Fecha: f.fecha_emision,
              Estación: f.estaciones?.nombre || '',
              'No. Factura': f.numero_factura,
              Producto: item.descripcion,
              Cantidad: parseFloat(item.cantidad),
              'P. Unitario (Q)': parseFloat(item.precio_unitario),
              'Total (Q)': parseFloat(item.total),
              Tipo: item.tipo
            })
          })
        }
      } else {
        items[f.id].forEach(item => {
          itemsData.push({
            Fecha: f.fecha_emision,
            Estación: f.estaciones?.nombre || '',
            'No. Factura': f.numero_factura,
            Producto: item.descripcion,
            Cantidad: parseFloat(item.cantidad),
            'P. Unitario (Q)': parseFloat(item.precio_unitario),
            'Total (Q)': parseFloat(item.total),
            Tipo: item.tipo
          })
        })
      }
    }
    const ws4 = XLSX.utils.json_to_sheet(itemsData)
    ws4['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 25 }, { wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws4, 'Productos vendidos')

    const periodo = `${filtros.fechaInicio}_al_${filtros.fechaFin}`
    XLSX.writeFile(wb, `Facturas_FEL_${periodo}.xlsx`)
    toast('✓ Excel descargado', 'success')
    setExportando(false)
  }

  const vistas = [
    { key: 'diaria', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: 'semanal', label: 'Esta semana' },
    { key: 'mensual', label: 'Este mes' },
    { key: 'mes_anterior', label: 'Mes anterior' },
    { key: 'anual', label: 'Este año' },
    { key: 'personalizado', label: 'Personalizado' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <Layout perfil={perfil} estacion={null}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-6xl">

        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Facturas FEL — INFILE</h1>
            <p className="text-sm text-gray-400">Facturas sincronizadas automáticamente desde el certificador</p>
          </div>
          <button onClick={exportarExcel} disabled={exportando || facturasFiltradas.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {exportando
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            }
            {exportando ? 'Generando...' : 'Exportar Excel'}
          </button>
        </div>

        {/* Selector de vista */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex gap-1.5 flex-wrap mb-4">
            {vistas.map(v => (
              <button key={v.key} onClick={() => aplicarVista(v.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  vista === v.key
                    ? 'bg-blue-600 border-blue-600 text-white font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {v.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estación</label>
              <select value={filtros.estacion} onChange={e => setFiltros(f => ({ ...f, estacion: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                <option value="todas">Todas las estaciones</option>
                {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha inicio</label>
              <input type="date" value={filtros.fechaInicio}
                onChange={e => { setFiltros(f => ({ ...f, fechaInicio: e.target.value })); setVista('personalizado') }}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha fin</label>
              <input type="date" value={filtros.fechaFin}
                onChange={e => { setFiltros(f => ({ ...f, fechaFin: e.target.value })); setVista('personalizado') }}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Buscar</label>
              <input type="text" value={filtros.busqueda} placeholder="Factura, cliente..."
                onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button onClick={buscar} disabled={cargando}
              className="bg-blue-600 text-white text-sm px-5 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {cargando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {cargando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Tarjetas resumen */}
        {facturasFiltradas.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Total facturas</div>
                <div className="text-2xl font-medium text-blue-800">{totalFacturas.toLocaleString('es-GT')}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Monto total</div>
                <div className="text-2xl font-medium text-blue-800">Q{totalMonto.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Promedio por factura</div>
                <div className="text-2xl font-medium text-blue-800">Q{promedio.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Estaciones activas</div>
                <div className="text-2xl font-medium text-blue-800">{Object.keys(totalesPorEstacion).length}</div>
              </div>
            </div>

            {/* Totales por estación */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">Resumen por estación</h2>
                <span className="text-xs text-gray-400">{filtros.fechaInicio} al {filtros.fechaFin}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                    <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Facturas</th>
                    <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Total (Q)</th>
                    <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totalesPorEstacion)
                    .sort((a, b) => b[1].monto - a[1].monto)
                    .map(([nombre, datos]) => (
                      <tr key={nombre} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-medium text-gray-800">{nombre}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{datos.facturas}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">Q{datos.monto.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(datos.monto / totalMonto * 100).toFixed(1)}%` }}></div>
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{(datos.monto / totalMonto * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-blue-50">
                    <td className="px-5 py-2.5 font-medium text-blue-800">Total red</td>
                    <td className="px-3 py-2.5 text-right font-medium text-blue-800">{totalFacturas}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-blue-800">Q{totalMonto.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>
                    <td className="px-5 py-2.5 text-right text-blue-600 text-xs font-medium">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totales por fecha (solo si hay más de un día) */}
            {Object.keys(totalesPorFecha).length > 1 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-medium text-gray-700">Resumen por fecha</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Facturas</th>
                      <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">Total (Q)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totalesPorFecha)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([fecha, datos]) => (
                        <tr key={fecha} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-2.5 text-gray-700">{fecha}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600">{datos.facturas}</td>
                          <td className="px-5 py-2.5 text-right font-medium text-gray-800">Q{datos.monto.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Tabla de facturas */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Detalle de facturas</h2>
            <span className="text-xs text-gray-400">{facturasFiltradas.length} registros</span>
          </div>
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : facturasFiltradas.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No hay facturas para los filtros seleccionados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">No. Factura</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Cliente</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Monto</th>
                  <th className="px-4 py-2.5 text-center text-xs text-gray-400 font-normal">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.map(f => (
                  <>
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{f.fecha_emision}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium text-gray-700">{f.estaciones?.nombre}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">{f.numero_factura}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{f.proveedor}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                        Q{parseFloat(f.monto).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => verItems(f.id)}
                          className="text-xs text-blue-600 hover:text-blue-800">
                          {detalleAbierto === f.id ? '▲ Cerrar' : '▼ Ver'}
                        </button>
                      </td>
                    </tr>
                    {detalleAbierto === f.id && (
                      <tr key={f.id + '-det'} className="border-b border-gray-100">
                        <td colSpan={6} className="px-4 py-3 bg-blue-50/50">
                          {!items[f.id] ? (
                            <div className="text-xs text-gray-400 text-center py-2">Cargando...</div>
                          ) : items[f.id].length === 0 ? (
                            <div className="text-xs text-gray-400 text-center py-2">Sin detalle disponible</div>
                          ) : (
                            <div>
                              <div className="grid grid-cols-4 px-2 py-1.5 text-xs text-gray-400 font-medium border-b border-blue-100">
                                <div className="col-span-2">Producto</div>
                                <div className="text-center">Cantidad</div>
                                <div className="text-right">Total</div>
                              </div>
                              {items[f.id].map((item, idx) => (
                                <div key={idx} className="grid grid-cols-4 px-2 py-2 text-xs border-b border-blue-50 last:border-0">
                                  <div className="col-span-2 text-gray-700 font-medium">{item.descripcion}</div>
                                  <div className="text-center text-gray-500">{parseFloat(item.cantidad)} {item.unidad}</div>
                                  <div className="text-right text-gray-800 font-medium">Q{parseFloat(item.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
                                </div>
                              ))}
                              <div className="grid grid-cols-4 px-2 py-2 text-xs font-medium text-blue-700 border-t border-blue-100 mt-1">
                                <div className="col-span-3 text-gray-400">{f.notas?.split('NIT:')[1]?.split('|')[0]?.trim() !== 'CF' ? 'NIT: ' + f.notas?.split('NIT:')[1]?.split('|')[0]?.trim() : 'Consumidor Final'}</div>
                                <div className="text-right">Q{parseFloat(f.monto).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
