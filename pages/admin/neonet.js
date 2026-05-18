// pages/admin/neonet.js
// Vista de auditoría de consumos Neonet procesados automáticamente
// Solo admins.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const AUTHORIZED_EMAILS = ['adoffice569@gmail.com', 'estacionesdeservicioguatemala@gmail.com']

function formatQ(n) {
  return 'Q' + parseFloat(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getHaceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

function getHoy() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

export default function AdminNeonet() {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)

  const [fechaInicio, setFechaInicio] = useState(getHaceNDias(7))
  const [fechaFin, setFechaFin] = useState(getHoy())
  const [estacionFiltro, setEstacionFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [soloDiscrepancias, setSoloDiscrepancias] = useState(false)

  const [estaciones, setEstaciones] = useState([])
  const [consumos, setConsumos] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/'); return }
      if (!AUTHORIZED_EMAILS.includes(session.user.email)) {
        router.push('/dashboard')
        return
      }

      const { data: p } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, rol, estacion_id, estaciones(*)')
        .eq('id', session.user.id)
        .single()
      setPerfil(p)
      setEstacion(p?.estaciones || null)

      const { data: ests } = await supabase
        .from('estaciones')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre')
      setEstaciones(ests || [])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!loading) cargarConsumos()
  }, [loading, fechaInicio, fechaFin, estacionFiltro, estadoFiltro])

  async function cargarConsumos() {
    setCargando(true)
    let q = supabase
      .from('neonet_consumos')
      .select(`
        id, afiliacion_codigo, fecha_consumo, total_q, variante, estado,
        valor_anterior, valor_nuevo, diferencia, error_msg, pdf_filename, procesado_en,
        estacion_id, estaciones:estacion_id (nombre)
      `)
      .gte('fecha_consumo', fechaInicio)
      .lte('fecha_consumo', fechaFin)
      .order('fecha_consumo', { ascending: false })
      .order('procesado_en', { ascending: false })
      .limit(500)

    if (estacionFiltro) q = q.eq('estacion_id', estacionFiltro)
    if (estadoFiltro) q = q.eq('estado', estadoFiltro)

    const { data } = await q
    setConsumos(data || [])
    setCargando(false)
  }

  // Filtros derivados
  const filtrados = soloDiscrepancias
    ? consumos.filter(c => c.diferencia !== null && Math.abs(parseFloat(c.diferencia || 0)) > 0.01)
    : consumos

  // Resumen
  const resumen = filtrados.reduce((acc, c) => {
    acc.total += parseFloat(c.total_q || 0)
    if (c.estado === 'aplicado') acc.aplicados++
    if (c.estado === 'fallido') acc.fallidos++
    if (c.estado === 'sin_venta_destino') acc.pendientes++
    if (c.diferencia !== null && Math.abs(parseFloat(c.diferencia || 0)) > 0.01) acc.discrepancias++
    return acc
  }, { total: 0, aplicados: 0, fallidos: 0, pendientes: 0, discrepancias: 0 })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 text-sm">Cargando...</div>
    </div>
  )
  if (!perfil) return null

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Auditoría Neonet</h1>
          <p className="text-sm text-gray-400">Consumos procesados automáticamente desde emails de Neonet</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Desde</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hasta</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estación</label>
              <select value={estacionFiltro} onChange={e => setEstacionFiltro(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                <option value="">Todas</option>
                {estaciones.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estado</label>
              <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                <option value="">Todos</option>
                <option value="aplicado">Aplicado</option>
                <option value="sin_venta_destino">Sin venta destino</option>
                <option value="fallido">Fallido</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="checkbox" id="solo-disc" checked={soloDiscrepancias}
              onChange={e => setSoloDiscrepancias(e.target.checked)}
              className="rounded" />
            <label htmlFor="solo-disc" className="text-xs text-gray-600 cursor-pointer">
              Solo mostrar discrepancias (PDF ≠ manual)
            </label>
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-xs text-blue-600 mb-0.5">Total Neonet</div>
            <div className="text-base font-semibold text-blue-800">{formatQ(resumen.total)}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-xs text-green-600 mb-0.5">Aplicados</div>
            <div className="text-base font-semibold text-green-800">{resumen.aplicados}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <div className="text-xs text-amber-600 mb-0.5">Sin venta destino</div>
            <div className="text-base font-semibold text-amber-800">{resumen.pendientes}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <div className="text-xs text-red-600 mb-0.5">Fallidos</div>
            <div className="text-base font-semibold text-red-800">{resumen.fallidos}</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3">
            <div className="text-xs text-orange-600 mb-0.5">Discrepancias</div>
            <div className="text-base font-semibold text-orange-800">{resumen.discrepancias}</div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              {filtrados.length} consumos{soloDiscrepancias ? ' con discrepancia' : ''}
            </h2>
            {cargando && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
          </div>
          {filtrados.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              {cargando ? 'Cargando...' : 'Sin consumos para los filtros aplicados'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                    <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                    <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Afiliación</th>
                    <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Variante</th>
                    <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">PDF</th>
                    <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Manual</th>
                    <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Diferencia</th>
                    <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(c => {
                    const dif = c.diferencia !== null ? parseFloat(c.diferencia) : null
                    const tieneDif = dif !== null && Math.abs(dif) > 0.01
                    return (
                      <tr key={c.id} className={`border-b border-gray-50 ${tieneDif ? 'bg-orange-50/30' : ''}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{c.fecha_consumo}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{c.estaciones?.nombre || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{c.afiliacion_codigo}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {c.variante === 'neolink'
                            ? <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Neolink</span>
                            : <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Neonet</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-800 font-medium whitespace-nowrap">{formatQ(c.total_q)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">
                          {c.valor_anterior !== null ? formatQ(c.valor_anterior) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right whitespace-nowrap ${tieneDif ? 'text-orange-700 font-medium' : 'text-gray-400'}`}>
                          {dif !== null ? (Math.abs(dif) < 0.01 ? '✓' : (dif > 0 ? '+' : '') + formatQ(dif)) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <BadgeEstado estado={c.estado} errorMsg={c.error_msg} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Datos sincronizados automáticamente desde emails de Neonet cada hora
        </p>
      </div>
    </Layout>
  )
}

function BadgeEstado({ estado, errorMsg }) {
  const config = {
    aplicado: { bg: 'bg-green-50', text: 'text-green-700', label: 'Aplicado' },
    sin_venta_destino: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Sin venta destino' },
    fallido: { bg: 'bg-red-50', text: 'text-red-700', label: 'Fallido' },
    pendiente: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Pendiente' }
  }
  const c = config[estado] || config.pendiente
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full ${c.bg} ${c.text}`} title={errorMsg || ''}>
      {c.label}
    </span>
  )
}
