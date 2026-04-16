import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'

// ── Constantes IGSS ────────────────────────────────────────────────────────
const PATRONAL   = 0.1067
const LABORAL    = 0.0483
const IRTRA      = 0.01
const INTECAP    = 0.01
const NUM_PATRONAL = '182548'
const NIT_PATRONO  = '103183841'
const NOMBRE_PAT   = 'HIDROCOM, SOCIEDAD ANONIMA'
const DIRECCION    = 'DIAG 6 12-42 EDIF D C T1 N9 OF902 Z10 G'
const EMAIL_PAT    = 'adoffice569@gmail.com'

const fmt  = n => 'Q' + Number(n||0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round = n => Math.round((n + Number.EPSILON) * 100) / 100

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function Spinner() {
  return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
}

// ── Calcular cuotas por empleado ────────────────────────────────────────────
function calcularCuotas(salario) {
  const sal = parseFloat(salario) || 0
  return {
    patronal: round(sal * PATRONAL),
    laboral:  round(sal * LABORAL),
    irtra:    round(sal * IRTRA),
    intecap:  round(sal * INTECAP),
    total:    round(sal * (PATRONAL + LABORAL + IRTRA + INTECAP)),
  }
}

// ── Vista DR-182-1 (mockup del recibo) ─────────────────────────────────────
function VistaRecibo({ datos }) {
  const { mes, anio, trabajadores, totalSalarios, cuotas } = datos
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 text-center">
        <div className="text-sm font-bold text-gray-800">INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</div>
        <div className="text-xs text-gray-600 mt-0.5">RECIBO DE CUOTAS DE PATRONOS Y DE TRABAJADORES — IMPUESTO IRTRA Y TASA INTECAP</div>
        <div className="text-xs font-bold text-gray-700 mt-1">DR-182-1</div>
      </div>

      {/* Datos patrono */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
          <div className="flex gap-2"><span className="text-gray-500 w-32">05 Número patronal:</span><span className="font-bold">{NUM_PATRONAL}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 w-32">06 Mes contribución:</span><span className="font-bold">{MESES[mes]}/{anio}</span></div>
          <div className="flex gap-2 col-span-2"><span className="text-gray-500 w-32">07 Nombre patrono:</span><span className="font-bold">{NOMBRE_PAT}</span></div>
          <div className="flex gap-2 col-span-2"><span className="text-gray-500 w-32">08 Dirección:</span><span>{DIRECCION}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 w-32">09 No. trabajadores:</span><span className="font-bold">{trabajadores}</span></div>
          <div className="flex gap-2"><span className="text-gray-500 w-32">10 Total salarios:</span><span className="font-bold">{fmt(totalSalarios)}</span></div>
        </div>
      </div>

      {/* Conceptos */}
      <div className="px-6 py-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-1 font-normal text-gray-500">CONCEPTOS</th>
              <th className="text-right py-1 font-normal text-gray-500">TOTALES</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: '13', label: 'Cuota de patronos', val: cuotas.patronal, bold: false },
              { n: '14', label: 'Cuota de trabajadores', val: cuotas.laboral, bold: false },
              { n: '15', label: 'Recargo por cuotas', val: 0 },
              { n: '16', label: 'Intereses resarcitorios por cuotas', val: 0 },
              { n: '17', label: 'Impuesto IRTRA', val: cuotas.irtra, bold: false },
              { n: '18', label: 'Recargo impuesto IRTRA', val: 0 },
              { n: '19', label: 'Intereses resarcitorios impuesto IRTRA', val: 0 },
              { n: '20', label: 'Tasa INTECAP', val: cuotas.intecap, bold: false },
              { n: '21', label: 'Recargo tasa INTECAP', val: 0 },
              { n: '22', label: 'Recargos administrativos', val: 0 },
            ].map(row => (
              <tr key={row.n} className="border-b border-gray-50">
                <td className="py-1.5 text-gray-700">{row.n} {row.label}</td>
                <td className={`py-1.5 text-right ${parseFloat(row.val) > 0 ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                  {fmt(row.val)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-800">
              <td className="py-2 font-bold text-gray-900">23 Total a pagar</td>
              <td className="py-2 text-right font-bold text-lg text-gray-900">{fmt(cuotas.total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 text-xs text-gray-500 italic border-t border-gray-100 pt-2">
          Total en letras: {cuotas.totalLetras}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-center">
        <div className="text-xs text-gray-500">Fecha de vencimiento: día 20 del mes siguiente</div>
        <div className="text-xs text-gray-400 mt-0.5">Banco Industrial, S.A. — Agencia Virtual</div>
      </div>
    </div>
  )
}

// ── Tabla de empleados con cuotas ─────────────────────────────────────────
function TablaEmpleados({ empleados }) {
  const [busqueda, setBusqueda] = useState('')
  const filtrados = empleados.filter(e =>
    !busqueda || e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.estacion?.toLowerCase().includes(busqueda.toLowerCase())
  )
  return (
    <div>
      <div className="mb-3">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar empleado o estación..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-gray-400 font-normal">Empleado</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-normal">No. IGSS</th>
                <th className="px-3 py-2.5 text-left text-gray-400 font-normal">Estación</th>
                <th className="px-3 py-2.5 text-right text-gray-400 font-normal">Sal. mensual</th>
                <th className="px-3 py-2.5 text-right text-gray-400 font-normal">Cuota patronal</th>
                <th className="px-3 py-2.5 text-right text-gray-400 font-normal">Cuota laboral</th>
                <th className="px-3 py-2.5 text-right text-gray-400 font-normal">IRTRA</th>
                <th className="px-3 py-2.5 text-right text-gray-400 font-normal">INTECAP</th>
                <th className="px-3 py-2.5 text-right text-gray-400 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e, i) => {
                const c = calcularCuotas(e.sal_mensual_igss)
                return (
                  <tr key={e.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2"><div className="font-medium text-gray-800">{e.nombre}</div><div className="text-gray-400">{e.puesto}</div></td>
                    <td className="px-3 py-2 text-gray-500">{e.numero_igss || <span className="text-amber-500">—</span>}</td>
                    <td className="px-3 py-2 text-gray-500">{e.estacion}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{fmt(e.sal_mensual_igss)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{fmt(c.patronal)}</td>
                    <td className="px-3 py-2 text-right text-purple-600">{fmt(c.laboral)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmt(c.irtra)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmt(c.intecap)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{fmt(c.total)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-700">{filtrados.length} empleados</td>
                <td className="px-3 py-3 text-right text-xs font-bold">{fmt(filtrados.reduce((s,e)=>s+(parseFloat(e.sal_mensual_igss)||0),0))}</td>
                <td className="px-3 py-3 text-right text-xs font-bold text-blue-600">{fmt(filtrados.reduce((s,e)=>s+calcularCuotas(e.sal_mensual_igss).patronal,0))}</td>
                <td className="px-3 py-3 text-right text-xs font-bold text-purple-600">{fmt(filtrados.reduce((s,e)=>s+calcularCuotas(e.sal_mensual_igss).laboral,0))}</td>
                <td className="px-3 py-3 text-right text-xs font-bold">{fmt(filtrados.reduce((s,e)=>s+calcularCuotas(e.sal_mensual_igss).irtra,0))}</td>
                <td className="px-3 py-3 text-right text-xs font-bold">{fmt(filtrados.reduce((s,e)=>s+calcularCuotas(e.sal_mensual_igss).intecap,0))}</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">{fmt(filtrados.reduce((s,e)=>s+calcularCuotas(e.sal_mensual_igss).total,0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Generar archivo TXT v2.2.0 ─────────────────────────────────────────────
function generarTXT(mes, anio, planillas, empleados) {
  const hoy = new Date()
  const dd = String(hoy.getDate()).padStart(2,'0')
  const mm = String(hoy.getMonth()+1).padStart(2,'0')
  const yyyy = hoy.getFullYear()
  const HH = String(hoy.getHours()).padStart(2,'0')
  const MM = String(hoy.getMinutes()).padStart(2,'0')
  const fechaGen = `${dd}/${mm}/${yyyy}`
  const fechaIni = `01/${String(mes).padStart(2,'0')}/${anio}`
  const diasMes  = new Date(anio, mes, 0).getDate()
  const fechaFin = `${diasMes}/${String(mes).padStart(2,'0')}/${anio}`
  const fecha15  = `15/${String(mes).padStart(2,'0')}/${anio}`
  const fecha16  = `16/${String(mes).padStart(2,'0')}/${anio}`

  const lines = []
  lines.push(`2.2.0|${fechaGen}|${NUM_PATRONAL}|${String(mes).padStart(2,'0')}|${anio}|${NOMBRE_PAT}|${NIT_PATRONO}|${EMAIL_PAT}|0`)
  lines.push('[Centros]')
  lines.push(`1|${NOMBRE_PAT}|${DIRECCION}|10|${NIT_PATRONO}|||${EMAIL_PAT}|1|1|452001`)
  lines.push('[TiposPlanilla]')
  lines.push('1|PLANILLA QUINCENAL|C|C|1|452001|N|TC')
  lines.push('[Liquidaciones]')
  lines.push(`1|1|${fechaIni}|${fecha15}|O|`)
  lines.push(`2|1|${fecha16}|${fechaFin}|O|`)
  lines.push('[Empleados]')

  empleados.forEach(e => {
    const salQ = round((parseFloat(e.sal_mensual_igss)||0) / 2)
    const cuotaLabQ = round(salQ * LABORAL)
    // Dividir nombre en partes
    const partes = e.nombre.replace(/,/g,' ').trim().split(/\s+/).filter(Boolean)
    const a1 = partes[0] || ''
    const a2 = partes[1] || ''
    const n1 = partes[2] || ''
    const n2 = partes[3] || ''
    const igssNum = e.numero_igss || ''
    for (const liq of ['1','2']) {
      lines.push(`${liq}|${igssNum}|${a1}|${a2}|${n1}|${n2}||${salQ}|${fechaIni}||1|${NIT_PATRONO}|0|P|${cuotaLabQ}|N|0|TC|15`)
    }
  })

  return lines.join('\n')
}

// ── Página principal ────────────────────────────────────────────────────────
export default function IGSS({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date()
    return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() }
  })
  const [planillas, setPlanillas] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [generando, setGenerando] = useState(false)
  const { toasts, toast } = useToast()

  useEffect(() => { if (!session) { router.push('/'); return }; init() }, [session])
  useEffect(() => { if (!loading) cargarPlanillas() }, [mesSeleccionado])

  async function init() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    if (p?.rol !== 'admin') { router.push('/dashboard'); return }
    setPerfil(p); setEstacion(p?.estaciones)
    await Promise.all([cargarPlanillas(), cargarEmpleados()])
    setLoading(false)
  }

  async function cargarPlanillas() {
    const { data } = await supabase.from('planillas').select('*')
      .eq('mes', mesSeleccionado.mes).eq('anio', mesSeleccionado.anio)
      .order('quincena')
    setPlanillas(data || [])
  }

  async function cargarEmpleados() {
    const { data } = await supabase.from('empleados').select('*').eq('activo', true).order('estacion').order('nombre')
    setEmpleados(data || [])
  }

  // Calcular base imponible mensual por empleado
  // = salario_mensual + bonificacion_quincenal*2 (jefes/Silvia)
  // La bonif de admins (2da quincena) también suma en el mes
  const empConBase = empleados.map(e => ({
    ...e,
    sal_mensual_igss: round(
      (parseFloat(e.salario_mensual)||0) +
      (parseFloat(e.bonificacion_quincenal)||0) * 2 +
      (parseFloat(e.bonificacion_segunda_quincena)||0)
    )
  }))

  // Totales del mes
  const totalSalarios  = empConBase.reduce((s,e) => s + (parseFloat(e.sal_mensual_igss)||0), 0)
  const totalPatronal  = empConBase.reduce((s,e) => s + calcularCuotas(e.sal_mensual_igss).patronal, 0)
  const totalLaboral   = empConBase.reduce((s,e) => s + calcularCuotas(e.sal_mensual_igss).laboral, 0)
  const totalIRTRA     = empConBase.reduce((s,e) => s + calcularCuotas(e.sal_mensual_igss).irtra, 0)
  const totalINTECAP   = empConBase.reduce((s,e) => s + calcularCuotas(e.sal_mensual_igss).intecap, 0)
  const totalPagar     = round(totalPatronal + totalLaboral + totalIRTRA + totalINTECAP)

  // Estado de las planillas del mes
  const q1 = planillas.find(p => p.quincena === 1)
  const q2 = planillas.find(p => p.quincena === 2)
  const ambasPagadas = q1?.estado === 'pagada' && q2?.estado === 'pagada'
  const algunaPagada = q1?.estado === 'pagada' || q2?.estado === 'pagada'

  // Datos para el recibo
  const datosMockup = {
    mes: mesSeleccionado.mes, anio: mesSeleccionado.anio,
    trabajadores: empConBase.length,
    totalSalarios: round(totalSalarios),
    cuotas: {
      patronal: round(totalPatronal),
      laboral:  round(totalLaboral),
      irtra:    round(totalIRTRA),
      intecap:  round(totalINTECAP),
      total:    round(totalPagar),
      totalLetras: `${round(totalPagar).toLocaleString('es-GT')} Quetzales`,
    }
  }

  async function descargarTXT() {
    setGenerando(true)
    try {
      const txt = generarTXT(mesSeleccionado.mes, mesSeleccionado.anio, planillas, empConBase)
      const mes2 = String(mesSeleccionado.mes).padStart(2,'0')
      const hoy  = new Date()
      const dd   = String(hoy.getDate()).padStart(2,'0')
      const mm   = String(hoy.getMonth()+1).padStart(2,'0')
      const HH   = String(hoy.getHours()).padStart(2,'0')
      const MM   = String(hoy.getMinutes()).padStart(2,'0')
      const nombre = `${NUM_PATRONAL}-${mesSeleccionado.anio}${mes2}-${dd}${mm}${mesSeleccionado.anio}-${HH}${MM}.TXT`
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = nombre; a.click()
      URL.revokeObjectURL(url)
      toast('✓ Archivo TXT generado', 'success')
    } catch (err) {
      toast('Error al generar archivo', 'error')
    }
    setGenerando(false)
  }

  // Opciones de mes
  const mesesOpciones = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    mesesOpciones.push({ mes: d.getMonth()+1, anio: d.getFullYear(), label: `${MESES[d.getMonth()+1]} ${d.getFullYear()}` })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-3"><Spinner /><span className="text-sm text-gray-400">Cargando...</span></div>
    </div>
  )

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Planilla IGSS</h1>
            <p className="text-sm text-gray-400">Número patronal {NUM_PATRONAL} · {NOMBRE_PAT}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={`${mesSeleccionado.mes}-${mesSeleccionado.anio}`}
              onChange={e => { const [m,a] = e.target.value.split('-'); setMesSeleccionado({ mes: parseInt(m), anio: parseInt(a) }) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-gray-700">
              {mesesOpciones.map(o => (
                <option key={`${o.mes}-${o.anio}`} value={`${o.mes}-${o.anio}`}>{o.label}</option>
              ))}
            </select>
            <button onClick={descargarTXT} disabled={generando}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {generando ? <Spinner /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
              Descargar TXT v2.2.0
            </button>
          </div>
        </div>

        {/* Estado planillas del mes */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: `1ra Quincena — ${MESES[mesSeleccionado.mes]}`, p: q1 },
            { label: `2da Quincena — ${MESES[mesSeleccionado.mes]}`, p: q2 },
          ].map(({ label, p }) => (
            <div key={label} className={`rounded-xl p-4 border ${p?.estado === 'pagada' ? 'bg-green-50 border-green-100' : p ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              {p ? (
                <>
                  <div className="text-sm font-medium text-gray-800">{p.periodo}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.estado === 'pagada' ? 'bg-green-100 text-green-700' : p.estado === 'aprobada' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.estado}
                    </span>
                    <span className="text-xs text-gray-400">{fmt(p.total_liquido)} líquido</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400">Sin planilla registrada</div>
              )}
            </div>
          ))}
        </div>

        {!ambasPagadas && algunaPagada && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-4 flex items-center gap-3">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-amber-800">Solo una quincena está pagada. El archivo TXT se puede generar pero considera que el mes no está completo.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-100">
          {[{ key: 'resumen', label: 'Resumen DR-182-1' }, { key: 'empleados', label: 'Detalle por empleado' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-sm px-4 py-2 border-b-2 transition-colors -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'resumen' && (
          <div className="space-y-4">
            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Trabajadores', value: empConBase.length, sub: 'activos' },
                { label: 'Base imponible', value: fmt(totalSalarios), sub: 'salarios + bonif.' },
                { label: 'Cuota patronal', value: fmt(totalPatronal), sub: `${(PATRONAL*100).toFixed(2)}%`, blue: true },
                { label: 'Total a pagar', value: fmt(totalPagar), sub: 'IGSS + IRTRA + INTECAP', green: true },
              ].map(c => (
                <div key={c.label} className={`rounded-xl p-4 border ${c.green ? 'bg-green-50 border-green-100' : c.blue ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
                  <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                  <p className={`text-xl font-semibold ${c.green ? 'text-green-700' : c.blue ? 'text-blue-700' : 'text-gray-900'}`}>{c.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Recibo mockup */}
            <VistaRecibo datos={datosMockup} />

            {/* Info archivo */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
              <div className="text-xs font-medium text-gray-700 mb-2">Información del archivo TXT</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>Nombre: <span className="font-mono text-gray-700">{NUM_PATRONAL}-{mesSeleccionado.anio}{String(mesSeleccionado.mes).padStart(2,'0')}-ddmmyyyy-HHmm.TXT</span></div>
                <div>Formato: <span className="text-gray-700">v2.2.0 separado por |</span></div>
                <div>Portal: <span className="text-blue-600">servicios.igssgt.org</span></div>
                <div>Vencimiento: <span className="text-gray-700">día 20 del mes siguiente</span></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'empleados' && <TablaEmpleados empleados={empConBase} />}
      </div>
    </Layout>
  )
}
