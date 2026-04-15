import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import * as XLSX from 'xlsx'

const UMBRAL_BAJO = 500
const UMBRAL_ALTO = 4200

function fmt(n) {
  return 'Q' + Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Badge({ estado }) {
  const map = {
    borrador:  { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Borrador' },
    revision:  { bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'En revisión' },
    aprobada:  { bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Aprobada' },
    pagada:    { bg: 'bg-green-50',   text: 'text-green-700',  label: 'Pagada' },
  }
  const s = map[estado] || map.borrador
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ─── Modal: Nueva quincena ───────────────────────────────────────────────────
function ModalNuevaQuincena({ onClose, onCreada, session }) {
  const [form, setForm] = useState({ periodo: '', fecha_inicio: '', fecha_fin: '' })
  const [guardando, setGuardando] = useState(false)
  const { toasts, toast } = useToast()

  async function handleGuardar(e) {
    e.preventDefault()
    setGuardando(true)
    const { data, error } = await supabase.from('quincenas').insert({
      ...form,
      estado: 'borrador',
      created_by: session.user.id,
    }).select().single()
    if (error) {
      toast('Error al crear la quincena.', 'error')
    } else {
      await supabase.from('planilla_auditoria').insert({
        quincena_id: data.id,
        accion: 'creada',
        usuario_id: session.user.id,
        usuario_email: session.user.email,
      })
      onCreada(data)
    }
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <ToastContainer toasts={toasts} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva quincena</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleGuardar} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Período</label>
            <input
              value={form.periodo}
              onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
              placeholder="Ej: PRIMERA QUINCENA MAYO 2026"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin}
                onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {guardando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {guardando ? 'Creando...' : 'Crear quincena'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Agregar empleado ─────────────────────────────────────────────────
function ModalEmpleado({ empleado, onClose, onGuardado }) {
  const esEdicion = !!empleado
  const [form, setForm] = useState(empleado || {
    nombre: '', numero_cuenta: '', banco: '', estacion: '',
    tipo_pago: 'transferencia', salario_base: '', activo: true,
  })
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = { ...form, salario_base: parseFloat(form.salario_base) || 0 }
    const { error } = esEdicion
      ? await supabase.from('empleados').update(payload).eq('id', empleado.id)
      : await supabase.from('empleados').insert(payload)
    if (!error) onGuardado()
    setGuardando(false)
  }

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{esEdicion ? 'Editar empleado' : 'Nuevo empleado'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleGuardar} className="px-6 py-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre completo</label>
            <input value={form.nombre} onChange={e => field('nombre', e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Estación</label>
              <input value={form.estacion} onChange={e => field('estacion', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Salario base (Q)</label>
              <input type="number" step="0.01" value={form.salario_base} onChange={e => field('salario_base', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo de pago</label>
            <select value={form.tipo_pago} onChange={e => field('tipo_pago', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
              <option value="transferencia">Transferencia bancaria</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          {form.tipo_pago === 'transferencia' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">No. de cuenta</label>
                <input value={form.numero_cuenta || ''} onChange={e => field('numero_cuenta', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Banco</label>
                <input value={form.banco || ''} onChange={e => field('banco', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          )}
          {esEdicion && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={e => field('activo', e.target.checked)}
                className="rounded" />
              Empleado activo
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {guardando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Vista: Detalle de quincena ──────────────────────────────────────────────
function VistaQuincena({ quincena, session, onVolver, toast }) {
  const [lineas, setLineas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [aprobando, setAprobando] = useState(false)
  const fileRef = useRef()

  useEffect(() => { cargarLineas() }, [quincena.id])

  async function cargarLineas() {
    setLoading(true)
    const { data } = await supabase.from('planilla_lineas')
      .select('*').eq('quincena_id', quincena.id).order('estacion').order('nombre_empleado')
    setLineas(data || [])
    setLoading(false)
  }

  async function generarDesdeEmpleados() {
    const { data: empleados } = await supabase.from('empleados').select('*').eq('activo', true).order('estacion')
    if (!empleados?.length) { toast('No hay empleados activos.', 'error'); return }

    // Validar si ya hay líneas
    if (lineas.length > 0) {
      if (!confirm('Ya existen líneas en esta quincena. ¿Deseas regenerarlas? Esto borrará las existentes.')) return
      await supabase.from('planilla_lineas').delete().eq('quincena_id', quincena.id)
    }

    const nuevasLineas = empleados.map((emp, i) => ({
      quincena_id: quincena.id,
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      numero_cuenta: emp.numero_cuenta,
      estacion: emp.estacion,
      tipo_pago: emp.tipo_pago,
      numero_cheque: emp.tipo_pago === 'cheque' ? 900 + i : null,
      salario_base: emp.salario_base,
      extras: 0,
      descuentos: 0,
      concepto: quincena.periodo,
      alerta: emp.salario_base < UMBRAL_BAJO ? 'Monto bajo — verificar' :
               emp.salario_base > UMBRAL_ALTO ? 'Monto alto — requiere aprobación' : null,
    }))

    const { error } = await supabase.from('planilla_lineas').insert(nuevasLineas)
    if (error) { toast('Error al generar planilla.', 'error'); return }

    // Recalcular totales en quincena
    const totalT = nuevasLineas.filter(l => l.tipo_pago === 'transferencia').reduce((s, l) => s + l.salario_base, 0)
    const totalC = nuevasLineas.filter(l => l.tipo_pago === 'cheque').reduce((s, l) => s + l.salario_base, 0)
    await supabase.from('quincenas').update({ total_transferencias: totalT, total_cheques: totalC }).eq('id', quincena.id)

    toast('✓ Planilla generada correctamente', 'success')
    cargarLineas()
  }

  async function guardarLinea(linea) {
    const alerta = linea.neto < UMBRAL_BAJO ? 'Monto bajo — verificar' :
                   linea.neto > UMBRAL_ALTO ? 'Monto alto — requiere aprobación' : null
    const { error } = await supabase.from('planilla_lineas').update({
      extras: parseFloat(linea.extras) || 0,
      descuentos: parseFloat(linea.descuentos) || 0,
      concepto: linea.concepto,
      numero_cheque: linea.numero_cheque ? parseInt(linea.numero_cheque) : null,
      alerta,
    }).eq('id', linea.id)
    if (!error) { setEditando(null); cargarLineas(); toast('✓ Línea actualizada', 'success') }
  }

  async function cambiarEstado(nuevoEstado) {
    setAprobando(true)
    const update = { estado: nuevoEstado }
    if (nuevoEstado === 'aprobada') {
      update.aprobado_por = session.user.id
      update.aprobado_en = new Date().toISOString()
    }
    await supabase.from('quincenas').update(update).eq('id', quincena.id)
    await supabase.from('planilla_auditoria').insert({
      quincena_id: quincena.id,
      accion: nuevoEstado,
      usuario_id: session.user.id,
      usuario_email: session.user.email,
    })
    toast(`✓ Planilla marcada como: ${nuevoEstado}`, 'success')
    onVolver()
    setAprobando(false)
  }

  function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const wsT = wb.Sheets['Transferencias']
      const wsC = wb.Sheets['Cheques']
      const rowsT = wsT ? XLSX.utils.sheet_to_json(wsT, { header: 1 }).slice(1) : []
      const rowsC = wsC ? XLSX.utils.sheet_to_json(wsC, { header: 1 }).slice(1) : []

      if (lineas.length > 0) {
        if (!confirm('¿Reemplazar las líneas existentes con los datos del Excel?')) return
        await supabase.from('planilla_lineas').delete().eq('quincena_id', quincena.id)
      }

      const lineasT = rowsT
        .filter(r => r[3] && typeof r[3] === 'number')
        .map(r => ({
          quincena_id: quincena.id,
          nombre_empleado: String(r[2] || '').trim(),
          numero_cuenta: String(r[1] || '').trim(),
          estacion: 'General',
          tipo_pago: 'transferencia',
          salario_base: parseFloat(r[3]) || 0,
          extras: 0, descuentos: 0,
          concepto: String(r[4] || quincena.periodo).trim(),
          alerta: parseFloat(r[3]) < UMBRAL_BAJO ? 'Monto bajo — verificar' :
                  parseFloat(r[3]) > UMBRAL_ALTO ? 'Monto alto — requiere aprobación' : null,
        }))

      const lineasC = rowsC
        .filter(r => r[1] && typeof r[1] === 'number')
        .map(r => ({
          quincena_id: quincena.id,
          nombre_empleado: String(r[0] || '').trim(),
          estacion: String(r[4] || '').trim(),
          tipo_pago: 'cheque',
          numero_cheque: parseInt(r[5]) || null,
          salario_base: parseFloat(r[1]) || 0,
          extras: 0, descuentos: 0,
          concepto: String(r[2] || quincena.periodo).trim(),
          alerta: parseFloat(r[1]) < UMBRAL_BAJO ? 'Monto bajo — verificar' :
                  parseFloat(r[1]) > UMBRAL_ALTO ? 'Monto alto — requiere aprobación' : null,
        }))

      const todas = [...lineasT, ...lineasC]
      if (!todas.length) { toast('No se encontraron datos válidos en el Excel.', 'error'); return }

      const { error } = await supabase.from('planilla_lineas').insert(todas)
      if (error) { toast('Error al importar.', 'error'); return }

      const totalT = lineasT.reduce((s, l) => s + l.salario_base, 0)
      const totalC = lineasC.reduce((s, l) => s + l.salario_base, 0)
      await supabase.from('quincenas').update({ total_transferencias: totalT, total_cheques: totalC }).eq('id', quincena.id)

      toast(`✓ ${todas.length} registros importados`, 'success')
      cargarLineas()
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()

    const transferencias = lineas.filter(l => l.tipo_pago === 'transferencia')
    const cheques = lineas.filter(l => l.tipo_pago === 'cheque')

    const dataT = [
      ['#', 'No. Cuenta', 'Nombre', 'Monto', 'Concepto'],
      ...transferencias.map((l, i) => [1, l.numero_cuenta || '', l.nombre_empleado, l.neto, l.concepto]),
      ['', '', '', transferencias.reduce((s, l) => s + (l.neto || 0), 0), ''],
    ]
    const wsT = XLSX.utils.aoa_to_sheet(dataT)
    XLSX.utils.book_append_sheet(wb, wsT, 'Transferencias')

    const dataC = [
      ['Nombre', 'Monto', 'Descripción', '', 'Estación', 'No.'],
      ...cheques.map(l => [l.nombre_empleado, l.neto, l.concepto, 'Cheque', l.estacion, l.numero_cheque || '']),
      ['', cheques.reduce((s, l) => s + (l.neto || 0), 0), '', '', '', ''],
    ]
    const wsC = XLSX.utils.aoa_to_sheet(dataC)
    XLSX.utils.book_append_sheet(wb, wsC, 'Cheques')

    XLSX.writeFile(wb, `Planilla_${quincena.periodo.replace(/ /g, '_')}.xlsx`)
  }

  const alertas = lineas.filter(l => l.alerta)
  const porEstacion = lineas.filter(l => l.tipo_pago === 'cheque').reduce((acc, l) => {
    acc[l.estacion] = (acc[l.estacion] || 0) + (l.neto || 0)
    return acc
  }, {})
  const totalGeneral = lineas.reduce((s, l) => s + (l.neto || 0), 0)
  const puedeAprobar = quincena.estado === 'revision'
  const esBorrador = quincena.estado === 'borrador'
  const esAprobada = quincena.estado === 'aprobada'

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <button onClick={onVolver} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{quincena.periodo}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge estado={quincena.estado} />
            <span className="text-xs text-gray-400">{quincena.fecha_inicio} → {quincena.fecha_fin}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {esBorrador && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
              <button onClick={() => fileRef.current.click()}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Importar Excel
              </button>
              <button onClick={generarDesdeEmpleados}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Generar desde catálogo
              </button>
            </>
          )}
          {lineas.length > 0 && (
            <button onClick={exportarExcel}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exportar Excel
            </button>
          )}
          {esBorrador && lineas.length > 0 && (
            <button onClick={() => cambiarEstado('revision')} disabled={aprobando}
              className="text-sm px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
              Enviar a revisión
            </button>
          )}
          {puedeAprobar && (
            <button onClick={() => cambiarEstado('aprobada')} disabled={aprobando}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Aprobar planilla
            </button>
          )}
          {esAprobada && (
            <button onClick={() => cambiarEstado('pagada')} disabled={aprobando}
              className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              Marcar como pagada
            </button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total general', value: fmt(totalGeneral), sub: `${lineas.length} colaboradores` },
          { label: 'Transferencias', value: fmt(lineas.filter(l=>l.tipo_pago==='transferencia').reduce((s,l)=>s+(l.neto||0),0)), sub: `${lineas.filter(l=>l.tipo_pago==='transferencia').length} empleados` },
          { label: 'Cheques', value: fmt(lineas.filter(l=>l.tipo_pago==='cheque').reduce((s,l)=>s+(l.neto||0),0)), sub: `${lineas.filter(l=>l.tipo_pago==='cheque').length} empleados` },
          { label: 'Alertas', value: alertas.length, sub: alertas.length === 0 ? 'Sin anomalías' : 'Requieren revisión', alert: alertas.length > 0 },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-4 ${card.alert ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-gray-100'}`}>
            <p className="text-xs text-gray-400 mb-1">{card.label}</p>
            <p className={`text-xl font-semibold ${card.alert ? 'text-amber-700' : 'text-gray-900'}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-amber-800">{alertas.length} pago{alertas.length > 1 ? 's' : ''} con alerta</span>
          </div>
          <div className="space-y-1">
            {alertas.map(l => (
              <div key={l.id} className="text-xs text-amber-700 flex justify-between">
                <span>{l.nombre_empleado}</span>
                <span className="font-medium">{fmt(l.neto)} — {l.alerta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla principal */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lineas.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl px-6 py-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm text-gray-400 mb-3">Sin líneas de planilla aún</p>
          <p className="text-xs text-gray-300">Importa un Excel o genera desde el catálogo de empleados</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Empleado</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Tipo</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Base</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Extras</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Desc.</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Neto</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Cheque</th>
                  {esBorrador && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {lineas.map(linea => (
                  editando?.id === linea.id ? (
                    <FilaEdicion key={linea.id} linea={editando} onGuardar={guardarLinea}
                      onCancelar={() => setEditando(null)} onChange={setEditando} />
                  ) : (
                    <tr key={linea.id} className={`border-b border-gray-50 hover:bg-gray-50 ${linea.alerta ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 text-xs">{linea.nombre_empleado}</div>
                        {linea.numero_cuenta && <div className="text-xs text-gray-400">{linea.numero_cuenta}</div>}
                        {linea.alerta && <div className="text-xs text-amber-600 mt-0.5">⚠ {linea.alerta}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{linea.estacion}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${linea.tipo_pago === 'transferencia' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                          {linea.tipo_pago === 'transferencia' ? 'Transf.' : 'Cheque'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmt(linea.salario_base)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-green-600">{linea.extras > 0 ? '+'+fmt(linea.extras) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-red-500">{linea.descuentos > 0 ? '-'+fmt(linea.descuentos) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-900">{fmt(linea.neto)}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400">{linea.numero_cheque || '—'}</td>
                      {esBorrador && (
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => setEditando({ ...linea })}
                            className="text-xs text-blue-500 hover:text-blue-700">Editar</button>
                        </td>
                      )}
                    </tr>
                  )
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={esBorrador ? 6 : 6} className="px-4 py-3 text-xs font-semibold text-gray-700">Total general</td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">{fmt(totalGeneral)}</td>
                  <td colSpan={esBorrador ? 2 : 1} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen por estación (cheques) */}
      {Object.keys(porEstacion).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mt-4">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">Cheques por estación</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(porEstacion).sort((a,b) => b[1]-a[1]).map(([est, total]) => (
              <div key={est} className="flex justify-between items-center px-5 py-2.5">
                <span className="text-sm text-gray-700">{est}</span>
                <span className="text-sm font-medium text-gray-900">{fmt(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FilaEdicion({ linea, onGuardar, onCancelar, onChange }) {
  return (
    <tr className="border-b border-blue-100 bg-blue-50/30">
      <td className="px-4 py-2" colSpan={2}>
        <div className="text-xs font-medium text-gray-800">{linea.nombre_empleado}</div>
        <input value={linea.concepto || ''} onChange={e => onChange(l => ({ ...l, concepto: e.target.value }))}
          className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" placeholder="Concepto" />
      </td>
      <td className="px-3 py-2 text-center">
        <span className="text-xs text-gray-500">{linea.tipo_pago === 'transferencia' ? 'Transf.' : 'Cheque'}</span>
      </td>
      <td className="px-3 py-2 text-right text-xs text-gray-500">{fmt(linea.salario_base)}</td>
      <td className="px-3 py-2">
        <input type="number" step="0.01" value={linea.extras || ''} onChange={e => onChange(l => ({ ...l, extras: e.target.value }))}
          className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 text-right" placeholder="0" />
      </td>
      <td className="px-3 py-2">
        <input type="number" step="0.01" value={linea.descuentos || ''} onChange={e => onChange(l => ({ ...l, descuentos: e.target.value }))}
          className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 text-right" placeholder="0" />
      </td>
      <td className="px-3 py-2 text-right text-xs font-bold text-blue-700">
        {fmt((parseFloat(linea.salario_base)||0) + (parseFloat(linea.extras)||0) - (parseFloat(linea.descuentos)||0))}
      </td>
      <td className="px-3 py-2">
        {linea.tipo_pago === 'cheque' && (
          <input type="number" value={linea.numero_cheque || ''} onChange={e => onChange(l => ({ ...l, numero_cheque: e.target.value }))}
            className="w-16 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" placeholder="#" />
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5">
          <button onClick={() => onGuardar(linea)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Guardar</button>
          <button onClick={onCancelar} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function Planillas({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('quincenas') // 'quincenas' | 'empleados'
  const [quincenas, setQuincenas] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [viendoQuincena, setViendoQuincena] = useState(null)
  const [modalNuevaQ, setModalNuevaQ] = useState(false)
  const [modalEmpleado, setModalEmpleado] = useState(null) // null | {} | empleado
  const { toasts, toast } = useToast()

  useEffect(() => {
    if (!session) { router.push('/'); return }
    init()
  }, [session])

  async function init() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    if (p?.rol !== 'admin') { router.push('/dashboard'); return }
    setPerfil(p)
    setEstacion(p?.estaciones)
    await Promise.all([cargarQuincenas(), cargarEmpleados()])
    setLoading(false)
  }

  async function cargarQuincenas() {
    const { data } = await supabase.from('quincenas').select('*').order('created_at', { ascending: false })
    setQuincenas(data || [])
  }

  async function cargarEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('estacion').order('nombre')
    setEmpleados(data || [])
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Cargando planillas...</span>
      </div>
    </div>
  )

  if (viendoQuincena) return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <VistaQuincena
        quincena={viendoQuincena}
        session={session}
        toast={toast}
        onVolver={() => { setViendoQuincena(null); cargarQuincenas() }}
      />
    </Layout>
  )

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      {modalNuevaQ && (
        <ModalNuevaQuincena
          session={session}
          onClose={() => setModalNuevaQ(false)}
          onCreada={q => { setModalNuevaQ(false); cargarQuincenas(); setViendoQuincena(q) }}
        />
      )}
      {modalEmpleado !== null && (
        <ModalEmpleado
          empleado={modalEmpleado.id ? modalEmpleado : null}
          onClose={() => setModalEmpleado(null)}
          onGuardado={() => { setModalEmpleado(null); cargarEmpleados(); toast('✓ Empleado guardado', 'success') }}
        />
      )}

      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Planillas</h1>
            <p className="text-sm text-gray-400">Gestión de nómina quincenal</p>
          </div>
          <div className="flex gap-2">
            {tab === 'quincenas' && (
              <button onClick={() => setModalNuevaQ(true)}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nueva quincena
              </button>
            )}
            {tab === 'empleados' && (
              <button onClick={() => setModalEmpleado({})}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuevo empleado
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-100">
          {[{ key: 'quincenas', label: 'Quincenas' }, { key: 'empleados', label: 'Catálogo de empleados' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-sm px-4 py-2 border-b-2 transition-colors -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Quincenas */}
        {tab === 'quincenas' && (
          <div className="space-y-3">
            {quincenas.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl px-6 py-12 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <p className="text-sm text-gray-400 mb-3">Sin quincenas aún</p>
                <button onClick={() => setModalNuevaQ(true)}
                  className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Crear primera quincena
                </button>
              </div>
            ) : quincenas.map(q => (
              <div key={q.id} onClick={() => setViendoQuincena(q)}
                className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-200 cursor-pointer transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-900">{q.periodo}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{q.fecha_inicio} → {q.fecha_fin}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <div className="text-sm font-medium text-gray-800">{fmt((q.total_transferencias || 0) + (q.total_cheques || 0))}</div>
                    <div className="text-xs text-gray-400">Total planilla</div>
                  </div>
                  <Badge estado={q.estado} />
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Empleados */}
        {tab === 'empleados' && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            {empleados.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-400 mb-3">Sin empleados registrados</p>
                <button onClick={() => setModalEmpleado({})}
                  className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Agregar primer empleado
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Nombre</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                      <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Tipo pago</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">No. cuenta</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Salario base</th>
                      <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {empleados.map(emp => (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{emp.nombre}</td>
                        <td className="px-3 py-3 text-gray-600">{emp.estacion}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${emp.tipo_pago === 'transferencia' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                            {emp.tipo_pago === 'transferencia' ? 'Transf.' : 'Cheque'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{emp.numero_cuenta || '—'}</td>
                        <td className="px-3 py-3 text-right font-medium text-gray-800">{fmt(emp.salario_base)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${emp.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {emp.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => setModalEmpleado(emp)}
                            className="text-xs text-blue-500 hover:text-blue-700">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
