import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import * as XLSX from 'xlsx'

const fmt = n => 'Q' + Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round = n => Math.round((n + Number.EPSILON) * 100) / 100

const ESTADO_LABELS = {
  borrador:  { label: 'Borrador',    bg: 'bg-gray-100',   text: 'text-gray-600' },
  revision:  { label: 'En revisión', bg: 'bg-amber-50',   text: 'text-amber-700' },
  aprobada:  { label: 'Aprobada',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  pagada:    { label: 'Pagada',      bg: 'bg-green-50',   text: 'text-green-700' },
}

function Badge({ estado }) {
  const s = ESTADO_LABELS[estado] || ESTADO_LABELS.borrador
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
}

function ModalNuevaQuincena({ onClose, onCreada, session }) {
  const [form, setForm] = useState({ periodo: '', fecha_inicio: '', fecha_fin: '' })
  const [guardando, setGuardando] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  async function handleGuardar(e) {
    e.preventDefault(); setGuardando(true)
    const partes = form.fecha_inicio.split('-')
    const { data, error } = await supabase.from('planillas').insert({
      periodo: form.periodo,
      quincena: parseInt(partes[2]) <= 15 ? 1 : 2,
      mes: parseInt(partes[1]), anio: parseInt(partes[0]),
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
      estado: 'borrador', creado_por: session.user.id,
    }).select().single()
    if (!error) {
      await supabase.from('planilla_auditoria').insert({ planilla_id: data.id, accion: 'creada', usuario_id: session.user.id, usuario_email: session.user.email })
      onCreada(data)
    }
    setGuardando(false)
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva quincena</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleGuardar} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Período</label>
            <input value={form.periodo} onChange={e => f('periodo', e.target.value)} required placeholder="Ej: PRIMERA QUINCENA MAYO 2026"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => f('fecha_inicio', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => f('fecha_fin', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Cancelar</button>
            <button type="submit" disabled={guardando} className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {guardando && <Spinner />}{guardando ? 'Creando...' : 'Crear quincena'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalEmpleado({ empleado, onClose, onGuardado }) {
  const esEdicion = !!empleado?.id
  const [form, setForm] = useState(empleado || { nombre: '', numero_igss: '', dpi: '', nit: '', estacion: '', departamento: 'Pista', puesto: 'Cajero de Estación', tipo_pago: 'cheque', banco: null, numero_cuenta: null, salario_mensual: '', salario_tipo: 'normal', activo: true })
  const [guardando, setGuardando] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  async function handleGuardar(e) {
    e.preventDefault(); setGuardando(true)
    const sal = parseFloat(form.salario_mensual) || 0
    const extra = {
      salario_tipo: form.salario_tipo,
      bono14_quincenal: round(sal/24), aguinaldo_quincenal: round(sal/24), vacaciones_quincenal: round(sal/24),
      igss_patronal_mensual: round(sal*0.1067), irtra_mensual: round(sal*0.01), intecap_mensual: round(sal*0.01), indemnizacion_mensual: round(sal*0.0972),
      igss_empleado_quincenal: round(sal*0.0483/2), salario_quincenal: round(sal/2), neto_quincenal_base: round(sal/2 - sal*0.0483/2),
      costo_patronal_quincenal: round(sal/2 + sal/24*3 + sal*0.1067 + sal*0.01*2 + sal*0.0972),
      costo_total_mensual: round(sal + sal/12*3 + sal*0.1067 + sal*0.01*2 + sal*0.0972),
    }
    const payload = { ...form, salario_mensual: sal, ...extra }
    const { error } = esEdicion ? await supabase.from('empleados').update(payload).eq('id', empleado.id) : await supabase.from('empleados').insert(payload)
    if (!error) onGuardado()
    setGuardando(false)
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">{esEdicion ? 'Editar empleado' : 'Nuevo empleado'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleGuardar} className="px-6 py-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre completo</label>
            <input value={form.nombre} onChange={e => f('nombre', e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estación</label>
              <input value={form.estacion} onChange={e => f('estacion', e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Puesto</label>
              <select value={form.puesto} onChange={e => f('puesto', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                <option>Cajero de Estación</option><option>Jefe de Pista</option><option>Administrador</option>
                <option>Supervisor</option><option>Cajero de Tienda</option><option>Gondolero</option>
                <option>Atención al Cliente</option><option>Analista de Contabilidad</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Salario mensual (Q)</label>
              <input type="number" step="0.01" value={form.salario_mensual} onChange={e => f('salario_mensual', e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo salario</label>
              <select value={form.salario_tipo} onChange={e => f('salario_tipo', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                <option value="normal">Normal (Q4,002.28)</option><option value="especial">Especial (Q5,000.00)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo de pago</label>
            <select value={form.tipo_pago} onChange={e => f('tipo_pago', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
              <option value="transferencia">Transferencia bancaria (BI)</option><option value="cheque">Cheque</option>
            </select>
          </div>
          {form.tipo_pago === 'transferencia' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Banco</label>
                <input value={form.banco || ''} onChange={e => f('banco', e.target.value)} placeholder="BI" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">No. cuenta</label>
                <input value={form.numero_cuenta || ''} onChange={e => f('numero_cuenta', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">DPI</label>
              <input value={form.dpi || ''} onChange={e => f('dpi', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">No. IGSS</label>
              <input value={form.numero_igss || ''} onChange={e => f('numero_igss', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          {esEdicion && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={e => f('activo', e.target.checked)} className="rounded" />Empleado activo
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Cancelar</button>
            <button type="submit" disabled={guardando} className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {guardando && <Spinner />}{guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FilaEdicion({ linea, onGuardar, onCancelar, onChange }) {
  const sal = parseFloat(linea.salario_quincenal)||0, ext=parseFloat(linea.horas_extra)||0, com=parseFloat(linea.comisiones)||0
  const desc=parseFloat(linea.otros_descuentos)||0, prest=parseFloat(linea.prestamo_anticipo)||0, igss=parseFloat(linea.igss_empleado)||0
  return (
    <tr className="border-b border-blue-100 bg-blue-50/30">
      <td className="px-4 py-2" colSpan={2}>
        <div className="text-xs font-medium text-gray-800 truncate">{linea.nombre}</div>
        <input value={linea.concepto||''} onChange={e => onChange(l=>({...l,concepto:e.target.value}))} placeholder="Concepto"
          className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
      </td>
      <td className="px-2 py-2 text-xs text-gray-400 text-center">{linea.tipo_pago==='transferencia'?'BI':'Cheque'}</td>
      <td className="px-2 py-2 text-right text-xs text-gray-500">{fmt(sal)}</td>
      <td className="px-2 py-2"><input type="number" step="0.01" value={linea.horas_extra||''} placeholder="0" onChange={e=>onChange(l=>({...l,horas_extra:e.target.value}))} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-400" /></td>
      <td className="px-2 py-2"><input type="number" step="0.01" value={linea.comisiones||''} placeholder="0" onChange={e=>onChange(l=>({...l,comisiones:e.target.value}))} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-400" /></td>
      <td className="px-2 py-2 text-right text-xs text-purple-600">{fmt(igss)}</td>
      <td className="px-2 py-2"><input type="number" step="0.01" value={linea.otros_descuentos||''} placeholder="0" onChange={e=>onChange(l=>({...l,otros_descuentos:e.target.value}))} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-400" /></td>
      <td className="px-2 py-2"><input type="number" step="0.01" value={linea.prestamo_anticipo||''} placeholder="0" onChange={e=>onChange(l=>({...l,prestamo_anticipo:e.target.value}))} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-400" /></td>
      <td className="px-3 py-2 text-right text-sm font-bold text-blue-700">{fmt(round(sal+ext+com-igss-desc-prest))}</td>
      <td className="px-3 py-2"><div className="flex gap-2"><button onClick={()=>onGuardar(linea)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Guardar</button><button onClick={onCancelar} className="text-xs text-gray-400 hover:text-gray-600">✕</button></div></td>
    </tr>
  )
}

function VistaDetalle({ planilla, session, onVolver, toast }) {
  const [lineas, setLineas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [aprobando, setAprobando] = useState(false)
  const [filtroEst, setFiltroEst] = useState('todas')
  const [filtroPago, setFiltroPago] = useState('todos')

  useEffect(() => { cargarLineas() }, [planilla.id])

  async function cargarLineas() {
    setLoading(true)
    const { data } = await supabase.from('planilla_lineas').select('*').eq('planilla_id', planilla.id).order('departamento').order('nombre')
    setLineas(data || [])
    setLoading(false)
  }

  async function generarDesdeEmpleados() {
    if (lineas.length > 0 && !confirm('¿Regenerar las líneas? Esto borrará las existentes.')) return
    if (lineas.length > 0) await supabase.from('planilla_lineas').delete().eq('planilla_id', planilla.id)
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('estacion').order('nombre')
    if (!emps?.length) { toast('No hay empleados activos.', 'error'); return }
    const nuevas = emps.map(e => ({
      planilla_id: planilla.id, empleado_id: e.id,
      nombre: e.nombre, departamento: e.estacion || e.departamento, puesto: e.puesto,
      tipo_pago: e.tipo_pago, banco: e.banco, numero_cuenta: e.numero_cuenta,
      salario_quincenal: e.salario_quincenal,
      bono14_quincenal: e.bono14_quincenal, aguinaldo_quincenal: e.aguinaldo_quincenal, vacaciones_quincenal: e.vacaciones_quincenal,
      horas_extra: 0, comisiones: 0, otros_ingresos: 0,
      igss_empleado: e.igss_empleado_quincenal,
      faltante_inventario: 0, faltante_efectivo: 0, prestamo_anticipo: 0, embargo_deuda: 0, otros_descuentos: 0,
      igss_patronal: e.igss_patronal_mensual, irtra: e.irtra_mensual, intecap: e.intecap_mensual, indemnizacion: e.indemnizacion_mensual,
      costo_patronal_total: e.costo_patronal_quincenal, concepto: planilla.periodo,
    }))
    const { error } = await supabase.from('planilla_lineas').insert(nuevas)
    if (error) { toast('Error al generar planilla.', 'error'); return }
    await recalcularTotales()
    toast(`✓ ${nuevas.length} líneas generadas`, 'success')
    cargarLineas()
  }

  async function guardarLinea(linea) {
    const { error } = await supabase.from('planilla_lineas').update({
      horas_extra: parseFloat(linea.horas_extra)||0, comisiones: parseFloat(linea.comisiones)||0,
      otros_descuentos: parseFloat(linea.otros_descuentos)||0, prestamo_anticipo: parseFloat(linea.prestamo_anticipo)||0,
      embargo_deuda: parseFloat(linea.embargo_deuda)||0, concepto: linea.concepto,
    }).eq('id', linea.id)
    if (!error) { setEditando(null); await recalcularTotales(); cargarLineas(); toast('✓ Línea actualizada', 'success') }
  }

  async function recalcularTotales() {
    const { data: ls } = await supabase.from('planilla_lineas').select('*').eq('planilla_id', planilla.id)
    if (!ls) return
    const liq = l => round(parseFloat(l.salario_quincenal)+(parseFloat(l.horas_extra)||0)+(parseFloat(l.comisiones)||0)-(parseFloat(l.igss_empleado)||0)-(parseFloat(l.otros_descuentos)||0)-(parseFloat(l.prestamo_anticipo)||0)-(parseFloat(l.embargo_deuda)||0)-(parseFloat(l.faltante_inventario)||0)-(parseFloat(l.faltante_efectivo)||0))
    await supabase.from('planillas').update({
      total_bruto:          round(ls.reduce((s,l)=>s+(parseFloat(l.salario_quincenal)||0),0)),
      total_igss_empleados: round(ls.reduce((s,l)=>s+(parseFloat(l.igss_empleado)||0),0)),
      total_adiciones:      round(ls.reduce((s,l)=>s+(parseFloat(l.horas_extra)||0)+(parseFloat(l.comisiones)||0),0)),
      total_descuentos:     round(ls.reduce((s,l)=>s+(parseFloat(l.otros_descuentos)||0)+(parseFloat(l.prestamo_anticipo)||0)+(parseFloat(l.embargo_deuda)||0),0)),
      total_liquido:        round(ls.reduce((s,l)=>s+liq(l),0)),
      total_costo_patronal: round(ls.reduce((s,l)=>s+(parseFloat(l.costo_patronal_total)||0),0)),
    }).eq('id', planilla.id)
  }

  async function cambiarEstado(nuevoEstado) {
    setAprobando(true)
    const update = { estado: nuevoEstado }
    if (nuevoEstado === 'aprobada') { update.aprobado_por = session.user.id; update.aprobado_en = new Date().toISOString() }
    await supabase.from('planillas').update(update).eq('id', planilla.id)
    await supabase.from('planilla_auditoria').insert({ planilla_id: planilla.id, accion: nuevoEstado, usuario_id: session.user.id, usuario_email: session.user.email })
    toast(`✓ ${ESTADO_LABELS[nuevoEstado]?.label}`, 'success')
    onVolver(); setAprobando(false)
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const liq = l => round(parseFloat(l.salario_quincenal)+(parseFloat(l.horas_extra)||0)+(parseFloat(l.comisiones)||0)-(parseFloat(l.igss_empleado)||0)-(parseFloat(l.otros_descuentos)||0)-(parseFloat(l.prestamo_anticipo)||0))
    const transf = lineas.filter(l=>l.tipo_pago==='transferencia')
    const cheqs  = lineas.filter(l=>l.tipo_pago==='cheque')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['#','No. Cuenta','Nombre','Monto','Concepto'],...transf.map(l=>[1,l.numero_cuenta||'',l.nombre,liq(l),l.concepto]),['','','',transf.reduce((s,l)=>s+liq(l),0),'']]), 'Transferencias')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nombre','Monto','Descripción','','Estación','No.'],...cheqs.map(l=>[l.nombre,liq(l),l.concepto,'Cheque',l.departamento,l.numero_cheque||'']),['',cheqs.reduce((s,l)=>s+liq(l),0),'','','','']]), 'Cheques')
    XLSX.writeFile(wb, `Planilla_${planilla.periodo.replace(/ /g,'_')}.xlsx`)
  }

  const liqLinea = l => round(parseFloat(l.salario_quincenal)+(parseFloat(l.horas_extra)||0)+(parseFloat(l.comisiones)||0)-(parseFloat(l.igss_empleado)||0)-(parseFloat(l.otros_descuentos)||0)-(parseFloat(l.prestamo_anticipo)||0)-(parseFloat(l.embargo_deuda)||0))
  const estaciones = [...new Set(lineas.map(l=>l.departamento).filter(Boolean))].sort()
  const filtradas = lineas.filter(l => (filtroEst==='todas'||l.departamento===filtroEst) && (filtroPago==='todos'||l.tipo_pago===filtroPago))
  const totalBruto = lineas.reduce((s,l)=>s+(parseFloat(l.salario_quincenal)||0),0)
  const totalLiq   = lineas.reduce((s,l)=>s+liqLinea(l),0)
  const totalCosto = lineas.reduce((s,l)=>s+(parseFloat(l.costo_patronal_total)||0),0)
  const alertas    = lineas.filter(l => liqLinea(l)<500||liqLinea(l)>4200)
  const esBorrador = planilla.estado==='borrador', esRevision=planilla.estado==='revision', esAprobada=planilla.estado==='aprobada'

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <button onClick={onVolver} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>Volver
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{planilla.periodo}</h1>
          <div className="flex items-center gap-2 mt-1"><Badge estado={planilla.estado} /><span className="text-xs text-gray-400">{planilla.fecha_inicio} → {planilla.fecha_fin}</span></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {esBorrador && <button onClick={generarDesdeEmpleados} className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Generar desde catálogo</button>}
          {lineas.length>0 && <button onClick={exportarExcel} className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Exportar Excel</button>}
          {esBorrador&&lineas.length>0 && <button onClick={()=>cambiarEstado('revision')} disabled={aprobando} className="text-sm px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">Enviar a revisión</button>}
          {esRevision && <button onClick={()=>cambiarEstado('aprobada')} disabled={aprobando} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Aprobar planilla</button>}
          {esAprobada && <button onClick={()=>cambiarEstado('pagada')} disabled={aprobando} className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Marcar como pagada</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[{label:'Total líneas',value:lineas.length,sub:'colaboradores'},{label:'Salario bruto',value:fmt(totalBruto),sub:'quincenal'},{label:'Líquido total',value:fmt(totalLiq),sub:'a pagar',blue:true},{label:'Costo patronal',value:fmt(totalCosto),sub:'quincenal',amber:true}].map(c=>(
          <div key={c.label} className={`rounded-xl p-4 border ${c.blue?'bg-blue-50 border-blue-100':c.amber?'bg-amber-50 border-amber-100':'bg-white border-gray-100'}`}>
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-xl font-semibold ${c.blue?'text-blue-700':c.amber?'text-amber-700':'text-gray-900'}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {alertas.length>0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-4 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span className="text-sm text-amber-800">{alertas.length} pago{alertas.length>1?'s':''} fuera de rango — revisar antes de aprobar.</span>
        </div>
      )}

      {lineas.length>0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select value={filtroEst} onChange={e=>setFiltroEst(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 text-gray-700">
            <option value="todas">Todas las estaciones</option>{estaciones.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroPago} onChange={e=>setFiltroPago(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 text-gray-700">
            <option value="todos">Todos los tipos</option><option value="transferencia">Transferencias BI</option><option value="cheque">Cheques</option>
          </select>
          <span className="text-xs text-gray-400">{filtradas.length} registros</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3"><Spinner /><span className="text-sm text-gray-400">Cargando...</span></div>
      ) : lineas.length===0 ? (
        <div className="bg-white border border-gray-100 rounded-xl px-6 py-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <p className="text-sm text-gray-400 mb-3">Sin líneas de planilla</p>
          <button onClick={generarDesdeEmpleados} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generar desde catálogo</button>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal min-w-40">Empleado</th>
                  <th className="px-2 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                  <th className="px-2 py-2.5 text-center text-xs text-gray-400 font-normal">Tipo</th>
                  <th className="px-2 py-2.5 text-right text-xs text-gray-400 font-normal">Sal. quinc.</th>
                  <th className="px-2 py-2.5 text-right text-xs text-gray-400 font-normal">Extras</th>
                  <th className="px-2 py-2.5 text-right text-xs text-gray-400 font-normal">Comis.</th>
                  <th className="px-2 py-2.5 text-right text-xs text-gray-400 font-normal">IGSS</th>
                  <th className="px-2 py-2.5 text-right text-xs text-gray-400 font-normal">Desc.</th>
                  <th className="px-2 py-2.5 text-right text-xs text-gray-400 font-normal">Préstamo</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Líquido</th>
                  {esBorrador && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(linea => {
                  const liq = liqLinea(linea)
                  const alerta = liq < 500 || liq > 4200
                  if (editando?.id === linea.id) return (
                    <FilaEdicion key={linea.id} linea={editando} onGuardar={guardarLinea} onCancelar={()=>setEditando(null)} onChange={fn=>setEditando(prev=>fn(prev))} />
                  )
                  return (
                    <tr key={linea.id} className={`border-b border-gray-50 hover:bg-gray-50 ${alerta?'bg-amber-50/40':''}`}>
                      <td className="px-4 py-2.5"><div className="text-xs font-medium text-gray-800 truncate max-w-40">{linea.nombre}</div>{linea.numero_cuenta&&<div className="text-xs text-gray-400">{linea.numero_cuenta}</div>}{alerta&&<div className="text-xs text-amber-600">⚠ Monto inusual</div>}</td>
                      <td className="px-2 py-2.5 text-xs text-gray-500 max-w-28 truncate">{linea.departamento}</td>
                      <td className="px-2 py-2.5 text-center"><span className={`text-xs px-1.5 py-0.5 rounded-full ${linea.tipo_pago==='transferencia'?'bg-blue-50 text-blue-600':'bg-gray-100 text-gray-500'}`}>{linea.tipo_pago==='transferencia'?'BI':'Cheque'}</span></td>
                      <td className="px-2 py-2.5 text-right text-xs text-gray-600">{fmt(linea.salario_quincenal)}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-teal-600">{parseFloat(linea.horas_extra)>0?fmt(linea.horas_extra):'—'}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-teal-600">{parseFloat(linea.comisiones)>0?fmt(linea.comisiones):'—'}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-purple-600">{fmt(linea.igss_empleado)}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-red-500">{parseFloat(linea.otros_descuentos)>0?fmt(linea.otros_descuentos):'—'}</td>
                      <td className="px-2 py-2.5 text-right text-xs text-red-500">{parseFloat(linea.prestamo_anticipo)>0?fmt(linea.prestamo_anticipo):'—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">{fmt(liq)}</td>
                      {esBorrador && <td className="px-3 py-2.5 text-center"><button onClick={()=>setEditando({...linea})} className="text-xs text-blue-500 hover:text-blue-700">Editar</button></td>}
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-700">Total — {filtradas.length} registros</td>
                  <td className="px-2 py-3 text-right text-xs font-bold">{fmt(filtradas.reduce((s,l)=>s+(parseFloat(l.salario_quincenal)||0),0))}</td>
                  <td className="px-2 py-3 text-right text-xs font-bold text-teal-600">{fmt(filtradas.reduce((s,l)=>s+(parseFloat(l.horas_extra)||0),0))}</td>
                  <td className="px-2 py-3 text-right text-xs font-bold text-teal-600">{fmt(filtradas.reduce((s,l)=>s+(parseFloat(l.comisiones)||0),0))}</td>
                  <td className="px-2 py-3 text-right text-xs font-bold text-purple-600">{fmt(filtradas.reduce((s,l)=>s+(parseFloat(l.igss_empleado)||0),0))}</td>
                  <td className="px-2 py-3 text-right text-xs font-bold text-red-500">{fmt(filtradas.reduce((s,l)=>s+(parseFloat(l.otros_descuentos)||0),0))}</td>
                  <td className="px-2 py-3 text-right text-xs font-bold text-red-500">{fmt(filtradas.reduce((s,l)=>s+(parseFloat(l.prestamo_anticipo)||0),0))}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-blue-700">{fmt(filtradas.reduce((s,l)=>s+liqLinea(l),0))}</td>
                  {esBorrador&&<td/>}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Planillas({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('planillas')
  const [planillas, setPlanillas] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [viendoPlanilla, setViendoPlanilla] = useState(null)
  const [modalNueva, setModalNueva] = useState(false)
  const [modalEmpleado, setModalEmpleado] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const { toasts, toast } = useToast()

  useEffect(() => { if (!session) { router.push('/'); return }; init() }, [session])

  async function init() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    if (p?.rol !== 'admin') { router.push('/dashboard'); return }
    setPerfil(p); setEstacion(p?.estaciones)
    await Promise.all([cargarPlanillas(), cargarEmpleados()])
    setLoading(false)
  }

  async function cargarPlanillas() { const { data } = await supabase.from('planillas').select('*').order('created_at',{ascending:false}); setPlanillas(data||[]) }
  async function cargarEmpleados() { const { data } = await supabase.from('empleados').select('*').order('estacion').order('nombre'); setEmpleados(data||[]) }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="flex flex-col items-center gap-3"><Spinner /><span className="text-sm text-gray-400">Cargando planillas...</span></div></div>

  if (viendoPlanilla) return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <VistaDetalle planilla={viendoPlanilla} session={session} toast={toast} onVolver={()=>{setViendoPlanilla(null);cargarPlanillas()}} />
    </Layout>
  )

  const estaciones = [...new Set(empleados.map(e=>e.estacion).filter(Boolean))].sort()
  const resumenEst = estaciones.map(est => ({ nombre:est, total:empleados.filter(e=>e.estacion===est).length, bi:empleados.filter(e=>e.estacion===est&&e.tipo_pago==='transferencia').length, masa:empleados.filter(e=>e.estacion===est).reduce((s,e)=>s+(parseFloat(e.salario_mensual)||0),0) }))
  const empFiltrados = empleados.filter(e=>!busqueda||e.nombre?.toLowerCase().includes(busqueda.toLowerCase())||e.estacion?.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      {modalNueva && <ModalNuevaQuincena session={session} onClose={()=>setModalNueva(false)} onCreada={p=>{setModalNueva(false);cargarPlanillas();setViendoPlanilla(p)}} />}
      {modalEmpleado!==null && <ModalEmpleado empleado={modalEmpleado?.id?modalEmpleado:null} onClose={()=>setModalEmpleado(null)} onGuardado={()=>{setModalEmpleado(null);cargarEmpleados();toast('✓ Empleado guardado','success')}} />}

      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Planillas</h1>
            <p className="text-sm text-gray-400">Nómina quincenal · {empleados.filter(e=>e.activo).length} empleados activos</p>
          </div>
          <div className="flex gap-2">
            {tab==='planillas' && <button onClick={()=>setModalNueva(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Nueva quincena</button>}
            {tab==='empleados' && <button onClick={()=>setModalEmpleado({})} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Nuevo empleado</button>}
          </div>
        </div>

        <div className="flex gap-1 mb-5 border-b border-gray-100">
          {[{key:'planillas',label:'Quincenas'},{key:'empleados',label:'Catálogo de empleados'},{key:'estaciones',label:'Por estación'}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} className={`text-sm px-4 py-2 border-b-2 transition-colors -mb-px ${tab===t.key?'border-blue-600 text-blue-700 font-medium':'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
          ))}
        </div>

        {tab==='planillas' && (
          <div className="space-y-3">
            {planillas.length===0 ? (
              <div className="bg-white border border-gray-100 rounded-xl px-6 py-12 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                <p className="text-sm text-gray-400 mb-3">Sin quincenas registradas</p>
                <button onClick={()=>setModalNueva(true)} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear primera quincena</button>
              </div>
            ) : planillas.map(p=>(
              <div key={p.id} onClick={()=>setViendoPlanilla(p)} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-200 cursor-pointer transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.periodo}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.fecha_inicio} → {p.fecha_fin}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block"><div className="text-sm font-medium text-gray-800">{fmt(p.total_liquido||0)}</div><div className="text-xs text-gray-400">Líquido</div></div>
                  <div className="text-right hidden md:block"><div className="text-sm font-medium text-gray-500">{fmt(p.total_costo_patronal||0)}</div><div className="text-xs text-gray-400">Costo patronal</div></div>
                  <Badge estado={p.estado} />
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='empleados' && (
          <div>
            <div className="mb-4"><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre o estación..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Nombre</th><th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th><th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Puesto</th><th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Pago</th><th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Sal. mensual</th><th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Neto quincenal</th><th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th><th className="px-3 py-2.5" /></tr></thead>
                  <tbody>
                    {empFiltrados.length===0 ? <tr><td colSpan={8} className="px-5 py-8 text-center text-xs text-gray-400">Sin resultados</td></tr> :
                    empFiltrados.map(emp=>(
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3"><div className="font-medium text-gray-800 text-sm">{emp.nombre}</div>{emp.numero_cuenta&&<div className="text-xs text-gray-400">{emp.banco} {emp.numero_cuenta}</div>}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{emp.estacion||emp.departamento}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{emp.puesto}</td>
                        <td className="px-3 py-3 text-center"><span className={`text-xs px-1.5 py-0.5 rounded-full ${emp.tipo_pago==='transferencia'?'bg-blue-50 text-blue-600':'bg-gray-100 text-gray-500'}`}>{emp.tipo_pago==='transferencia'?'BI':'Cheque'}</span></td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-gray-800">{fmt(emp.salario_mensual)}</td>
                        <td className="px-3 py-3 text-right text-sm text-gray-600">{fmt(emp.neto_quincenal_base)}</td>
                        <td className="px-3 py-3 text-center"><span className={`text-xs px-1.5 py-0.5 rounded-full ${emp.activo?'bg-green-50 text-green-600':'bg-gray-100 text-gray-400'}`}>{emp.activo?'Activo':'Inactivo'}</span></td>
                        <td className="px-3 py-3 text-center"><button onClick={()=>setModalEmpleado(emp)} className="text-xs text-blue-500 hover:text-blue-700">Editar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab==='estaciones' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[{label:'Total empleados',value:empleados.filter(e=>e.activo).length},{label:'Masa salarial mensual',value:fmt(empleados.reduce((s,e)=>s+(parseFloat(e.salario_mensual)||0),0))},{label:'Estaciones activas',value:estaciones.length}].map(c=>(
                <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 mb-1">{c.label}</p><p className="text-xl font-semibold text-gray-900">{c.value}</p></div>
              ))}
            </div>
            {resumenEst.map(est=>(
              <div key={est.nombre} className="bg-white border border-gray-100 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium text-gray-900">{est.nombre}</div><div className="text-xs text-gray-400 mt-0.5">{est.total} empleados · {est.bi} BI · {est.total-est.bi} cheque</div></div>
                  <div className="text-right"><div className="text-sm font-medium text-gray-800">{fmt(est.masa)}</div><div className="text-xs text-gray-400">masa mensual</div></div>
                </div>
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{width:`${Math.round((est.total/Math.max(...resumenEst.map(e=>e.total)))*100)}%`}} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
