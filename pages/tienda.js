import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import * as XLSX from 'xlsx'

export default function Tienda({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  // Resumen
  const [fechaResumen, setFechaResumen] = useState(new Date().toISOString().split('T')[0])
  const [resumen, setResumen] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)

  // Ventas diarias
  const [registroVenta, setRegistroVenta] = useState(null)
  const [formVenta, setFormVenta] = useState({
    efectivo: '', tarjeta: '', neonet: '', otros: '', notas: ''
  })
  const [guardandoVenta, setGuardandoVenta] = useState(false)

  // Gastos
  const [gastos, setGastos] = useState([])
  const [formGasto, setFormGasto] = useState({ descripcion: '', monto: '', categoria: 'General' })
  const [guardandoGasto, setGuardandoGasto] = useState(false)
  const [showFormGasto, setShowFormGasto] = useState(false)

  // Facturas FEL clientes
  const [facturasFEL, setFacturasFEL] = useState([])
  const [cargandoFEL, setCargandoFEL] = useState(false)
  const [fechaInicioFEL, setFechaInicioFEL] = useState(new Date().toISOString().split('T')[0])
  const [fechaFinFEL, setFechaFinFEL] = useState(new Date().toISOString().split('T')[0])
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [itemsFEL, setItemsFEL] = useState({})

  // Facturas proveedores
  const [facturasProveedores, setFacturasProveedores] = useState([])
  const [showFormProveedor, setShowFormProveedor] = useState(false)
  const [formProveedor, setFormProveedor] = useState({
    proveedor: '', numero_factura: '', fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', descripcion: '', monto: '', estado: 'pendiente', notas: ''
  })
  const [guardandoProveedor, setGuardandoProveedor] = useState(false)

  const { toasts, toast } = useToast()
  const hoy = new Date().toISOString().split('T')[0]
  const OAKLAND_ID = '85da69a8-1e81-48a7-8b0d-82df9eeec15e'

  useEffect(() => {
    if (!session) { router.push('/'); return }
    async function init() {
      const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
      if (!p) { router.push('/'); return }
      const esAdmin = p.rol === 'admin'
      const esOakland = p.estacion_id === OAKLAND_ID
      if (!esAdmin && !esOakland) { router.push('/dashboard'); return }
      setPerfil(p)
      setEstacion(p.estaciones)
      setLoading(false)
    }
    init()
  }, [session])

  useEffect(() => {
    if (!loading) {
      cargarResumen(fechaResumen)
      cargarGastos(fechaResumen)
      cargarFacturasProveedores()
    }
  }, [loading])

  async function cargarResumen(fecha) {
    setCargandoResumen(true)

    // Ventas registradas manualmente
    const { data: venta } = await supabase.from('tienda_ventas')
      .select('*').eq('fecha', fecha).single()
    setRegistroVenta(venta || null)
    if (venta) {
      setFormVenta({
        efectivo: venta.efectivo || '',
        tarjeta: venta.tarjeta || '',
        neonet: venta.neonet || '',
        otros: venta.otros || '',
        notas: venta.notas || ''
      })
    } else {
      setFormVenta({ efectivo: '', tarjeta: '', neonet: '', otros: '', notas: '' })
    }

    // Facturas FEL del día
    const { data: fel } = await supabase.from('tienda_facturas_fel')
      .select('*').eq('fecha', fecha).eq('estado', 'pagada')
    const totalFEL = (fel || []).reduce((s, f) => s + parseFloat(f.monto || 0), 0)

    // Gastos del día
    const { data: gs } = await supabase.from('tienda_gastos').select('*').eq('fecha', fecha)
    const totalGastos = (gs || []).reduce((s, g) => s + parseFloat(g.monto || 0), 0)

    setResumen({
      totalFEL,
      cantidadFEL: (fel || []).length,
      totalGastos,
      gastos: gs || [],
    })
    setCargandoResumen(false)
  }

  async function cargarGastos(fecha) {
    const { data } = await supabase.from('tienda_gastos').select('*').eq('fecha', fecha).order('created_at', { ascending: false })
    setGastos(data || [])
  }

  async function cargarFacturasFEL() {
    setCargandoFEL(true)
    const { data } = await supabase.from('tienda_facturas_fel')
      .select('*')
      .gte('fecha', fechaInicioFEL)
      .lte('fecha', fechaFinFEL)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setFacturasFEL(data || [])
    setCargandoFEL(false)
  }

  async function cargarFacturasProveedores() {
    const { data } = await supabase.from('tienda_facturas_proveedores')
      .select('*').order('fecha_emision', { ascending: false })
    setFacturasProveedores(data || [])
  }

  async function verItemsFEL(facturaId) {
    if (detalleAbierto === facturaId) { setDetalleAbierto(null); return }
    setDetalleAbierto(facturaId)
    if (itemsFEL[facturaId]) return
    const { data } = await supabase.from('tienda_facturas_fel_items')
      .select('*').eq('factura_id', facturaId).order('id')
    setItemsFEL(prev => ({ ...prev, [facturaId]: data || [] }))
  }

  async function guardarVenta(e) {
    e.preventDefault()
    setGuardandoVenta(true)
    const efectivo = parseFloat(formVenta.efectivo) || 0
    const tarjeta = parseFloat(formVenta.tarjeta) || 0
    const neonet = parseFloat(formVenta.neonet) || 0
    const otros = parseFloat(formVenta.otros) || 0
    const totalVenta = efectivo + tarjeta + neonet + otros
    const totalGastosDia = gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0)

    const payload = {
      fecha: fechaResumen,
      total_venta: totalVenta,
      efectivo, tarjeta, neonet, otros,
      total_gastos: totalGastosDia,
      caja_neta: totalVenta - totalGastosDia,
      notas: formVenta.notas,
      creado_por: session.user.id
    }

    if (registroVenta) {
      const { error } = await supabase.from('tienda_ventas').update(payload).eq('id', registroVenta.id)
      if (error) toast('Error al actualizar', 'error')
      else toast('✓ Registro actualizado', 'success')
    } else {
      const { error } = await supabase.from('tienda_ventas').insert(payload)
      if (error) toast('Error al guardar', 'error')
      else toast('✓ Venta registrada', 'success')
    }

    await cargarResumen(fechaResumen)
    setGuardandoVenta(false)
  }

  async function guardarGasto(e) {
    e.preventDefault()
    setGuardandoGasto(true)
    const { error } = await supabase.from('tienda_gastos').insert({
      fecha: fechaResumen,
      descripcion: formGasto.descripcion,
      monto: parseFloat(formGasto.monto) || 0,
      categoria: formGasto.categoria,
      creado_por: session.user.id
    })
    if (error) toast('Error al guardar gasto', 'error')
    else {
      toast('✓ Gasto registrado', 'success')
      setFormGasto({ descripcion: '', monto: '', categoria: 'General' })
      setShowFormGasto(false)
      await cargarGastos(fechaResumen)
      await cargarResumen(fechaResumen)
    }
    setGuardandoGasto(false)
  }

  async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('tienda_gastos').delete().eq('id', id)
    await cargarGastos(fechaResumen)
    await cargarResumen(fechaResumen)
    toast('Gasto eliminado', 'info')
  }

  async function guardarProveedor(e) {
    e.preventDefault()
    setGuardandoProveedor(true)
    const { error } = await supabase.from('tienda_facturas_proveedores').insert({
      ...formProveedor,
      monto: parseFloat(formProveedor.monto) || 0,
      creado_por: session.user.id
    })
    if (error) toast('Error al guardar', 'error')
    else {
      toast('✓ Factura de proveedor registrada', 'success')
      setFormProveedor({ proveedor: '', numero_factura: '', fecha_emision: hoy, fecha_vencimiento: '', descripcion: '', monto: '', estado: 'pendiente', notas: '' })
      setShowFormProveedor(false)
      await cargarFacturasProveedores()
    }
    setGuardandoProveedor(false)
  }

  async function cambiarEstadoProveedor(id, estado) {
    await supabase.from('tienda_facturas_proveedores').update({ estado }).eq('id', id)
    setFacturasProveedores(prev => prev.map(f => f.id === id ? { ...f, estado } : f))
    toast('Estado actualizado', 'info')
  }

  async function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const filas = facturasFEL.map(f => ({
      Fecha: f.fecha, 'No. Factura': f.numero_factura,
      Cliente: f.nombre_cliente, NIT: f.nit_cliente,
      'Monto (Q)': parseFloat(f.monto || 0), Tipo: f.tipo_documento
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas clientes')
    XLSX.writeFile(wb, `Tienda_Oakland_${fechaInicioFEL}_al_${fechaFinFEL}.xlsx`)
    toast('✓ Excel descargado', 'success')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const totalCobros = (parseFloat(formVenta.efectivo) || 0) + (parseFloat(formVenta.tarjeta) || 0) + (parseFloat(formVenta.neonet) || 0) + (parseFloat(formVenta.otros) || 0)
  const totalGastosDia = gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0)
  const cajaNeta = totalCobros - totalGastosDia

  const estadoColor = {
    pendiente: 'bg-amber-50 text-amber-600',
    pagada: 'bg-green-50 text-green-700',
    vencida: 'bg-red-50 text-red-600'
  }

  const totalProveedoresPendientes = facturasProveedores
    .filter(f => f.estado === 'pendiente' || f.estado === 'vencida')
    .reduce((s, f) => s + parseFloat(f.monto || 0), 0)

  const categorias = ['General', 'Limpieza', 'Mantenimiento', 'Personal', 'Servicios', 'Otros']

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-4xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Tienda de Conveniencia Oakland</h1>
          <p className="text-sm text-gray-400">Panel administrativo</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-100 overflow-x-auto">
          {[
            ['resumen', 'Resumen diario'],
            ['facturas-fel', 'Facturas clientes (FEL)'],
            ['proveedores', 'Facturas proveedores'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => {
              setTab(key)
              if (key === 'facturas-fel') cargarFacturasFEL()
            }}
              className={`px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
              {key === 'proveedores' && totalProveedoresPendientes > 0 && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  Q{Math.round(totalProveedoresPendientes).toLocaleString('es-GT')}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Resumen diario ── */}
        {tab === 'resumen' && (
          <div className="space-y-4">
            {/* Selector de fecha */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                  <input type="date" value={fechaResumen} max={hoy}
                    onChange={e => { setFechaResumen(e.target.value); cargarResumen(e.target.value); cargarGastos(e.target.value) }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-full" />
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setFechaResumen(hoy); cargarResumen(hoy); cargarGastos(hoy) }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${fechaResumen === hoy ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    Hoy
                  </button>
                </div>
              </div>
            </div>

            {cargandoResumen ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <>
                {/* Tarjetas resumen */}
                {resumen && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-xs text-blue-600 mb-1">Ventas FEL</div>
                      <div className="text-xl font-medium text-blue-800">Q{resumen.totalFEL.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
                      <div className="text-xs text-blue-400 mt-0.5">{resumen.cantidadFEL} facturas</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="text-xs text-green-600 mb-1">Total cobros</div>
                      <div className="text-xl font-medium text-green-800">Q{totalCobros.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4">
                      <div className="text-xs text-amber-600 mb-1">Total gastos</div>
                      <div className="text-xl font-medium text-amber-800">Q{totalGastosDia.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className={`rounded-xl p-4 ${cajaNeta >= 0 ? 'bg-gray-50' : 'bg-red-50'}`}>
                      <div className={`text-xs mb-1 ${cajaNeta >= 0 ? 'text-gray-600' : 'text-red-600'}`}>Caja neta</div>
                      <div className={`text-xl font-medium ${cajaNeta >= 0 ? 'text-gray-800' : 'text-red-700'}`}>Q{cajaNeta.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                )}

                {/* Formas de cobro */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="text-sm font-medium text-gray-700 mb-3">Formas de cobro del día</h2>
                  <form onSubmit={guardarVenta} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {[
                        { key: 'efectivo', label: 'Efectivo' },
                        { key: 'tarjeta', label: 'Tarjeta' },
                        { key: 'neonet', label: 'Neonet' },
                        { key: 'otros', label: 'Otros' },
                      ].map(m => (
                        <div key={m.key}>
                          <label className="text-xs text-gray-500 block mb-1">{m.label} (Q)</label>
                          <input type="number" min="0" step="0.01"
                            value={formVenta[m.key]}
                            onChange={e => setFormVenta(f => ({ ...f, [m.key]: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                      ))}
                    </div>
                    {totalCobros > 0 && (
                      <div className="border-t border-gray-100 pt-3 mb-3 flex justify-between text-sm font-medium text-gray-800">
                        <span>Total cobros</span>
                        <span>Q{totalCobros.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 block mb-1">Notas</label>
                      <input value={formVenta.notas} onChange={e => setFormVenta(f => ({ ...f, notas: e.target.value }))}
                        placeholder="Observaciones del día..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" disabled={guardandoVenta}
                        className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                        {guardandoVenta && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        {guardandoVenta ? 'Guardando...' : registroVenta ? 'Actualizar registro' : 'Guardar registro'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Gastos */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-gray-700">Gastos del día</h2>
                    <button onClick={() => setShowFormGasto(!showFormGasto)}
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                      + Agregar gasto
                    </button>
                  </div>

                  {showFormGasto && (
                    <form onSubmit={guardarGasto} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                      className="bg-gray-50 rounded-xl p-4 mb-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                          <input value={formGasto.descripcion} onChange={e => setFormGasto(f => ({ ...f, descripcion: e.target.value }))} required
                            placeholder="Ej: Compra de bolsas"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Monto (Q)</label>
                          <input type="number" min="0" step="0.01" value={formGasto.monto}
                            onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))} required
                            placeholder="0.00"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Categoría</label>
                          <select value={formGasto.categoria} onChange={e => setFormGasto(f => ({ ...f, categoria: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                            {categorias.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowFormGasto(false)}
                          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                        <button type="submit" disabled={guardandoGasto}
                          className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {guardandoGasto ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  )}

                  {gastos.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">Sin gastos registrados para este día</div>
                  ) : (
                    <div className="space-y-1">
                      {gastos.map(g => (
                        <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <div className="text-sm text-gray-700">{g.descripcion}</div>
                            <div className="text-xs text-gray-400">{g.categoria}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-800">Q{parseFloat(g.monto).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                            <button onClick={() => eliminarGasto(g.id)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 text-sm font-medium text-gray-800">
                        <span>Total gastos</span>
                        <span>Q{totalGastosDia.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Facturas FEL clientes ── */}
        {tab === 'facturas-fel' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fecha inicio</label>
                  <input type="date" value={fechaInicioFEL} onChange={e => setFechaInicioFEL(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fecha fin</label>
                  <input type="date" value={fechaFinFEL} onChange={e => setFechaFinFEL(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {[
                    { label: 'Hoy', fn: () => { setFechaInicioFEL(hoy); setFechaFinFEL(hoy) } },
                    { label: 'Este mes', fn: () => { const d = new Date(); setFechaInicioFEL(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); setFechaFinFEL(hoy) } },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.fn}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                      {btn.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={exportarExcel} disabled={facturasFEL.length === 0}
                    className="text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50">
                    ↓ Excel
                  </button>
                  <button onClick={cargarFacturasFEL} disabled={cargandoFEL}
                    className="text-xs px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                    {cargandoFEL && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            {facturasFEL.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-600 mb-1">Total facturas</div>
                  <div className="text-xl font-medium text-blue-800">{facturasFEL.length}</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-600 mb-1">Monto total</div>
                  <div className="text-xl font-medium text-blue-800">
                    Q{facturasFEL.reduce((s, f) => s + parseFloat(f.monto || 0), 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-600 mb-1">Promedio</div>
                  <div className="text-xl font-medium text-blue-800">
                    Q{(facturasFEL.reduce((s, f) => s + parseFloat(f.monto || 0), 0) / facturasFEL.length).toLocaleString('es-GT', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {cargandoFEL ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
              ) : facturasFEL.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">Selecciona un período y presiona Buscar</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">No. Factura</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Cliente</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Monto</th>
                      <th className="px-4 py-2.5 text-center text-xs text-gray-400 font-normal">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFEL.map(f => (
                      <>
                        <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-xs text-gray-600">{f.fecha}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-600">{f.numero_factura}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{f.nombre_cliente}</td>
                          <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                            Q{parseFloat(f.monto).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => verItemsFEL(f.id)} className="text-xs text-blue-600 hover:text-blue-800">
                              {detalleAbierto === f.id ? '▲' : '▼'}
                            </button>
                          </td>
                        </tr>
                        {detalleAbierto === f.id && (
                          <tr key={f.id + '-det'} className="border-b border-gray-100">
                            <td colSpan={5} className="px-4 py-3 bg-blue-50/40">
                              {!itemsFEL[f.id] ? (
                                <div className="text-xs text-gray-400 text-center">Cargando...</div>
                              ) : itemsFEL[f.id].length === 0 ? (
                                <div className="text-xs text-gray-400 text-center">Sin detalle</div>
                              ) : (
                                <div>
                                  {itemsFEL[f.id].map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs py-1.5 border-b border-blue-50 last:border-0">
                                      <span className="text-gray-700 font-medium">{item.descripcion} <span className="text-gray-400 font-normal">x{parseFloat(item.cantidad)}</span></span>
                                      <span className="text-gray-800">Q{parseFloat(item.total).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Facturas proveedores ── */}
        {tab === 'proveedores' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <div className="bg-amber-50 rounded-xl px-4 py-3">
                  <div className="text-xs text-amber-600 mb-0.5">Por pagar</div>
                  <div className="text-lg font-medium text-amber-800">
                    Q{facturasProveedores.filter(f => f.estado === 'pendiente' || f.estado === 'vencida').reduce((s, f) => s + parseFloat(f.monto || 0), 0).toLocaleString('es-GT', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl px-4 py-3">
                  <div className="text-xs text-red-600 mb-0.5">Vencidas</div>
                  <div className="text-lg font-medium text-red-800">
                    {facturasProveedores.filter(f => f.estado === 'vencida').length}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowFormProveedor(!showFormProveedor)}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
                + Registrar factura
              </button>
            </div>

            {showFormProveedor && (
              <form onSubmit={guardarProveedor} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                className="bg-white rounded-xl border border-blue-100 p-5">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Nueva factura de proveedor</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
                    <input value={formProveedor.proveedor} onChange={e => setFormProveedor(f => ({ ...f, proveedor: e.target.value }))} required
                      placeholder="Nombre del proveedor"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">No. Factura</label>
                    <input value={formProveedor.numero_factura} onChange={e => setFormProveedor(f => ({ ...f, numero_factura: e.target.value }))}
                      placeholder="001-001-000001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha emisión</label>
                    <input type="date" value={formProveedor.fecha_emision} onChange={e => setFormProveedor(f => ({ ...f, fecha_emision: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha vencimiento</label>
                    <input type="date" value={formProveedor.fecha_vencimiento} onChange={e => setFormProveedor(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Monto (Q)</label>
                    <input type="number" min="0" step="0.01" value={formProveedor.monto} onChange={e => setFormProveedor(f => ({ ...f, monto: e.target.value }))} required
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Estado</label>
                    <select value={formProveedor.estado} onChange={e => setFormProveedor(f => ({ ...f, estado: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                      <option value="pendiente">Pendiente</option>
                      <option value="pagada">Pagada</option>
                      <option value="vencida">Vencida</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                    <input value={formProveedor.descripcion} onChange={e => setFormProveedor(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Descripción de la factura"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Notas</label>
                    <input value={formProveedor.notas} onChange={e => setFormProveedor(f => ({ ...f, notas: e.target.value }))}
                      placeholder="Notas adicionales"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-4">
                  <button type="button" onClick={() => setShowFormProveedor(false)}
                    className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={guardandoProveedor}
                    className="text-sm px-5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {guardandoProveedor ? 'Guardando...' : 'Guardar factura'}
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {facturasProveedores.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">Sin facturas de proveedores registradas</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Proveedor</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Emisión</th>
                      <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Vencimiento</th>
                      <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Monto</th>
                      <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasProveedores.map(f => (
                      <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50 ${f.estado === 'vencida' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-800">{f.proveedor}</div>
                          {f.numero_factura && <div className="text-xs text-gray-400">{f.numero_factura}</div>}
                          {f.descripcion && <div className="text-xs text-gray-400">{f.descripcion}</div>}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600">{f.fecha_emision}</td>
                        <td className="px-3 py-3 text-xs text-gray-600">{f.fecha_vencimiento || '—'}</td>
                        <td className="px-3 py-3 text-right font-medium text-gray-800">
                          Q{parseFloat(f.monto).toLocaleString('es-GT', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <select value={f.estado} onChange={e => cambiarEstadoProveedor(f.id, e.target.value)}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${estadoColor[f.estado]}`}>
                            <option value="pendiente">Pendiente</option>
                            <option value="pagada">Pagada</option>
                            <option value="vencida">Vencida</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
