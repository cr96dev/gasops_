import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const PRODUCTOS_INVENTARIO = new Set([
  'LIQUIDO DE FRENOS', 'POWER STEERING 12 ONZAS', 'TP COOLANT 50/50 1 LITRO',
  'TP COOLANT 50/50 1 GALON', 'SHELL ADVANCE S2 DOS TT LITRO', 'SHELL ADVANCE AX5 4T 20W50 LITRO',
  'HELIX HX3 SAE 40 LITRO', 'HELIX HX8 5W-30 LITRO', 'HELIX HX5 20W-50 GALÓN',
  'HELIX HX5 20W-50 LITRO', 'HELIX HX7 SN 10W-30 AZUL GALÓN', 'HELIX HX7 SN 10W-30 AZUL LITRO',
  'RIMULA R4X 15W-40 GRIS GALÓN', 'RIMULA R4X 15W-40 GRIS LITRO', 'SHELL SPIRAX S5 ATF X',
  'UNO Ultra 10W-30 1 LITRO', 'UNO Ultra 10W-30 GALON', 'UNO Impulse 4T 20W-50 1 LITRO',
  'UNO Ultra 20W-50 1 LITRO', 'UNO Ultra 20W-50 1 GALON', 'UNO Ultra 40 1 LITRO',
  'UNO Ultra 40 1 GALON', 'UNO Synchron ATF 1 LITRO', 'TP Brake Fluid PINTA 12 OZ',
  'TP Power Steering F PINTA 12 OZ', 'UNO Forza 15W-40 1 LITRO', 'UNO Forza 50 1 LITRO',
  'UNO ULTRA FULL SYNT 5W-30', 'FORZA EURO SAE 5W-40 1 LITRO', 'UNO Impulse 2T LITRO',
  'HELIX HX3 SAE 40 GALÓN', 'HELIX HX3 25W-60 LITRO', 'HELIX HX3 25W-60 GALÓN',
  'HELIX ULTRA 5W-30 LITRO', 'HELIX ULTRA 5W-30 GALÓN', 'HELIX ULTRA 5W-40 LITRO',
  'HELIX ULTRA 5W-40 GALÓN', 'UNO Ultra 15W-40 1 GALON', 'REFRIGERANTE TOP GUARD',
  'SHELL SPIRAX S3 ATF MD3 LITRO', 'SHELL ADVANCE SAE 10W-40 ULTRA',
])

function getAyerGuatemala() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

function getHaceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

