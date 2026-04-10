import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function MetricCard({ label, value, delta, deltaUp }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-medium text-gray-900">{value}</div>
      {delta && (
        <div className={`text-xs mt-1 ${deltaUp ? 'text-green-700' : 'text-red-600'}`}>{delta}</div>
      )}
    </div>
  )
}

function FuelBar({ label, pct, color }) {
  const colors = { blue: 'bg-blue-500', amber: 'bg-amber-500', green: 'bg-green-600', gray: 'bg-gray-400' }
  const statusColor = pct < 20 ? 'text-red-600' : pct < 40 ? 'text-amber-600' : 'text-green-700'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colors[color]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium w-8 text-right ${statusColor}`}>{pct}%</span>
    </div>
  )
}

export default function Dashboard({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [ventas, setVentas] = useState(null)
  const [facturasPendientes, setFacturasPendientes] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase
      .from('perfiles')
      .select('*, estaciones(*)')
      .eq('id', session.user.id)
      .single()

    if (!p) { setLoading(false); return }
    setPerfil(p)
    setEstacion(p.estaciones)

    if (p.rol === 'admin') { router.push('/admin'); return }

    const today = new Date().toISOString().split('T')[0]
    const { data: v } = await supabase
      .from('ventas')
      .select('*')
      .eq('estacion_id', p.estacion_id)
      .eq('fecha', today)
      .single()
    setVentas(v)

    const { count } = await supabase
      .from('facturas')
      .select('*', { count: 'exact', head: true })
      .eq('estacion_id', p.estacion_id)
      .in('estado', ['pendiente', 'vencida'])
    setFacturasPendientes(count || 0)

    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>
  if (!perfil) return null

  const totalLitros = ventas
    ? (ventas.regular_litros + ventas.premium_litros + ventas.diesel_litros + ventas.diesel_plus_litros)
    : 0
  const totalIngresos = ventas
    ? (ventas.regular_ingresos + ventas.premium_ingresos + ventas.diesel_ingresos + ventas.diesel_plus_ingresos)
    : 0

  const today = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">{estacion?.nombre}</h1>
          <p className="text-sm text-gray-400 capitalize">{today}</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Ingresos de hoy"
            value={ventas ? `Q${totalIngresos.toLocaleString('es-GT', { maximumFractionDigits: 0 })}` : '—'}
            delta={ventas ? 'Registrado' : 'Sin registro hoy'}
            deltaUp={!!ventas}
          />
          <MetricCard
            label="Galones vendidos"
            value={ventas ? totalLitros.toLocaleString('es-GT', { maximumFractionDigits: 0 }) : '—'}
            delta={ventas ? 'Total del día' : ''}
          />
          <MetricCard
            label="Facturas pendientes"
            value={facturasPendientes}
            delta={facturasPendientes > 0 ? 'Requieren atención' : 'Al día'}
            deltaUp={facturasPendientes === 0}
          />
          <MetricCard
            label="Estado"
            value="Activa"
            delta="4 bombas operativas"
            deltaUp={true}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fuel levels - static placeholder, in real app from inventory table */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Niveles de tanques</h2>
            <FuelBar label="Regular" pct={72} color="blue" />
            <FuelBar label="Super" pct={31} color="amber" />
            <FuelBar label="Diesel" pct={58} color="green" />
            <FuelBar label="V-Power" pct={12} color="gray" />
            <p className="text-xs text-gray-400 mt-3">* Actualizar manualmente en Inventario</p>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Acciones rápidas</h2>
            <div className="space-y-2">
              {[
                { label: 'Registrar ventas del día', href: '/ventas', color: 'blue' },
                { label: 'Actualizar inventario', href: '/inventario', color: 'gray' },
                { label: 'Registrar entrega de combustible', href: '/entregas', color: 'green' },
                { label: 'Subir factura', href: '/facturacion', color: 'gray' },
              ].map(a => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  {a.label} →
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
