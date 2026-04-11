import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'

export default function FacturasFEL({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [items, setItems] = useState({})
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

    const { data } = await query.limit(200)
    setFacturas(data || [])
    setCargando(false)
  }

  async function verItems(facturaId) {
    if (detalleAbierto === facturaId) { setDetalleAbierto(null); return }
    setDetalleAbierto(facturaId)
    if (items[facturaId]) return
    const { data } = await supabase.from('facturas_fel_items')
      .select('*')
      .eq('factura_id', facturaId)
      .order('id')
    setItems(prev => ({ ...prev, [facturaId]: data || [] }))
  }

  useEffect(() => {
    if (!loading) buscar()
  }, [loading])

  const facturasFiltradas = facturas.filter(f => {
    if (!filtros.busqueda) return true
    const b = filtros.busqueda.toLowerCase()
    return (
      f.numero_factura?.toLowerCase().includes(b) ||
      f.proveedor?.toLowerCase().includes(b) ||
      f.notas?.toLowerCase().includes(b)
    )
  })

  const totalMonto = facturasFiltradas.reduce((s, f) => s + parseFloat(f.monto || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <Layout perfil={perfil} estacion={null}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-6xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Facturas FEL — INFILE</h1>
          <p className="text-sm text-gray-400">Facturas sincronizadas automáticamente desde el certificador</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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
                onChange={e => setFiltros(f => ({ ...f, fechaInicio: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha fin</label>
              <input type="date" value={filtros.fechaFin}
                onChange={e => setFiltros(f => ({ ...f, fechaFin: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Buscar</label>
              <input type="text" value={filtros.busqueda} placeholder="Factura, cliente..."
                onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {[
                { label: 'Hoy', fn: () => { const h = new Date().toISOString().split('T')[0]; setFiltros(f => ({ ...f, fechaInicio: h, fechaFin: h })) } },
                { label: 'Ayer', fn: () => { const a = new Date(); a.setDate(a.getDate()-1); const s = a.toISOString().split('T')[0]; setFiltros(f => ({ ...f, fechaInicio: s, fechaFin: s })) } },
                { label: 'Este mes', fn: () => { const d = new Date(); const ini = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; setFiltros(f => ({ ...f, fechaInicio: ini, fechaFin: d.toISOString().split('T')[0] })) } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.fn}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  {btn.label}
                </button>
              ))}
            </div>
            <button onClick={buscar} disabled={cargando}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {cargando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {cargando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Resumen */}
        {facturasFiltradas.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-xs text-blue-600 mb-1">Total facturas</div>
              <div className="text-2xl font-medium text-blue-800">{facturasFiltradas.length}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-xs text-blue-600 mb-1">Monto total</div>
              <div className="text-2xl font-medium text-blue-800">Q{totalMonto.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-xs text-blue-600 mb-1">Promedio por factura</div>
              <div className="text-2xl font-medium text-blue-800">Q{(totalMonto / facturasFiltradas.length).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                            <div className="space-y-0">
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
                              <div className="grid grid-cols-4 px-2 py-2 text-xs font-medium text-blue-700">
                                <div className="col-span-2">Notas: {f.notas?.split('|')[1]?.trim() || ''}</div>
                                <div></div>
                                <div className="text-right">Total: Q{parseFloat(f.monto).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
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