function formatQ(n) {
  return 'Q' + parseFloat(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Lubricantes({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ayer')
  const [ventasAyer, setVentasAyer] = useState([])
  const [cargandoAyer, setCargandoAyer] = useState(false)
  const [fechaInicio, setFechaInicio] = useState(getHaceNDias(30))
  const [fechaFin, setFechaFin] = useState(getAyerGuatemala())
  const [agrupacion, setAgrupacion] = useState('dia')
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [estacionId, setEstacionId] = useState(null)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    async function init() {
      const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
      if (!p) { router.push('/'); return }
      setPerfil(p)
      setEstacion(p.estaciones)
      setEstacionId(p.estacion_id)
      setLoading(false)
    }
    init()
  }, [session])

  useEffect(() => {
    if (!estacionId) return
    if (tab === 'ayer') cargarAyer(estacionId)
    if (tab === 'historial') cargarHistorial(estacionId, fechaInicio, fechaFin, agrupacion)
  }, [estacionId, tab])

  useEffect(() => {
    if (!estacionId || tab !== 'historial') return
    cargarHistorial(estacionId, fechaInicio, fechaFin, agrupacion)
  }, [fechaInicio, fechaFin, agrupacion])

  async function cargarAyer(eid) {
    setCargandoAyer(true)
    const ayer = getAyerGuatemala()
    console.log('cargarAyer - eid:', eid, 'ayer:', ayer)
    const { data, error } = await supabase
      .from('facturas_fel_items')
      .select('descripcion, cantidad, total')
      .eq('estacion_id', eid)
      .eq('fecha', ayer)
    console.log('resultado data:', data, 'error:', error)
    const mapa = {}
    for (const item of (data || [])) {
      if (!PRODUCTOS_INVENTARIO.has(item.descripcion)) continue
      if (!mapa[item.descripcion]) mapa[item.descripcion] = { descripcion: item.descripcion, cantidad: 0, total: 0 }
      mapa[item.descripcion].cantidad += parseFloat(item.cantidad) || 0
      mapa[item.descripcion].total += parseFloat(item.total) || 0
    }
    setVentasAyer(Object.values(mapa).sort((a, b) => b.total - a.total))
    setCargandoAyer(false)
  }

  async function cargarHistorial(eid, ini, fin, agrup) {
    setCargandoHistorial(true)
    const { data } = await supabase
      .from('facturas_fel_items')
      .select('descripcion, cantidad, total, fecha')
      .eq('estacion_id', eid)
      .gte('fecha', ini)
      .lte('fecha', fin)
      .order('fecha', { ascending: false })

    const filtrado = (data || []).filter(i => PRODUCTOS_INVENTARIO.has(i.descripcion))
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    const mapa = {}
    for (const item of filtrado) {
      let key, label
      if (agrup === 'dia') {
        key = item.fecha; label = item.fecha
      } else if (agrup === 'semana') {
        const d = new Date(item.fecha + 'T12:00:00')
        const inicio = new Date(d); inicio.setDate(d.getDate() - d.getDay())
        key = inicio.toLocaleDateString('en-CA')
        label = `Semana del ${inicio.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}`
      } else {
        key = item.fecha.substring(0, 7)
        const [y, m] = key.split('-')
        label = `${meses[parseInt(m)-1]} ${y}`
      }
      if (!mapa[key]) mapa[key] = { periodo: key, label, total: 0, cantidad: 0, items: {} }
      mapa[key].total += parseFloat(item.total) || 0
      mapa[key].cantidad += parseFloat(item.cantidad) || 0
      if (!mapa[key].items[item.descripcion]) mapa[key].items[item.descripcion] = { cantidad: 0, total: 0 }
      mapa[key].items[item.descripcion].cantidad += parseFloat(item.cantidad) || 0
      mapa[key].items[item.descripcion].total += parseFloat(item.total) || 0
    }
    setHistorial(Object.values(mapa).sort((a, b) => b.periodo.localeCompare(a.periodo)))
    setCargandoHistorial(false)
  }

  const totalAyer = ventasAyer.reduce((s, v) => s + v.total, 0)
  const unidadesAyer = ventasAyer.reduce((s, v) => s + v.cantidad, 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lubricantes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{estacion?.nombre} · Ventas desde Infile</p>
        </div>

        <div className="flex gap-1 border-b border-gray-100">
          {[['ayer', 'Ayer'], ['historial', 'Historial']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Ayer ── */}
        {tab === 'ayer' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-400 mb-1">Total vendido ayer</div>
                <div className="text-2xl font-bold text-gray-900">{formatQ(totalAyer)}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-400 mb-1">Unidades vendidas</div>
                <div className="text-2xl font-bold text-gray-900">{unidadesAyer.toLocaleString('es-GT')}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">Productos vendidos ayer — {getAyerGuatemala()}</h2>
                {cargandoAyer && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
              </div>
              {ventasAyer.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  {cargandoAyer ? 'Cargando...' : 'Sin ventas de lubricantes ayer'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Producto</th>
                      <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Cant.</th>
                      <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasAyer.map((v, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-5 py-3 text-gray-700 text-xs">{v.descripcion}</td>
                        <td className="px-3 py-3 text-center text-gray-600 text-xs">{parseFloat(v.cantidad).toLocaleString('es-GT')}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-800 text-xs">{formatQ(v.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td className="px-5 py-3 text-xs font-semibold text-gray-700">Total</td>
                      <td className="px-3 py-3 text-center text-xs font-semibold text-gray-700">{unidadesAyer.toLocaleString('es-GT')}</td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatQ(totalAyer)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center">Los datos se sincronizan automáticamente cada noche desde Infile</p>
          </>
        )}

        {/* ── Tab: Historial ── */}
        {tab === 'historial' && (
          <>
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Agrupar por</label>
                <div className="flex gap-2">
                  {[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([key, label]) => (
                    <button key={key} onClick={() => setAgrupacion(key)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${agrupacion === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {cargandoHistorial ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : historial.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">
                Sin ventas en el período seleccionado
              </div>
            ) : (
              <div className="space-y-2">
                {historial.map((h, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <button onClick={() => setDetalleAbierto(detalleAbierto === h.periodo ? null : h.periodo)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-800">{h.label || h.periodo}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{h.cantidad.toLocaleString('es-GT')} unidades</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">{formatQ(h.total)}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${detalleAbierto === h.periodo ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {detalleAbierto === h.periodo && (
                      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="text-left py-1 font-normal">Producto</th>
                              <th className="text-center py-1 font-normal w-16">Cant.</th>
                              <th className="text-right py-1 font-normal w-24">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(h.items)
                              .sort((a, b) => b[1].total - a[1].total)
                              .map(([nombre, datos], j) => (
                                <tr key={j} className="border-t border-gray-100">
                                  <td className="py-1.5 text-gray-700">{nombre}</td>
                                  <td className="py-1.5 text-center text-gray-500">{datos.cantidad.toLocaleString('es-GT')}</td>
                                  <td className="py-1.5 text-right font-medium text-gray-800">{formatQ(datos.total)}</td>
                                </tr>
                              ))}
                            <tr className="border-t border-gray-200">
                              <td className="py-2 font-semibold text-gray-700">Total</td>
                              <td className="py-2 text-center font-semibold text-gray-700">{h.cantidad.toLocaleString('es-GT')}</td>
                              <td className="py-2 text-right font-bold text-gray-900">{formatQ(h.total)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
