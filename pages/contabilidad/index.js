import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const TIPO_COLOR = {
  venta_combustible: 'bg-green-50 text-green-700',
  venta_lubricantes: 'bg-emerald-50 text-emerald-700',
  venta_tienda: 'bg-teal-50 text-teal-700',
  compra_fel: 'bg-blue-50 text-blue-700',
  pago_proveedor: 'bg-purple-50 text-purple-700',
  cobro_cliente: 'bg-pink-50 text-pink-700',
  deposito_bancario: 'bg-indigo-50 text-indigo-700',
  ajuste_manual: 'bg-yellow-50 text-yellow-700',
  ajuste_inventario: 'bg-orange-50 text-orange-700',
  cierre_mensual: 'bg-gray-100 text-gray-700',
  apertura: 'bg-gray-100 text-gray-700',
}

const TIPO_LABEL = {
  venta_combustible: '⛽ Venta combustible',
  venta_lubricantes: '🛢 Venta lubricantes',
  venta_tienda: '🛒 Venta tienda',
  compra_fel: '🧾 Compra FEL',
  pago_proveedor: '💸 Pago proveedor',
  cobro_cliente: '💰 Cobro cliente',
  deposito_bancario: '🏦 Depósito',
  ajuste_manual: '✏️ Ajuste manual',
  ajuste_inventario: '📦 Ajuste inventario',
  cierre_mensual: '🔒 Cierre mensual',
  apertura: '🚀 Apertura',
}

