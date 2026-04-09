import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Admin({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [resumen, setResumen] = useState({})
  const [mensual, setMensual] = useState({})
  const [facturas, setFacturas] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ayer')
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)
  const [vistaDetalle, setVistaDetalle] = useState(null)
  const [estacionSeleccionada, setEstacionSeleccionada] = useState(null)
  const [registros, setRegistros] = useState([])
  const [loadingRegistros, setLoadingRegistros] = useState(false)
  const [eliminando, setEliminando] = useState(null)
  const [segundos, setSegundos] = useState(30)

  const getAyer = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  const getPrimerDiaMes = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  const cargarDatos = useCallback(async () => {
    const ayer = getAyer()
    const primerDia = getPrimerDiaMes()

    const { data: ventasAyer } = await supabase
      .from('ventas').select('*').eq('fecha', ayer)
    const ventasMap = {}
    ;(ventasAyer || []).forEach(v => { ventasMap[v.estacion_id] = v })
    setResumen(ventasMap)

    const { data: ventasMes } = await supabase
      .from('ventas')
      .select('estacion_id, regular_ingresos, premium_ingresos, diesel_ingresos, diesel_plus_ingresos, regular_litros, premium_litros, diesel_litros, diesel_plus_litros')
      .gte('fecha', primerDia)
    const mensualMap = {}
    ;(ventasMes || []).forEach(v => {
      if (!mensualMap[v.estacion_id]) mensualMap[v.estacion_id] = { ingresos: 0, galones: 0 }
      mensualMap[v.estacion_id].ingresos += v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos
      mensualMap[v.estacion_id].galones += v.regular_litros + v.premium_litros + v.diesel_litros + v.diesel_plus_litros
    })
    setMensual(mensualMap)

    setUltimaActualizacion(new Date().toLocaleTimeString('es-GT'))
    setSegundos(30)
  }, [])

  const cargarFacturasResumen = useCallback(async () => {
    const { data: facts } = await supabase.from('facturas').select('estacion_id, estado, monto').in('estado', ['pendiente', 'vencida'])
    const factMap = {}
    ;(facts || []).forEach(f => {
      if (!factMap[f.estacion_id]) factMap[f.estacion_id] = { pendiente: 0, vencida: 0, total: 0 }
      factMap[f.estacion_id][f.estado] += 1
      factMap[f.estacion_id].total += parseFloat(f.monto)
    })
    setFacturas(factMap)
  }, [])

  useEffect(() => {
    if (!session) { router.push('/'); return }
    async function init() {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || p.rol !== 'admin') { router.push('/dashboard'); return }
      setPerfil(p)
      const { data: ests } = await supabase.from('estaciones').select('*').eq('activa', true).order('nombre')
      setEstaciones(ests || [])
      await cargarDatos()
      await cargarFacturasResumen()
      setLoading(false)
    }
    init()
  }, [session])

  useEffect(() => {
    if (!perfil) return
    const intervalo = setInterval(async () => {
      await cargarDatos()
      await cargarFacturasResumen()
    }, 30000)
    return () => clearInterval(intervalo)
  }, [perfil, cargarDatos, cargarFacturasResumen])

  useEffect(() => {
    if (!perfil) return
    const tick = setInterval(() => {
      setSegundos(s => s > 0 ? s - 1 : 30)
    }, 1000)
    return () => clearInterval(tick)
  }, [perfil])

  async function abrirDetalle(estacion, tipo) {
    setEstacionSeleccionada(estacion)
    setVistaDetalle(tipo)
    setLoadingRegistros(true)
    let data = []
    if (tipo === 'ventas') {
      const r = await supabase.from('ventas').select('*').eq('estacion_id', estacion.id).order('fecha', { ascending: false }).limit(30)
      data = r.data || []
    } else if (tipo === 'entregas') {
      const r = await supabase.from('entregas').select('*').eq('estacion_id', estacion.id).order('fecha_entrega', { ascending: false }).limit(30)
      data = r.data || []
    } else if (tipo === 'facturas') {
      const r = await supabase.from('facturas').select('*').eq('estacion_id', estacion.id).order('fecha_emision', { ascending: false }).limit(30)
      data = r.data || []
    }
    setRegistros(data)
    setLoadingRegistros(false)
  }

  async function eliminar(tabla, id) {
    if (!confirm('¿Estás seguro que deseas eliminar este registro? Esta acción no se puede deshacer.')) return
    setEliminando(id)
    await supabase.from(tabla).delete().eq('id', id)
    setRegistros(prev => prev.filter(r => r.id !== id))
    if (tabla === 'ventas') cargarDatos()
    if (tabla === 'facturas') cargarFacturasResumen()
    setEliminando(null)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const totalAyer = Object.values(resumen).reduce((s, v) => s + v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos, 0)
  const totalGalonesAyer = Object.values(resumen).reduce((s, v) => s + v.regular_litros + v.premium_litros + v.diesel_litros + v.diesel_plus_litros, 0)
  const totalMensual = Object.values(mensual).reduce((s, m) => s + m.ingresos, 0)
  const totalGalonesMes = Object.values(mensual).reduce((s, m) => s + m.galones, 0)
  const estacionesConAlerta = estaciones.filter(e => facturas[e.id]?.vencida > 0).length
  const totalFacturasPendientes = Object.values(facturas).reduce((s, f) => s + f.total, 0)
  const reportaronAyer = estaciones.filter(e => resumen[e.id]).length
  const mesActual = new Date().toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
  const diasTranscurridos = new Date().getDate() - 1

  return (
    <Layout perfil={perfil} estacion={null}>
      <div className="p-6">

        {vistaDetalle && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => { setVistaDetalle(null); setEstacionSeleccionada(null) }}
                className="text-sm text-blue-600 hover:text-blue-800">← Volver</button>
              <h2 className="text-base font-medium text-gray-900">
                {vistaDetalle.charAt(0).toUpperCase() + vistaDetalle.slice(1)} — {estacionSeleccionada?.nombre}
              </h2>
            </div>
            {loadingRegistros ? (
              <div className="text-sm text-gray-400 py-4">Cargando registros...</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {registros.length === 0 && (
                  <div className="px-5 py-6 text-center text-xs text-gray-400">Sin registros</div>
                )}
                {vistaDetalle === 'ventas' && registros.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Regular (gal)</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Super (gal)</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Diesel (gal)</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">V-Power (gal)</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Total Q</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(v => {
                        const total = v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos
                        return (
                          <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">{v.fecha}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.regular_litros).toLocaleString('es-GT')}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.premium_litros).toLocaleString('es-GT')}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.diesel_litros).toLocaleString('es-GT')}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.diesel_plus_litros).toLocaleString('es-GT')}</td>
                            <td className="px-3 py-3 text-right font-medium text-gray-800">Q{Math.round(total).toLocaleString('es-GT')}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => eliminar('ventas', v.id)} disabled={eliminando === v.id}
                                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
                                {eliminando === v.id ? '...' : 'Eliminar'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {vistaDetalle === 'entregas' && registros.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Proveedor</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Combustible</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Galones</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Costo Q</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(e => (
                        <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{e.fecha_entrega}</td>
                          <td className="px-3 py-3 text-gray-600">{e.proveedor}</td>
                          <td className="px-3 py-3 text-gray-600 capitalize">{e.tipo_combustible.replace('_', ' ')}</td>
                          <td className="px-3 py-3 text-right text-gray-700">{parseFloat(e.volumen_litros).toLocaleString('es-GT')}</td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800">Q{Math.round(e.costo_total).toLocaleString('es-GT')}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => eliminar('entregas', e.id)} disabled={eliminando === e.id}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
                              {eliminando === e.id ? '...' : 'Eliminar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {vistaDetalle === 'facturas' && registros.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Factura</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Proveedor</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Emisión</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Vencimiento</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Monto Q</th>
                        <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(f => (
                        <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{f.numero_factura}</td>
                          <td className="px-3 py-3 text-gray-600">{f.proveedor}</td>
                          <td className="px-3 py-3 text-gray-600">{f.fecha_emision}</td>
                          <td className="px-3 py-3 text-gray-600">{f.fecha_vencimiento}</td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800">Q{Math.round(f.monto).toLocaleString('es-GT')}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.estado === 'pagada' ? 'bg-green-50 text-green-700' : f.estado === 'vencida' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                              {f.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => eliminar('facturas', f.id)} disabled={eliminando === f.id}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">
                              {eliminando === f.id ? '...' : 'Eliminar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {!vistaDetalle && (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Panel general</h1>
                <p className="text-sm text-gray-400">{new Date().toLocaleDateString('es-GT', { dateStyle: 'long' })}</p>
              </div>
              <div className="flex items-center gap-3">
                {ultimaActualizacion && <span className="text-xs text-gray-400">Actualizado: {ultimaActualizacion}</span>}
                <button onClick={() => { cargarDatos(); cargarFacturasResumen() }}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  Actualizar ahora
                </button>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs text-green-700 font-medium">Auto {segundos}s</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Ayer</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Ingresos red</div>
                <div className="text-2xl font-medium text-gray-900">Q{Math.round(totalAyer).toLocaleString('es-GT')}</div>
                <div className="text-xs text-gray-400 mt-1">{reportaronAyer} de {estaciones.length} reportaron</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Galones vendidos</div>
                <div className="text-2xl font-medium text-gray-900">{Math.round(totalGalonesAyer).toLocaleString('es-GT')}</div>
                <div className="text-xs text-gray-400 mt-1">Red completa</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Estaciones con alerta</div>
                <div className={`text-2xl font-medium ${estacionesConAlerta > 0 ? 'text-red-600' : 'text-gray-900'}`}>{estacionesConAlerta}</div>
                <div className="text-xs text-gray-400 mt-1">{estacionesConAlerta > 0 ? 'Facturas vencidas' : 'Sin alertas'}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Total por cobrar</div>
                <div className="text-2xl font-medium text-gray-900">Q{Math.round(totalFacturasPendientes).toLocaleString('es-GT')}</div>
                <div className="text-xs text-gray-400 mt-1">Pendiente + vencido</div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide capitalize">{mesActual}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Ingresos del mes</div>
                <div className="text-2xl font-medium text-blue-800">Q{Math.round(totalMensual).toLocaleString('es-GT')}</div>
                <div className="text-xs text-blue-400 mt-1">Acumulado red</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Galones del mes</div>
                <div className="text-2xl font-medium text-blue-800">{Math.round(totalGalonesMes).toLocaleString('es-GT')}</div>
                <div className="text-xs text-blue-400 mt-1">Acumulado red</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Días registrados</div>
                <div className="text-2xl font-medium text-blue-800">{diasTranscurridos}</div>
                <div className="text-xs text-blue-400 mt-1">Días transcurridos</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs text-blue-600 mb-1">Promedio diario</div>
                <div className="text-2xl font-medium text-blue-800">
                  {diasTranscurridos > 0 ? `Q${Math.round(totalMensual / diasTranscurridos).toLocaleString('es-GT')}` : '—'}
                </div>
                <div className="text-xs text-blue-400 mt-1">Por día red completa</div>
              </div>
            </div>

            <div className="flex gap-1 mb-4 border-b border-gray-100">
              {[['ayer', 'Ventas de ayer'], ['mensual', 'Acumulado mensual'], ['gestionar', 'Gestionar registros'], ['facturas', 'Facturas pendientes']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'ayer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {estaciones.map(est => {
                  const v = resumen[est.id]
                  const total = v ? v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos : 0
                  const galones = v ? v.regular_litros + v.premium_litros + v.diesel_litros + v.diesel_plus_litros : 0
                  const tieneAlerta = facturas[est.id]?.vencida > 0
                  return (
                    <div key={est.id} className={`bg-white rounded-xl border p-4 ${tieneAlerta ? 'border-l-4 border-l-red-400 border-gray-100' : 'border-gray-100'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-sm font-medium text-gray-800">{est.nombre}</div>
                        {tieneAlerta && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Alerta</span>}
                        {!tieneAlerta && v && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Reportó</span>}
                        {!v && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Sin reporte</span>}
                      </div>
                      <div className="text-xs text-gray-400 mb-2">{est.zona}</div>
                      <div className="text-xl font-medium text-gray-900 mb-1">{v ? `Q${Math.round(total).toLocaleString('es-GT')}` : '—'}</div>
                      <div className="text-xs text-gray-400">{v ? `${Math.round(galones).toLocaleString('es-GT')} gal vendidos` : 'Sin registro ayer'}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'mensual' && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Ingresos mes</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Galones mes</th>
                      <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">Promedio diario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estaciones.map(est => {
                      const m = mensual[est.id]
                      return (
                        <tr key={est.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-800">{est.nombre}</td>
                          <td className="px-3 py-3 text-right text-gray-800 font-medium">
                            {m ? `Q${Math.round(m.ingresos).toLocaleString('es-GT')}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600">
                            {m ? Math.round(m.galones).toLocaleString('es-GT') : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-500">
                            {m && diasTranscurridos > 0 ? `Q${Math.round(m.ingresos / diasTranscurridos).toLocaleString('es-GT')}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-blue-50">
                      <td className="px-5 py-3 font-medium text-blue-800">Total red</td>
                      <td className="px-3 py-3 text-right font-medium text-blue-800">Q{Math.round(totalMensual).toLocaleString('es-GT')}</td>
                      <td className="px-3 py-3 text-right font-medium text-blue-800">{Math.round(totalGalonesMes).toLocaleString('es-GT')}</td>
                      <td className="px-5 py-3 text-right font-medium text-blue-800">
                        {diasTranscurridos > 0 ? `Q${Math.round(totalMensual / diasTranscurridos).toLocaleString('es-GT')}` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'gestionar' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 mb-3">Selecciona una estación y el tipo de registro para ver y eliminar entradas.</p>
                {estaciones.map(est => (
                  <div key={est.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{est.nombre}</div>
                      <div className="text-xs text-gray-400">{est.zona}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => abrirDetalle(est, 'ventas')}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Ventas</button>
                      <button onClick={() => abrirDetalle(est, 'entregas')}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Entregas</button>
                      <button onClick={() => abrirDetalle(est, 'facturas')}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Facturas</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'facturas' && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Pendientes</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Vencidas</th>
                      <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">Total Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estaciones.filter(e => facturas[e.id]).length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-6 text-center text-xs text-gray-400">No hay facturas pendientes en la red</td></tr>
                    )}
                    {estaciones.filter(e => facturas[e.id]).map(est => (
                      <tr key={est.id} className={`border-b border-gray-50 ${facturas[est.id]?.vencida > 0 ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-3 font-medium text-gray-800">{est.nombre}</td>
                        <td className="px-3 py-3 text-right text-amber-600">{facturas[est.id]?.pendiente || 0}</td>
                        <td className="px-3 py-3 text-right text-red-600 font-medium">{facturas[est.id]?.vencida || 0}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-800">Q{Math.round(facturas[est.id]?.total || 0).toLocaleString('es-GT')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
