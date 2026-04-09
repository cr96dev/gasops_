import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Admin({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [resumen, setResumen] = useState({})
  const [facturas, setFacturas] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hoy')
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)

  const cargarVentas = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: ventas } = await supabase.from('ventas').select('*').eq('fecha', today)
    const ventasMap = {}
    ;(ventas || []).forEach(v => { ventasMap[v.estacion_id] = v })
    setResumen(ventasMap)
    setUltimaActualizacion(new Date().toLocaleTimeString('es-GT'))
  }, [])

  const cargarFacturas = useCallback(async () => {
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
      await cargarVentas()
      await cargarFacturas()
      setLoading(false)
    }
    init()
  }, [session])

  useEffect(() => {
    if (!perfil) return
    const channel = supabase
      .channel('ventas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => {
        cargarVentas()
      })
      .subscribe()
    const channelF = supabase
      .channel('facturas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => {
        cargarFacturas()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(channelF)
    }
  }, [perfil, cargarVentas, cargarFacturas])

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const totalHoy = Object.values(resumen).reduce((s, v) => s + v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos, 0)
  const totalGalones = Object.values(resumen).reduce((s, v) => s + v.regular_litros + v.premium_litros + v.diesel_litros + v.diesel_plus_litros, 0)
  const estacionesConAlerta = estaciones.filter(e => facturas[e.id]?.vencida > 0).length
  const totalFacturasPendientes = Object.values(facturas).reduce((s, f) => s + f.total, 0)
  const reportaron = estaciones.filter(e => resumen[e.id]).length

  return (
    <Layout perfil={perfil} estacion={null}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Panel general</h1>
            <p className="text-sm text-gray-400">{new Date().toLocaleDateString('es-GT', { dateStyle: 'long' })}</p>
          </div>
          <div className="flex items-center gap-3">
            {ultimaActualizacion && (
              <span className="text-xs text-gray-400">Actualizado: {ultimaActualizacion}</span>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-green-700 font-medium">En vivo</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Ingresos red hoy</div>
            <div className="text-2xl font-medium text-gray-900">Q{Math.round(totalHoy).toLocaleString('es-GT')}</div>
            <div className="text-xs text-gray-400 mt-1">{reportaron} de {estaciones.length} reportaron</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Galones vendidos hoy</div>
            <div className="text-2xl font-medium text-gray-900">{Math.round(totalGalones).toLocaleString('es-GT')}</div>
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

        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {[['hoy', 'Ventas de hoy'], ['facturas', 'Facturas pendientes']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'hoy' && (
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
                    {!v && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Pendiente</span>}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">{est.zona}</div>
                  <div className="text-xl font-medium text-gray-900 mb-1">{v ? `Q${Math.round(total).toLocaleString('es-GT')}` : '—'}</div>
                  <div className="text-xs text-gray-400">{v ? `${Math.round(galones).toLocaleString('es-GT')} gal vendidos` : 'Sin registro hoy'}</div>
                </div>
              )
            })}
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
      </div>
    </Layout>
  )
}