function fmt(n) {
  const v = parseFloat(n || 0)
  return v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getPrimerDiaMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getHoy() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

export default function CentroContable({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('asientos')
  
  const [fechaInicio, setFechaInicio] = useState(getPrimerDiaMes())
  const [fechaFin, setFechaFin] = useState(getHoy())
  
  const [asientos, setAsientos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [estaciones, setEstaciones] = useState([])
  const [filtroEstacion, setFiltroEstacion] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('')
  const [asientoDetalle, setAsientoDetalle] = useState(null)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    async function init() {
      const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
      if (!p || p.rol !== 'admin') { router.push('/dashboard'); return }
      setPerfil(p)
      setEstacion(p.estaciones)
      const { data: ests } = await supabase.from('estaciones').select('id, nombre').order('nombre')
      setEstaciones(ests || [])
      const { data: c } = await supabase.from('cuentas_contables').select('id, codigo, nombre, tipo, naturaleza, es_de_movimiento').eq('activa', true).order('codigo')
      setCuentas(c || [])
      setLoading(false)
    }
    init()
  }, [session])

  // Cargar asientos según filtros
  useEffect(() => {
    if (loading) return
    cargarAsientos()
  }, [loading, fechaInicio, fechaFin, filtroEstacion, filtroTipo, filtroEstado])

  async function cargarAsientos() {
    let q = supabase.from('asientos_contables')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('numero', { ascending: false })
      .limit(500)
    if (filtroEstacion) q = q.eq('estacion_id', filtroEstacion)
    if (filtroTipo) q = q.eq('tipo', filtroTipo)
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    const { data } = await q
    setAsientos(data || [])
  }

  // Cargar movimientos para mayor / balanza / ER
  useEffect(() => {
    if (loading) return
    cargarMovimientos()
  }, [loading, fechaInicio, fechaFin, filtroEstacion])

  async function cargarMovimientos() {
    let q = supabase.from('asientos_lineas')
      .select('debito, credito, cuenta_id, estacion_id, asiento:asiento_id(fecha, estado, tipo)')
      .limit(10000)
    const { data } = await q
    if (data) {
      const filtrados = data.filter(l => {
        if (!l.asiento) return false
        if (l.asiento.fecha < fechaInicio || l.asiento.fecha > fechaFin) return false
        if (l.asiento.estado === 'anulado') return false
        if (filtroEstacion && l.estacion_id !== filtroEstacion) return false
        return true
      })
      setMovimientos(filtrados)
    }
  }

  // KPIs ejecutivos
  const kpis = useMemo(() => {
    const ingresos = movimientos.filter(m => {
      const c = cuentas.find(c => c.id === m.cuenta_id)
      return c && c.tipo === 'ingreso'
    }).reduce((s, m) => s + parseFloat(m.credito || 0) - parseFloat(m.debito || 0), 0)
    
    const cogs = movimientos.filter(m => {
      const c = cuentas.find(c => c.id === m.cuenta_id)
      return c && c.tipo === 'cogs'
    }).reduce((s, m) => s + parseFloat(m.debito || 0) - parseFloat(m.credito || 0), 0)
    
    const gastos = movimientos.filter(m => {
      const c = cuentas.find(c => c.id === m.cuenta_id)
      return c && c.tipo === 'gasto'
    }).reduce((s, m) => s + parseFloat(m.debito || 0) - parseFloat(m.credito || 0), 0)
    
    const caja = movimientos.filter(m => {
      const c = cuentas.find(c => c.id === m.cuenta_id)
      return c && (c.codigo.startsWith('1101') || c.codigo.startsWith('1102'))
    }).reduce((s, m) => s + parseFloat(m.debito || 0) - parseFloat(m.credito || 0), 0)
    
    const utilidad = ingresos - cogs - gastos
    const margen = ingresos > 0 ? (utilidad / ingresos * 100) : 0
    
    return { ingresos, cogs, gastos, utilidad, margen, caja }
  }, [movimientos, cuentas])

  // Mayor general (filtrar por cuenta seleccionada)
  const mayor = useMemo(() => {
    if (!cuentaSeleccionada) return []
    return movimientos
      .filter(m => m.cuenta_id === cuentaSeleccionada)
      .sort((a, b) => (a.asiento?.fecha || '').localeCompare(b.asiento?.fecha || ''))
  }, [movimientos, cuentaSeleccionada])

  // Balanza de comprobación
  const balanza = useMemo(() => {
    const map = {}
    movimientos.forEach(m => {
      const c = cuentas.find(c => c.id === m.cuenta_id)
      if (!c) return
      if (!map[c.id]) map[c.id] = { ...c, debitos: 0, creditos: 0 }
      map[c.id].debitos += parseFloat(m.debito || 0)
      map[c.id].creditos += parseFloat(m.credito || 0)
    })
    return Object.values(map)
      .map(c => ({
        ...c,
        saldo: c.naturaleza === 'D' ? c.debitos - c.creditos : c.creditos - c.debitos
      }))
      .filter(c => c.debitos > 0 || c.creditos > 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [movimientos, cuentas])

  // Estado de Resultados
  const estadoResultados = useMemo(() => {
    const ingresos = balanza.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + c.saldo, 0)
    const cogs = balanza.filter(c => c.tipo === 'cogs').reduce((s, c) => s + c.saldo, 0)
    const gastos = balanza.filter(c => c.tipo === 'gasto').reduce((s, c) => s + c.saldo, 0)
    const utilidadBruta = ingresos - cogs
    const utilidadNeta = utilidadBruta - gastos
    const margenBruto = ingresos > 0 ? (utilidadBruta / ingresos * 100) : 0
    const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos * 100) : 0
    return {
      ingresos, cogs, gastos, utilidadBruta, utilidadNeta, margenBruto, margenNeto,
      ingresoLineas: balanza.filter(c => c.tipo === 'ingreso' && c.es_de_movimiento),
      cogsLineas: balanza.filter(c => c.tipo === 'cogs' && c.es_de_movimiento),
      gastoLineas: balanza.filter(c => c.tipo === 'gasto' && c.es_de_movimiento),
    }
  }, [balanza])

  // Flujo de efectivo (simplificado)
  const flujo = useMemo(() => {
    const cajaBancos = balanza.filter(c => c.codigo.startsWith('1101') || c.codigo.startsWith('1102'))
    const entradas = cajaBancos.reduce((s, c) => s + c.debitos, 0)
    const salidas = cajaBancos.reduce((s, c) => s + c.creditos, 0)
    const neto = entradas - salidas
    return {
      entradas, salidas, neto,
      cuentas: cajaBancos.sort((a, b) => b.saldo - a.saldo)
    }
  }, [balanza])

  function tipoLabel(t) { return TIPO_LABEL[t] || t }
  function tipoColor(t) { return TIPO_COLOR[t] || 'bg-gray-100 text-gray-700' }
  function estacionNombre(id) { return estaciones.find(e => e.id === id)?.nombre || '—' }

  async function verDetalle(asiento) {
    setAsientoDetalle({ ...asiento, lineas: [] })
    const { data } = await supabase.from('asientos_lineas')
      .select('*, cuenta:cuenta_id(codigo, nombre), estacion:estacion_id(nombre)')
      .eq('asiento_id', asiento.id)
      .order('orden')
    setAsientoDetalle({ ...asiento, lineas: data || [] })
  }

  async function generarAsientosFecha() {
    if (!confirm(`Generar asientos automáticos para el rango ${fechaInicio} a ${fechaFin}?`)) return
    
    const { error: e1 } = await supabase.rpc('generar_asientos_rango', {
      p_desde: fechaInicio,
      p_hasta: fechaFin
    })
    if (e1) {
      // Si no existe RPC, hacemos individual via SQL editor manualmente
      alert('Función RPC no disponible aún. Genera asientos manualmente desde el SQL editor.')
      return
    }
    cargarAsientos()
    cargarMovimientos()
    alert('Asientos generados')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <span>Contabilidad</span><span>›</span><span>Centro contable</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Centro contable</h1>
            <p className="text-sm text-gray-500 mt-1">Período {fechaInicio} a {fechaFin}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/contabilidad/cuentas" className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">📚 Catálogo</a>
            <button onClick={cargarAsientos} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">↻ Refrescar</button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Ingresos</div>
            <div className="text-xl font-bold text-gray-900 mt-1">Q {fmt(kpis.ingresos)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Costo Ventas</div>
            <div className="text-xl font-bold text-orange-600 mt-1">Q {fmt(kpis.cogs)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Gastos</div>
            <div className="text-xl font-bold text-red-600 mt-1">Q {fmt(kpis.gastos)}</div>
          </div>
          <div className="bg-white border-2 border-green-300 rounded-xl p-4 bg-green-50">
            <div className="text-xs text-green-700 uppercase font-semibold">Utilidad</div>
            <div className="text-xl font-bold text-green-700 mt-1">Q {fmt(kpis.utilidad)}</div>
            <div className="text-xs text-green-600">Margen {kpis.margen.toFixed(1)}%</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Caja + Bancos</div>
            <div className="text-xl font-bold text-blue-700 mt-1">Q {fmt(kpis.caja)}</div>
          </div>
        </div>

        {/* Filtros globales */}
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm" />
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm" />
            <select value={filtroEstacion} onChange={e => setFiltroEstacion(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="">Todas las estaciones</option>
              {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="">Todos los tipos</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="border-b border-gray-100 px-2 overflow-x-auto">
            <div className="flex gap-1">
              {[
                ['asientos', '📋 Asientos'],
                ['mayor', '📊 Mayor general'],
                ['balanza', '⚖️ Balanza'],
                ['er', '📈 Estado de Resultados'],
                ['flujo', '💰 Flujo de Efectivo'],
              ].map(([k, v]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${tab === k ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">

            {/* ASIENTOS */}
            {tab === 'asientos' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-500">
                    {asientos.length} asientos · 
                    Cuadrados: {asientos.filter(a => parseFloat(a.total_debito) === parseFloat(a.total_credito)).length}
                  </div>
                  <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white">
                    <option value="">Todos los estados</option>
                    <option value="borrador">🟡 Borrador</option>
                    <option value="confirmado">✅ Confirmado</option>
                    <option value="anulado">❌ Anulado</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-left">Estación</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {asientos.length === 0 ? (
                        <tr><td colSpan={8} className="py-8 text-center text-gray-400">No hay asientos en este período</td></tr>
                      ) : asientos.map(a => (
                        <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{a.numero_formatted}</td>
                          <td className="px-3 py-2">{a.fecha}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${tipoColor(a.tipo)}`}>{tipoLabel(a.tipo)}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 max-w-xs truncate" title={a.descripcion}>{a.descripcion}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{estacionNombre(a.estacion_id)}</td>
                          <td className="px-3 py-2 text-right font-medium">Q {fmt(a.total_debito)}</td>
                          <td className="px-3 py-2 text-center">
                            {a.estado === 'confirmado' && <span className="text-xs text-green-600">✅</span>}
                            {a.estado === 'borrador' && <span className="text-xs text-yellow-600">🟡</span>}
                            {a.estado === 'anulado' && <span className="text-xs text-red-600">❌</span>}
                          </td>
                          <td className="px-3 py-2"><button onClick={() => verDetalle(a)} className="text-xs text-blue-600 hover:underline">Ver</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* MAYOR */}
            {tab === 'mayor' && (
              <>
                <div className="mb-3">
                  <select value={cuentaSeleccionada} onChange={e => setCuentaSeleccionada(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                    <option value="">Selecciona una cuenta...</option>
                    {cuentas.filter(c => c.es_de_movimiento).map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                    ))}
                  </select>
                </div>
                {cuentaSeleccionada ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-right">Débito</th>
                          <th className="px-3 py-2 text-right">Crédito</th>
                          <th className="px-3 py-2 text-right">Saldo acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const c = cuentas.find(c => c.id === cuentaSeleccionada)
                          let saldo = 0
                          return mayor.map((m, i) => {
                            const d = parseFloat(m.debito || 0)
                            const cr = parseFloat(m.credito || 0)
                            saldo += c.naturaleza === 'D' ? (d - cr) : (cr - d)
                            return (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="px-3 py-2 text-gray-600">{m.asiento?.fecha}</td>
                                <td className="px-3 py-2 text-xs text-gray-500">{tipoLabel(m.asiento?.tipo)}</td>
                                <td className="px-3 py-2 text-right font-mono">{d > 0 ? fmt(d) : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono">{cr > 0 ? fmt(cr) : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(saldo)}</td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                    {mayor.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Sin movimientos para esta cuenta en el período</div>}
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400 text-sm">Selecciona una cuenta para ver sus movimientos</div>
                )}
              </>
            )}

            {/* BALANZA */}
            {tab === 'balanza' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Código</th>
                      <th className="px-3 py-2 text-left">Cuenta</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-right">Débitos</th>
                      <th className="px-3 py-2 text-right">Créditos</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanza.map(c => (
                      <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => { setCuentaSeleccionada(c.id); setTab('mayor') }}>
                        <td className="px-3 py-2 font-mono text-xs">{c.codigo}</td>
                        <td className="px-3 py-2">{c.nombre}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{c.tipo}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(c.debitos)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(c.creditos)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(c.saldo)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td colSpan={3} className="px-3 py-2">TOTALES</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(balanza.reduce((s, c) => s + c.debitos, 0))}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(balanza.reduce((s, c) => s + c.creditos, 0))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ESTADO DE RESULTADOS */}
            {tab === 'er' && (
              <div className="max-w-2xl mx-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200 font-semibold">
                      <td colSpan={2} className="py-2 text-green-700">INGRESOS</td>
                    </tr>
                    {estadoResultados.ingresoLineas.map(c => (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="py-1.5 pl-4 text-gray-700">{c.nombre}</td>
                        <td className="py-1.5 text-right font-mono">Q {fmt(c.saldo)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-gray-300 font-semibold">
                      <td className="py-2 pl-4">Total Ingresos</td>
                      <td className="py-2 text-right font-mono text-green-700">Q {fmt(estadoResultados.ingresos)}</td>
                    </tr>
                    
                    <tr className="border-b border-gray-200 font-semibold">
                      <td colSpan={2} className="py-2 pt-4 text-orange-700">(-) COSTO DE VENTAS</td>
                    </tr>
                    {estadoResultados.cogsLineas.map(c => (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="py-1.5 pl-4 text-gray-700">{c.nombre}</td>
                        <td className="py-1.5 text-right font-mono">Q {fmt(c.saldo)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-gray-300 font-semibold">
                      <td className="py-2 pl-4">Total COGS</td>
                      <td className="py-2 text-right font-mono text-orange-700">Q ({fmt(estadoResultados.cogs)})</td>
                    </tr>
                    
                    <tr className="border-b-2 border-gray-400 font-bold text-base bg-gray-50">
                      <td className="py-3 pl-4">UTILIDAD BRUTA</td>
                      <td className="py-3 text-right font-mono">Q {fmt(estadoResultados.utilidadBruta)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pl-4 text-xs text-gray-500">Margen bruto</td>
                      <td className="py-1 text-right text-xs text-gray-500">{estadoResultados.margenBruto.toFixed(1)}%</td>
                    </tr>
                    
                    {estadoResultados.gastoLineas.length > 0 && (
                      <>
                        <tr className="border-b border-gray-200 font-semibold">
                          <td colSpan={2} className="py-2 pt-4 text-red-700">(-) GASTOS DE OPERACIÓN</td>
                        </tr>
                        {estadoResultados.gastoLineas.map(c => (
                          <tr key={c.id} className="border-b border-gray-50">
                            <td className="py-1.5 pl-4 text-gray-700">{c.nombre}</td>
                            <td className="py-1.5 text-right font-mono">Q {fmt(c.saldo)}</td>
                          </tr>
                        ))}
                      </>
                    )}
                    
                    <tr className="border-b-2 border-gray-400 font-bold text-lg bg-green-50">
                      <td className="py-3 pl-4 text-green-900">UTILIDAD NETA</td>
                      <td className="py-3 text-right font-mono text-green-900">Q {fmt(estadoResultados.utilidadNeta)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pl-4 text-xs text-gray-500">Margen neto</td>
                      <td className="py-1 text-right text-xs text-gray-500">{estadoResultados.margenNeto.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
                
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  ⚠️ Este reporte se basa en asientos confirmados + borradores del período seleccionado.
                  Los gastos operativos (sueldos, energía, etc.) aparecerán cuando se cargue la planilla.
                  Los costos de combustible son estimados (Q31/Q33/Q26/Q27 por litro) — se ajustarán con PPC real post-cutover.
                </div>
              </div>
            )}

            {/* FLUJO DE EFECTIVO */}
            {tab === 'flujo' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-xs text-green-700 uppercase font-semibold">Entradas</div>
                    <div className="text-2xl font-bold text-green-700 mt-1">Q {fmt(flujo.entradas)}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-xs text-red-700 uppercase font-semibold">Salidas</div>
                    <div className="text-2xl font-bold text-red-700 mt-1">Q {fmt(flujo.salidas)}</div>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                    <div className="text-xs text-blue-700 uppercase font-semibold">Flujo neto</div>
                    <div className="text-2xl font-bold text-blue-700 mt-1">Q {fmt(flujo.neto)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Posición por cuenta de caja/banco</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Cuenta</th>
                          <th className="px-3 py-2 text-right">Entradas</th>
                          <th className="px-3 py-2 text-right">Salidas</th>
                          <th className="px-3 py-2 text-right">Saldo del período</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flujo.cuentas.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-gray-400">Sin movimientos de caja/banco</td></tr>
                        ) : flujo.cuentas.map(c => (
                          <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => { setCuentaSeleccionada(c.id); setTab('mayor') }}>
                            <td className="px-3 py-2">
                              <div className="text-xs font-mono text-gray-500">{c.codigo}</div>
                              <div className="text-sm">{c.nombre}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-green-600">{fmt(c.debitos)}</td>
                            <td className="px-3 py-2 text-right font-mono text-red-600">{fmt(c.creditos)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold">{fmt(c.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                  📝 Este es un flujo simplificado basado en movimientos de caja y bancos.
                  Una vez integrado bank feeds + conciliación, este reporte cumplirá NIC 7.
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Modal detalle asiento */}
      {asientoDetalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setAsientoDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="text-xs text-gray-400 font-mono">{asientoDetalle.numero_formatted}</div>
                <h2 className="text-base font-semibold text-gray-900">{asientoDetalle.descripcion}</h2>
                <div className="text-xs text-gray-500 mt-0.5">
                  {asientoDetalle.fecha} · {tipoLabel(asientoDetalle.tipo)} · {asientoDetalle.estado}
                </div>
              </div>
              <button onClick={() => setAsientoDetalle(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left py-2">Cuenta</th>
                    <th className="text-left py-2">Estación</th>
                    <th className="text-left py-2">Descripción</th>
                    <th className="text-right py-2">Débito</th>
                    <th className="text-right py-2">Crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {(asientoDetalle.lineas || []).map((l, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2">
                        <div className="text-xs font-mono text-gray-500">{l.cuenta?.codigo}</div>
                        <div>{l.cuenta?.nombre}</div>
                      </td>
                      <td className="py-2 text-xs text-gray-600">{l.estacion?.nombre || '—'}</td>
                      <td className="py-2 text-xs text-gray-600">{l.descripcion}</td>
                      <td className="py-2 text-right font-mono">{parseFloat(l.debito) > 0 ? fmt(l.debito) : '—'}</td>
                      <td className="py-2 text-right font-mono">{parseFloat(l.credito) > 0 ? fmt(l.credito) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                    <td colSpan={3} className="py-2">TOTAL</td>
                    <td className="py-2 text-right font-mono">Q {fmt(asientoDetalle.total_debito)}</td>
                    <td className="py-2 text-right font-mono">Q {fmt(asientoDetalle.total_credito)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 text-xs text-gray-500">
                {asientoDetalle.origen === 'automatico' && '🤖 Asiento generado automáticamente desde ' + (asientoDetalle.origen_tabla || 'sistema')}
                {asientoDetalle.origen === 'manual' && '✏️ Asiento creado manualmente'}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
