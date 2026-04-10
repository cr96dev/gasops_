import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'

const PRODUCTOS = [
  { sku: 'MPPDVP-43', nombre: 'Impulse 4T 10W40', precio: 68.00 },
  { sku: 'MPPDVP-54', nombre: 'SYNCHRON ATF FULL', precio: 73.00 },
  { sku: 'MPPDVP-53', nombre: 'CUBETA 15W40', precio: 678.00 },
  { sku: 'MPPDVP-52', nombre: 'CUBETA 20W50', precio: 700.00 },
  { sku: 'MPPDVP-51', nombre: 'SHELL ADVANCE SAE 10W-40 ULTRA', precio: 91.00 },
  { sku: 'MPPDVP-50', nombre: 'PLUMILLAS BOSCH', precio: 135.00 },
  { sku: 'MPPDVP-49', nombre: 'POWER STEERING 12 ONZAS', precio: 27.50 },
  { sku: 'MPPDVP-48', nombre: 'LIQUIDO DE FRENOS', precio: 29.50 },
  { sku: 'MPPDVP-47', nombre: 'REFRIGERANTE TOP GUARD', precio: 34.50 },
  { sku: 'MPPDVP-46', nombre: 'SHELL SPIRAX S5 ATF X', precio: 85.00 },
  { sku: 'MPPDVP-45', nombre: 'SHELL SPIRAX S3 ATF MD3 LITRO', precio: 69.00 },
  { sku: 'MPPDVP-44', nombre: 'RIMULA R4X 15W-40 GRIS GALÓN', precio: 282.00 },
  { sku: 'MPPDVP-43B', nombre: 'RIMULA R4X 15W-40 GRIS LITRO', precio: 70.00 },
  { sku: 'MPPDVP-42', nombre: 'HELIX ULTRA 5W-40 GALÓN', precio: 415.00 },
  { sku: 'MPPDVP-41', nombre: 'HELIX ULTRA 5W-40 LITRO', precio: 91.00 },
  { sku: 'MPPDVP-40', nombre: 'HELIX ULTRA 5W-30 GALÓN', precio: 415.00 },
  { sku: 'MPPDVP-39', nombre: 'HELIX HX8 5W-30 LITRO', precio: 87.00 },
  { sku: 'MPPDVP-38', nombre: 'HELIX ULTRA 5W-30 LITRO', precio: 91.00 },
  { sku: 'MPPDVP-37', nombre: 'HELIX HX7 SN 10W-30 AZUL GALÓN', precio: 315.00 },
  { sku: 'MPPDVP-36', nombre: 'HELIX HX7 SN 10W-30 AZUL LITRO', precio: 78.00 },
  { sku: 'MPPDVP-35', nombre: 'HELIX HX5 20W-50 GALÓN', precio: 265.00 },
  { sku: 'MPPDVP-34', nombre: 'HELIX HX5 20W-50 LITRO', precio: 66.00 },
  { sku: 'MPPDVP-33', nombre: 'HELIX HX3 25W-60 GALÓN', precio: 272.00 },
  { sku: 'MPPDVP-32', nombre: 'HELIX HX3 25W-60 LITRO', precio: 67.00 },
  { sku: 'MPPDVP-31', nombre: 'HELIX HX3 SAE 40 GALÓN', precio: 250.00 },
  { sku: 'MPPDVP-30', nombre: 'HELIX HX3 SAE 40 LITRO', precio: 63.00 },
  { sku: 'MPPDVP-29', nombre: 'SHELL ADVANCE AX5 4T 20W50 LITRO', precio: 67.00 },
  { sku: 'MPPDVP-28', nombre: 'SHELL ADVANCE S2 DOS TT LITRO', precio: 67.00 },
  { sku: 'MPPDVP-27', nombre: 'TP Fuel Injector PINTA 12 OZ', precio: 28.00 },
  { sku: 'MPPDVP-26', nombre: 'UNO Impulse 2T LITRO', precio: 52.00 },
  { sku: 'MPPDVP-25', nombre: 'FORZA EURO SAE 5W-40 1 LITRO', precio: 81.00 },
  { sku: 'MPPDVP-24', nombre: 'UNO ULTRA FULL SYNT 5W-30', precio: 75.00 },
  { sku: 'MPPDVP-23', nombre: 'UNO Forza 50 1 LITRO', precio: 52.00 },
  { sku: 'MPPDVP-22', nombre: 'UNO Forza 15W-40 1 LITRO', precio: 53.00 },
  { sku: 'MPPDVP-21', nombre: 'TP Power Steering F PINTA 12 OZ', precio: 22.00 },
  { sku: 'MPPDVP-20', nombre: 'TP Brake Fluid PINTA 12 OZ', precio: 24.00 },
  { sku: 'MPPDVP-19', nombre: 'TP COOLANT 50/50 1 GALON', precio: 104.00 },
  { sku: 'MPPDVP-18', nombre: 'TP COOLANT 50/50 1 LITRO', precio: 29.00 },
  { sku: 'MPPDVP-17', nombre: 'UNO Synchron ATF 1 LITRO', precio: 50.00 },
  { sku: 'MPPDVP-16', nombre: 'UNO Ultra 40 1 GALON', precio: 173.00 },
  { sku: 'MPPDVP-15', nombre: 'UNO Ultra 40 1 LITRO', precio: 52.00 },
  { sku: 'MPPDVP-14', nombre: 'UNO Ultra 20W-50 1 GALON', precio: 192.00 },
  { sku: 'MPPDVP-13', nombre: 'UNO Ultra 15W-40 1 GALON', precio: 185.00 },
  { sku: 'MPPDVP-12', nombre: 'UNO Ultra 20W-50 1 LITRO', precio: 60.00 },
  { sku: 'MPPDVP-11', nombre: 'UNO Impulse 4T 20W-50 1 LITRO', precio: 51.00 },
  { sku: 'MPPDVP-10', nombre: 'UNO Ultra 10W-30 GALON', precio: 192.00 },
  { sku: 'MPPDVP-9',  nombre: 'UNO Ultra 10W-30 1 LITRO', precio: 60.00 },
  { sku: 'MPPDVP-8',  nombre: 'Prodin Agua Destilada 18oz', precio: 20.00 },
  { sku: 'MPPDVP-7',  nombre: 'Prodin Activador Electrolitico 18oz', precio: 22.00 },
  { sku: 'MPPDVP-6',  nombre: 'Garantía x Lluvia', precio: 15.00 },
]

