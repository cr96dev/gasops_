import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    if (!p || p.rol !== 'admin') { router.push('/dashboard'); return }
    setPerfil(p)

    const { data: ests } = await supabase.from('estaciones').select('*').eq('activa', true).order('nombre')
    setEstaciones(ests || [])

    const today = new Date().toISOString().split('T')[0]
    const { data: ventas } = await supabase.from('ventas').select('*').eq('fecha', today)
    const ventasMap = {}
    ;(ventas || []).forEach(v => { ventasMap[v.estacion_id] = v })
    setResumen(ventasMap)

    const { data: facts } = await supabase.from('facturas').select('estacion_id, estado, monto').in('estado', ['pendiente', 'vencida'])
    const factMap = {}
    ;(facts || []).forEach(f => {
      if (!factMap[f.estacion_id]) factMap[f.estacion_id] = { pendiente: 0, vencida: 0, total: 0 }
      factMap[f.estacion_id][f.estado] += 1
      factMap[f.estacion_id].total += parseFloat(f.monto)
    })
    setFacturas(factMap)

    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const totalHoy = Object.values(resumen).reduce((s, v) =>
    s + v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos, 0)
  const totalLitros = Object.values(resumen).reduce((s, v) =>
    s + v.regular_litros + v.premium_litros + v.diesel_litros + v.diesel_plus_litros, 0)
  const estacionesConAlerta = estaciones.filter(e => facturas[e.id]?.vencida > 0).length
  const totalFacturasPendientes = Object.values(facturas).reduce((s, f) => s + f.total, 0)

  return (
    <Layout perfil={perfil} estacion={null}>
      <div className="p-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Panel general</h1>
          <p className="text-sm text-gray-400">Todas las estaciones — {new Date().toLocaleDateString('es-GT', { dateStyle: 'long' })}</p>
        </div>

        {/* Network metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Ingresos red hoy', value: `Q${Math.round(totalHoy).toLocaleString('es-GT')}`, sub: `${estaciones.filter(e => resumen[e.id]).length} de ${estaciones.length} reportaron` },
            { label: 'Litros vendidos hoy', value: Math.round(totalLitros).toLocaleString('es-GT'), sub: 'Red completa' },
            { label: 'Estaciones con alerta', value: estacionesConAlerta, sub: estacionesConAlerta > 0 ? 'Facturas vencidas' : 'Sin alertas', alert: estacionesConAlerta > 0 },
            { label: 'Total por cobrar', value: `Q${Math.round(totalFacturasPendientes).toLocaleString('es-GT')}`, sub: 'Pendiente + vencido' },
          ].map((m, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{m.label}</div>
              <div className={`text-2xl font-medium ${m.alert ? 'text-red-600' : 'text-gray-900'}`}>{m.value}</div>
              <div className="text-xs text-gray-400 mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
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
              const litros = v ? v.regular_litros + v.premium_litros + v.diesel_litros + v.diesel_plus_litros : 0
              const tieneAlerta = facturas[est.id]?.vencida > 0
              return (
                <div key={est.id} className={`bg-white rounded-xl border p-4 ${tieneAlerta ? 'border-l-4 border-l-red-400 border-gray-100' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm font-medium text-gray-800">{est.nombre}</div>
                    {tieneAlerta && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Alerta</span>}
                    {!tieneAlerta && v && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Normal</span>}
                    {!v && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Sin datos</span>}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">{est.zona}</div>
                  <div className="text-xl font-medium text-gray-900 mb-1">
                    {v ? `Q${Math.round(total).toLocaleString('es-GT')}` : '—'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {v ? `${Math.round(litros).toLocaleString('es-GT')} L vendidos` : 'Sin registro hoy'}
                  </div>
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