export default function Lubricantes({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [registroHoy, setRegistroHoy] = useState(null)
  const [detalleAbierto, setDetalleAbierto] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [itemsSeleccionados, setItemsSeleccionados] = useState([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [neonet, setNeonet] = useState('')
  const [efectivo, setEfectivo] = useState('')
  const [notas, setNotas] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const { toasts, toast } = useToast()
  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  useEffect(() => {
    if (perfil?.estacion_id) verificarFecha(fecha)
  }, [fecha, perfil])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p); setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      await verificarFecha(fecha, p.estacion_id)
      const { data: h } = await supabase.from('ventas_lubricantes')
        .select('*, ventas_lubricantes_detalle(*)')
        .eq('estacion_id', p.estacion_id)
        .order('fecha', { ascending: false })
        .limit(15)
      setHistorial(h || [])
    }
    setLoading(false)
  }

  async function verificarFecha(f, eid) {
    const estacionId = eid || perfil?.estacion_id
    if (!estacionId) return
    const { data } = await supabase.from('ventas_lubricantes')
      .select('*, ventas_lubricantes_detalle(*)')
      .eq('estacion_id', estacionId)
      .eq('fecha', f)
      .single()
    setRegistroHoy(data || null)
  }

  function agregarProducto(producto) {
    if (itemsSeleccionados.find(i => i.sku === producto.sku)) return
    setItemsSeleccionados(prev => [...prev, {
      sku: producto.sku,
      nombre: producto.nombre,
      cantidad: 1,
      precio: producto.precio,
    }])
    setBusqueda('')
  }

  function actualizarItem(sku, campo, valor) {
    setItemsSeleccionados(prev => prev.map(i =>
      i.sku === sku ? { ...i, [campo]: valor } : i
    ))
  }

  function quitarItem(sku) {
    setItemsSeleccionados(prev => prev.filter(i => i.sku !== sku))
  }

  function totalVenta() {
    return itemsSeleccionados.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio) || 0), 0)
  }

  function totalCobros() {
    return (parseFloat(neonet) || 0) + (parseFloat(efectivo) || 0)
  }

  function diferencia() {
    return totalVenta() - totalCobros()
  }

  const productosFiltrados = PRODUCTOS.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.sku.toLowerCase().includes(busqueda.toLowerCase())
  ).slice(0, 8)

  async function guardar(e) {
    e.preventDefault()
    setErrorMsg('')

    if (itemsSeleccionados.length === 0) {
      setErrorMsg('Agrega al menos un producto.')
      return
    }

    setGuardando(true)

    const total_venta = totalVenta()

    const { data: venta, error } = await supabase.from('ventas_lubricantes').insert({
      estacion_id: perfil.estacion_id,
      fecha,
      neonet: parseFloat(neonet) || 0,
      efectivo: parseFloat(efectivo) || 0,
      total_venta,
      notas,
      creado_por: session.user.id,
    }).select().single()

    if (error) {
      setErrorMsg(`Error: ${error.message}`)
      setGuardando(false)
      return
    }

    // Insertar detalle
    const detalles = itemsSeleccionados.map(i => ({
      venta_id: venta.id,
      sku: i.sku,
      nombre: i.nombre,
      cantidad: parseFloat(i.cantidad) || 0,
      precio_unitario: parseFloat(i.precio) || 0,
      subtotal: (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio) || 0),
    }))

    const { error: errorDetalle } = await supabase.from('ventas_lubricantes_detalle').insert(detalles)

    if (errorDetalle) {
      setErrorMsg(`Error en detalle: ${errorDetalle.message}`)
      setGuardando(false)
      return
    }

    setItemsSeleccionados([])
    setNeonet(''); setEfectivo(''); setNotas('')
    toast('✓ Ventas de lubricantes registradas', 'success')
    await loadData()
    setGuardando(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const diff = diferencia()
  const esFuturo = fecha > hoy

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-3xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Ventas de lubricantes</h1>
          <p className="text-sm text-gray-400">{estacion?.nombre}</p>
        </div>

        {/* Selector de fecha */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Fecha del registro</label>
              <input type="date" value={fecha} max={hoy}
                onChange={e => setFecha(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-full" />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setFecha(hoy)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${fecha === hoy ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                Hoy
              </button>
              <button type="button" onClick={() => {
                const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
                setFecha(ayer.toISOString().split('T')[0])
              }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                Ayer
              </button>
            </div>
          </div>
          {fecha !== hoy && !esFuturo && (
            <div className="mt-2 flex items-center gap-2 text-amber-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs">Registro retroactivo para el {new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { dateStyle: 'long' })}</span>
            </div>
          )}
        </div>

        {esFuturo ? (
          <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-xs text-red-600">
            No puedes registrar ventas para fechas futuras.
          </div>
        ) : registroHoy ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-green-800">Registro del {new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { dateStyle: 'long' })} ya existe</div>
                <div className="text-xs text-green-600 mt-0.5">No puede modificarse. Contacta al administrador si hay un error.</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Productos vendidos</h2>
              {(registroHoy.ventas_lubricantes_detalle || []).map(d => (
                <div key={d.id} className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                  <div>
                    <span className="text-gray-700">{d.nombre}</span>
                    <span className="text-xs text-gray-400 ml-2">x{d.cantidad}</span>
                  </div>
                  <span className="text-gray-800 font-medium">Q{parseFloat(d.subtotal).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1 text-sm font-medium text-gray-800">
                <span>Total venta</span>
                <span>Q{parseFloat(registroHoy.total_venta).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Formas de cobro</h2>
              {parseFloat(registroHoy.neonet) > 0 && (
                <div className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                  <span className="text-gray-600">Neonet</span>
                  <span className="text-gray-800">Q{parseFloat(registroHoy.neonet).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {parseFloat(registroHoy.efectivo) > 0 && (
                <div className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                  <span className="text-gray-600">Efectivo</span>
                  <span className="text-gray-800">Q{parseFloat(registroHoy.efectivo).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {(() => {
                const dif = parseFloat(registroHoy.total_venta) - (parseFloat(registroHoy.neonet) + parseFloat(registroHoy.efectivo))
                return (
                  <div className={`flex justify-between pt-2 mt-1 text-sm font-medium ${Math.abs(dif) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                    <span>Diferencia</span>
                    <span>{Math.abs(dif) < 0.01 ? '✓ Cuadra' : `Q${dif.toFixed(2)}`}</span>
                  </div>
                )
              })()}
            </div>
          </div>
        ) : (
          <form onSubmit={guardar} className="space-y-4">

            {/* Buscador de productos */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Agregar productos</h2>
              <div className="relative mb-3">
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 pr-8"
                />
                {busqueda && (
                  <button type="button" onClick={() => setBusqueda('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>

              {busqueda && (
                <div className="border border-gray-100 rounded-lg overflow-hidden mb-3">
                  {productosFiltrados.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center">Sin resultados</div>
                  )}
                  {productosFiltrados.map(p => (
                    <button key={p.sku} type="button" onClick={() => agregarProducto(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                      <div className="text-left">
                        <div className="text-xs font-medium text-gray-800">{p.nombre}</div>
                        <div className="text-xs text-gray-400">{p.sku}</div>
                      </div>
                      <div className="text-xs font-medium text-blue-600 ml-4">Q{p.precio.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Productos seleccionados */}
              {itemsSeleccionados.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 border-b border-gray-100">
                    <div className="col-span-5 text-xs text-gray-400 font-medium">Producto</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium text-center">Cant.</div>
                    <div className="col-span-3 text-xs text-gray-400 font-medium text-center">Precio</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium text-right">Total</div>
                  </div>
                  {itemsSeleccionados.map(item => (
                    <div key={item.sku} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-gray-50 last:border-0">
                      <div className="col-span-5">
                        <div className="text-xs font-medium text-gray-800 leading-tight">{item.nombre}</div>
                        <button type="button" onClick={() => quitarItem(item.sku)}
                          className="text-xs text-red-400 hover:text-red-600 mt-0.5">Quitar</button>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.01"
                          value={item.cantidad}
                          onChange={e => actualizarItem(item.sku, 'cantidad', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-400" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01"
                          value={item.precio}
                          onChange={e => actualizarItem(item.sku, 'precio', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-400" />
                      </div>
                      <div className="col-span-2 text-xs font-medium text-gray-800 text-right">
                        Q{((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio) || 0)).toLocaleString('es-GT', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                    <div className="col-span-10 text-xs font-medium text-gray-600">Total venta</div>
                    <div className="col-span-2 text-sm font-medium text-gray-800 text-right">
                      Q{totalVenta().toLocaleString('es-GT', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}

              {itemsSeleccionados.length === 0 && !busqueda && (
                <div className="text-center py-4 text-xs text-gray-400">
                  Busca un producto para agregarlo
                </div>
              )}
            </div>

            {/* Formas de cobro */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Formas de cobro</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Neonet (Q)</label>
                  <input type="number" min="0" step="0.01" value={neonet}
                    onChange={e => setNeonet(e.target.value)} placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Efectivo (Q)</label>
                  <input type="number" min="0" step="0.01" value={efectivo}
                    onChange={e => setEfectivo(e.target.value)} placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              {(neonet || efectivo) && (
                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total venta</span>
                    <span className="font-medium text-gray-800">Q{totalVenta().toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total cobros</span>
                    <span className="font-medium text-gray-800">Q{totalCobros().toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-medium pt-1 border-t border-gray-100 ${Math.abs(diff) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                    <span>Diferencia</span>
                    <span>{Math.abs(diff) < 0.01 ? '✓ Cuadra' : `Q${diff.toFixed(2)}`}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <label className="text-xs text-gray-500 block mb-1">Observaciones (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Notas del día..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <p className="text-xs text-amber-700">Una vez guardado el registro no podrá ser modificado.</p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-xs text-red-700">{errorMsg}</div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={guardando}
                className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {guardando && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {guardando ? 'Guardando...' : 'Guardar registro'}
              </button>
            </div>
          </form>
        )}

        {/* Historial */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mt-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Historial reciente</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Total Q</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Neonet</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Efectivo</th>
                <th className="px-4 py-2.5 text-center text-xs text-gray-400 font-normal">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-xs text-gray-400">Sin registros aún</td></tr>
              )}
              {historial.map(v => (
                <>
                  <tr key={v.id}
                    onClick={() => setFecha(v.fecha)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-3 text-gray-700">
                      {v.fecha}
                      {v.fecha === hoy && <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Hoy</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">Q{parseFloat(v.total_venta).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.neonet) > 0 ? `Q${parseFloat(v.neonet).toLocaleString('es-GT', { maximumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.efectivo) > 0 ? `Q${parseFloat(v.efectivo).toLocaleString('es-GT', { maximumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={e => { e.stopPropagation(); setDetalleAbierto(detalleAbierto === v.id ? null : v.id) }}
                        className="text-xs text-blue-600 hover:text-blue-800">
                        {detalleAbierto === v.id ? '▲ Cerrar' : '▼ Ver'}
                      </button>
                    </td>
                  </tr>
                  {detalleAbierto === v.id && (
                    <tr key={`${v.id}-det`} className="border-b border-gray-100">
                      <td colSpan={5} className="px-5 py-3 bg-gray-50">
                        <div className="space-y-1">
                          {(v.ventas_lubricantes_detalle || []).map(d => (
                            <div key={d.id} className="flex justify-between text-xs">
                              <span className="text-gray-600">{d.nombre} <span className="text-gray-400">x{d.cantidad}</span></span>
                              <span className="text-gray-700 font-medium">Q{parseFloat(d.subtotal).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                        {v.notas && <div className="mt-2 text-xs text-gray-400">Notas: {v.notas}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
