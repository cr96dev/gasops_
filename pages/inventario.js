import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import * as XLSX from 'xlsx'

const PRODUCTOS_CATALOGO = [
  { sku: 'MPPDVP-43',  nombre: 'Impulse 4T 10W40',                   categoria: 'Aceites 4T',     unidad: 'Litro' },
  { sku: 'MPPDVP-54',  nombre: 'SYNCHRON ATF FULL',                   categoria: 'ATF',            unidad: 'Litro' },
  { sku: 'MPPDVP-53',  nombre: 'CUBETA 15W40',                        categoria: 'Aceites Diesel', unidad: 'Cubeta' },
  { sku: 'MPPDVP-52',  nombre: 'CUBETA 20W50',                        categoria: 'Aceites Motor',  unidad: 'Cubeta' },
  { sku: 'MPPDVP-51',  nombre: 'SHELL ADVANCE SAE 10W-40 ULTRA',      categoria: 'Aceites 4T',     unidad: 'Litro' },
  { sku: 'MPPDVP-50',  nombre: 'PLUMILLAS BOSCH',                     categoria: 'Accesorios',     unidad: 'Par' },
  { sku: 'MPPDVP-49',  nombre: 'POWER STEERING 12 ONZAS',             categoria: 'Fluidos',        unidad: 'Pinta' },
  { sku: 'MPPDVP-48',  nombre: 'LIQUIDO DE FRENOS',                   categoria: 'Fluidos',        unidad: 'Pinta' },
  { sku: 'MPPDVP-47',  nombre: 'REFRIGERANTE TOP GUARD',              categoria: 'Fluidos',        unidad: 'Litro' },
  { sku: 'MPPDVP-46',  nombre: 'SHELL SPIRAX S5 ATF X',               categoria: 'ATF',            unidad: 'Litro' },
  { sku: 'MPPDVP-45',  nombre: 'SHELL SPIRAX S3 ATF MD3 LITRO',       categoria: 'ATF',            unidad: 'Litro' },
  { sku: 'MPPDVP-44',  nombre: 'RIMULA R4X 15W-40 GRIS GALÓN',        categoria: 'Aceites Diesel', unidad: 'Galón' },
  { sku: 'MPPDVP-43B', nombre: 'RIMULA R4X 15W-40 GRIS LITRO',        categoria: 'Aceites Diesel', unidad: 'Litro' },
  { sku: 'MPPDVP-42',  nombre: 'HELIX ULTRA 5W-40 GALÓN',             categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-41',  nombre: 'HELIX ULTRA 5W-40 LITRO',             categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-40',  nombre: 'HELIX ULTRA 5W-30 GALÓN',             categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-39',  nombre: 'HELIX HX8 5W-30 LITRO',               categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-38',  nombre: 'HELIX ULTRA 5W-30 LITRO',             categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-37',  nombre: 'HELIX HX7 SN 10W-30 AZUL GALÓN',     categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-36',  nombre: 'HELIX HX7 SN 10W-30 AZUL LITRO',     categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-35',  nombre: 'HELIX HX5 20W-50 GALÓN',              categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-34',  nombre: 'HELIX HX5 20W-50 LITRO',              categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-33',  nombre: 'HELIX HX3 25W-60 GALÓN',              categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-32',  nombre: 'HELIX HX3 25W-60 LITRO',              categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-31',  nombre: 'HELIX HX3 SAE 40 GALÓN',              categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-30',  nombre: 'HELIX HX3 SAE 40 LITRO',              categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-29',  nombre: 'SHELL ADVANCE AX5 4T 20W50 LITRO',    categoria: 'Aceites 4T',     unidad: 'Litro' },
  { sku: 'MPPDVP-28',  nombre: 'SHELL ADVANCE S2 DOS TT LITRO',       categoria: 'Aceites 2T',     unidad: 'Litro' },
  { sku: 'MPPDVP-27',  nombre: 'TP Fuel Injector PINTA 12 OZ',        categoria: 'Aditivos',       unidad: 'Pinta' },
  { sku: 'MPPDVP-26',  nombre: 'UNO Impulse 2T LITRO',                categoria: 'Aceites 2T',     unidad: 'Litro' },
  { sku: 'MPPDVP-25',  nombre: 'FORZA EURO SAE 5W-40 1 LITRO',        categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-24',  nombre: 'UNO ULTRA FULL SYNT 5W-30',           categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-23',  nombre: 'UNO Forza 50 1 LITRO',                categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-22',  nombre: 'UNO Forza 15W-40 1 LITRO',            categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-21',  nombre: 'TP Power Steering F PINTA 12 OZ',     categoria: 'Fluidos',        unidad: 'Pinta' },
  { sku: 'MPPDVP-20',  nombre: 'TP Brake Fluid PINTA 12 OZ',          categoria: 'Fluidos',        unidad: 'Pinta' },
  { sku: 'MPPDVP-19',  nombre: 'TP COOLANT 50/50 1 GALON',            categoria: 'Fluidos',        unidad: 'Galón' },
  { sku: 'MPPDVP-18',  nombre: 'TP COOLANT 50/50 1 LITRO',            categoria: 'Fluidos',        unidad: 'Litro' },
  { sku: 'MPPDVP-17',  nombre: 'UNO Synchron ATF 1 LITRO',            categoria: 'ATF',            unidad: 'Litro' },
  { sku: 'MPPDVP-16',  nombre: 'UNO Ultra 40 1 GALON',                categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-15',  nombre: 'UNO Ultra 40 1 LITRO',                categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-14',  nombre: 'UNO Ultra 20W-50 1 GALON',            categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-13',  nombre: 'UNO Ultra 15W-40 1 GALON',            categoria: 'Aceites Diesel', unidad: 'Galón' },
  { sku: 'MPPDVP-12',  nombre: 'UNO Ultra 20W-50 1 LITRO',            categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-11',  nombre: 'UNO Impulse 4T 20W-50 1 LITRO',       categoria: 'Aceites 4T',     unidad: 'Litro' },
  { sku: 'MPPDVP-10',  nombre: 'UNO Ultra 10W-30 GALON',              categoria: 'Aceites Motor',  unidad: 'Galón' },
  { sku: 'MPPDVP-9',   nombre: 'UNO Ultra 10W-30 1 LITRO',            categoria: 'Aceites Motor',  unidad: 'Litro' },
  { sku: 'MPPDVP-8',   nombre: 'Prodin Agua Destilada 18oz',          categoria: 'Fluidos',        unidad: 'Unidad' },
  { sku: 'MPPDVP-7',   nombre: 'Prodin Activador Electrolitico 18oz', categoria: 'Fluidos',        unidad: 'Unidad' },
  { sku: 'MPPDVP-6',   nombre: 'Garantía x Lluvia',                   categoria: 'Servicios',      unidad: 'Servicio' },
]

export default function Inventario({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [inventario, setInventario] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('actual')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState('Todas')

  // Entrega
  const [busquedaEntrega, setBusquedaEntrega] = useState('')
  const [itemsEntrega, setItemsEntrega] = useState([])
  const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split('T')[0])
  const [proveedorEntrega, setProveedorEntrega] = useState('')
  const [notasEntrega, setNotasEntrega] = useState('')
  const [guardandoEntrega, setGuardandoEntrega] = useState(false)
  const [errorEntrega, setErrorEntrega] = useState('')

  // Carga inicial Excel
  const [archivoInicial, setArchivoInicial] = useState(null)
  const [previaInicial, setPreviaInicial] = useState([])
  const [cargandoInicial, setCargandoInicial] = useState(false)
  const [errorInicial, setErrorInicial] = useState('')

  const [estaciones, setEstaciones] = useState([])
  const [estacionAdmin, setEstacionAdmin] = useState('')
  const { toasts, toast } = useToast()

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p); setEstacion(p?.estaciones)
    if (p?.rol === 'admin') {
      const { data: ests } = await supabase.from('estaciones').select('id, nombre').order('nombre')
      setEstaciones(ests || [])
    } else if (p?.estacion_id) {
      const { data } = await supabase.from('inventario').select('*')
        .eq('estacion_id', p.estacion_id).order('producto')
      setInventario(data || [])
    }
    setLoading(false)
  }

  async function cargarInventarioAdmin(estId) {
    setEstacionAdmin(estId)
    if (!estId) { setInventario([]); return }
    const { data } = await supabase.from('inventario').select('*')
      .eq('estacion_id', estId).order('producto')
    setInventario(data || [])
  }

  // ── Entrega desde app ──
  const productosFiltradosEntrega = PRODUCTOS_CATALOGO.filter(p =>
    p.nombre.toLowerCase().includes(busquedaEntrega.toLowerCase()) ||
    p.sku.toLowerCase().includes(busquedaEntrega.toLowerCase())
  ).slice(0, 8)

  function agregarProductoEntrega(producto) {
    if (itemsEntrega.find(i => i.sku === producto.sku)) return
    setItemsEntrega(prev => [...prev, { ...producto, cantidad: 1 }])
    setBusquedaEntrega('')
  }

  function actualizarItemEntrega(sku, cantidad) {
    setItemsEntrega(prev => prev.map(i => i.sku === sku ? { ...i, cantidad } : i))
  }

  function quitarItemEntrega(sku) {
    setItemsEntrega(prev => prev.filter(i => i.sku !== sku))
  }

  async function guardarEntrega(e) {
    e.preventDefault()
    setErrorEntrega('')
    if (itemsEntrega.length === 0) { setErrorEntrega('Agrega al menos un producto.'); return }
    if (itemsEntrega.some(i => !parseFloat(i.cantidad) || parseFloat(i.cantidad) <= 0)) {
      setErrorEntrega('Todos los productos deben tener una cantidad mayor a 0.')
      return
    }
    setGuardandoEntrega(true)

    let actualizados = 0; let insertados = 0; let errores = 0

    for (const item of itemsEntrega) {
      const cantidad = parseFloat(item.cantidad) || 0
      const { data: inv } = await supabase.from('inventario').select('id, stock_actual')
        .eq('estacion_id', perfil.estacion_id).ilike('producto', item.nombre).single()

      if (inv) {
        const nuevoStock = parseFloat(inv.stock_actual) + cantidad
        const { error } = await supabase.from('inventario').update({
          stock_actual: nuevoStock,
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id)
        if (error) errores++; else actualizados++
      } else {
        const { error } = await supabase.from('inventario').insert({
          estacion_id: perfil.estacion_id,
          producto: item.nombre,
          categoria: item.categoria,
          stock_actual: cantidad,
          stock_minimo: 0,
          unidad: item.unidad,
        })
        if (error) errores++; else insertados++
      }
    }

    toast(`✓ ${actualizados + insertados} productos actualizados${errores > 0 ? `, ${errores} errores` : ''}`, errores > 0 ? 'warning' : 'success')
    setItemsEntrega([])
    setProveedorEntrega('')
    setNotasEntrega('')
    setTab('actual')
    await loadData()
    setGuardandoEntrega(false)
  }

  // ── Carga inicial Excel ──
  function descargarPlantillaInicial() {
    const filas = PRODUCTOS_CATALOGO.map(p => ({
      SKU: p.sku, Producto: p.nombre, Categoría: p.categoria,
      'Stock actual': 0, 'Stock mínimo': 2, Unidad: p.unidad,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario inicial')
    XLSX.writeFile(wb, 'plantilla_inventario_inicial.xlsx')
    toast('Plantilla descargada', 'info')
  }

  function procesarArchivoInicial(e) {
    const file = e.target.files[0]
    if (!file) return
    setArchivoInicial(file); setErrorInicial(''); setPreviaInicial([])
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const datos = XLSX.utils.sheet_to_json(ws)
        if (datos.length === 0) { setErrorInicial('El archivo está vacío.'); return }
        const filas = datos.map(row => {
          const producto = row['Producto'] || row['producto'] || ''
          const sku = row['SKU'] || row['sku'] || ''
          const categoria = row['Categoría'] || row['Categoria'] || 'General'
          const cantidad = parseFloat(row['Stock actual'] || row['Cantidad'] || 0)
          const stockMinimo = parseFloat(row['Stock mínimo'] || row['Stock minimo'] || 0)
          const unidad = row['Unidad'] || row['unidad'] || 'Unidad'
          if (!producto) return null
          return { sku, producto, categoria, cantidad, stock_minimo: stockMinimo, unidad }
        }).filter(Boolean)
        if (filas.length === 0) { setErrorInicial('No se encontraron productos válidos.'); return }
        setPreviaInicial(filas)
      } catch (err) { setErrorInicial(`Error: ${err.message}`) }
    }
    reader.readAsBinaryString(file)
  }

  async function guardarCargaInicial() {
    if (previaInicial.length === 0) return
    setCargandoInicial(true)
    let insertados = 0; let actualizados = 0; let errores = 0

    for (const item of previaInicial) {
      const { data: existe } = await supabase.from('inventario').select('id')
        .eq('estacion_id', perfil.estacion_id).ilike('producto', item.producto).single()
      if (existe) {
        const { error } = await supabase.from('inventario').update({
          stock_actual: item.cantidad, stock_minimo: item.stock_minimo || 0,
          categoria: item.categoria, unidad: item.unidad,
          updated_at: new Date().toISOString(),
        }).eq('id', existe.id)
        if (error) errores++; else actualizados++
      } else {
        const { error } = await supabase.from('inventario').insert({
          estacion_id: perfil.estacion_id, producto: item.producto,
          categoria: item.categoria, stock_actual: item.cantidad,
          stock_minimo: item.stock_minimo || 0, unidad: item.unidad,
        })
        if (error) errores++; else insertados++
      }
    }

    toast(`✓ ${insertados} insertados, ${actualizados} actualizados${errores > 0 ? `, ${errores} errores` : ''}`, errores > 0 ? 'warning' : 'success')
    setPreviaInicial([]); setArchivoInicial(null)
    setTab('actual'); await loadData()
    setCargandoInicial(false)
  }

  async function actualizarStock(id, campo, valor) {
    await supabase.from('inventario').update({
      [campo]: parseFloat(valor) || 0,
      updated_at: new Date().toISOString()
    }).eq('id', id)
    setInventario(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  async function eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto del inventario?')) return
    await supabase.from('inventario').delete().eq('id', id)
    setInventario(prev => prev.filter(i => i.id !== id))
    toast('Producto eliminado', 'info')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const categorias = ['Todas', ...new Set(inventario.map(i => i.categoria).filter(Boolean))]
  const inventarioFiltrado = inventario.filter(i => {
    const matchBusqueda = i.producto?.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = filtroCat === 'Todas' || i.categoria === filtroCat
    return matchBusqueda && matchCat
  })
  const bajoStock = inventario.filter(i => parseFloat(i.stock_actual) <= parseFloat(i.stock_minimo))
  const totalItems = inventario.length

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-4xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Inventario de lubricantes</h1>
            <p className="text-sm text-gray-400">{estacion?.nombre} · {totalItems} productos</p>
          </div>
          {bajoStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 font-medium">
              ⚠ {bajoStock.length} producto{bajoStock.length > 1 ? 's' : ''} bajo stock mínimo
            </div>
          )}
        </div>

        <div className="flex gap-1 mb-5 border-b border-gray-100 overflow-x-auto">
          {(perfil?.rol === 'admin'
            ? [['actual', 'Stock actual'], ['entrega', 'Registrar entrega'], ['inicial', 'Carga inicial (Excel)']]
            : [['entrega', 'Registrar entrega']]
          ).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Selector estacion para admin ── */}
        {perfil?.rol === 'admin' && tab === 'actual' && (
          <div className="mb-4">
            <select value={estacionAdmin} onChange={e => cargarInventarioAdmin(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white w-full max-w-xs">
              <option value="">Selecciona una estación...</option>
              {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        )}

        {/* ── Tab: Stock actual ── */}
        {tab === 'actual' && (
          <>
            {inventario.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
                <div className="text-gray-400 text-sm mb-3">No hay productos en el inventario aún</div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setTab('entrega')} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Registrar primera entrega →</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setTab('inicial')} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Carga inicial desde Excel →</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-3 mb-4">
                  <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar producto..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    {categorias.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Producto</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Categoría</th>
                        <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Stock actual</th>
                        <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Stock mínimo</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Unidad</th>
                        <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventarioFiltrado.map(item => {
                        const bajo = parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo)
                        return (
                          <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 ${bajo ? 'bg-amber-50/30' : ''}`}>
                            <td className="px-4 py-2.5 text-gray-800 font-medium text-xs">{item.producto}</td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{item.categoria}</td>
                            <td className="px-3 py-2.5 text-center">
                              <input type="number" min="0" step="0.01"
                                defaultValue={item.stock_actual}
                                readOnly={perfil?.rol !== 'admin'}
                                onBlur={e => perfil?.rol === 'admin' && actualizarStock(item.id, 'stock_actual', e.target.value)}
                                className={`w-20 border rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-400 ${bajo ? 'border-amber-300 bg-amber-50' : 'border-gray-200'} ${perfil?.rol !== 'admin' ? 'bg-gray-50 cursor-default' : ''}`} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input type="number" min="0" step="0.01"
                                defaultValue={item.stock_minimo}
                                readOnly={perfil?.rol !== 'admin'}
                                onBlur={e => perfil?.rol === 'admin' && actualizarStock(item.id, 'stock_minimo', e.target.value)}
                                className={`w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-400 ${perfil?.rol !== 'admin' ? 'bg-gray-50 cursor-default' : ''}`} />
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{item.unidad}</td>
                            <td className="px-3 py-2.5 text-center">
                              {bajo
                                ? <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">Bajo stock</span>
                                : <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">OK</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {perfil?.rol === 'admin' && (
                                <button onClick={() => eliminarProducto(item.id)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {inventarioFiltrado.length === 0 && <div className="px-5 py-6 text-center text-xs text-gray-400">Sin resultados</div>}
                </div>
                {perfil?.rol === 'admin' && <p className="text-xs text-gray-400 mt-2">Haz clic en cualquier número para editarlo. El stock se actualiza automáticamente con ventas y entregas.</p>}
              </>
            )}
          </>
        )}

        {/* ── Tab: Registrar entrega ── */}
        {tab === 'entrega' && (
          <form onSubmit={guardarEntrega} className="space-y-4">

            {/* Info entrega */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Datos de la entrega</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
                  <input value={proveedorEntrega} onChange={e => setProveedorEntrega(e.target.value)}
                    placeholder="TGSA Guatemala"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
                  <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                  <input value={notasEntrega} onChange={e => setNotasEntrega(e.target.value)}
                    placeholder="No. remisión, conductor..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </div>

            {/* Buscador productos */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Productos recibidos</h2>
              <div className="relative mb-3">
                <input type="text" value={busquedaEntrega} onChange={e => setBusquedaEntrega(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 pr-8" />
                {busquedaEntrega && (
                  <button type="button" onClick={() => setBusquedaEntrega('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>

              {busquedaEntrega && (
                <div className="border border-gray-100 rounded-lg overflow-hidden mb-3">
                  {productosFiltradosEntrega.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center">Sin resultados</div>
                  )}
                  {productosFiltradosEntrega.map(p => (
                    <button key={p.sku} type="button" onClick={() => agregarProductoEntrega(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                      <div className="text-left">
                        <div className="text-xs font-medium text-gray-800">{p.nombre}</div>
                        <div className="text-xs text-gray-400">{p.sku} · {p.categoria}</div>
                      </div>
                      <span className="text-xs text-blue-600 ml-4">{p.unidad}</span>
                    </button>
                  ))}
                </div>
              )}

              {itemsEntrega.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 border-b border-gray-100">
                    <div className="col-span-7 text-xs text-gray-400 font-medium">Producto</div>
                    <div className="col-span-3 text-xs text-gray-400 font-medium text-center">Cantidad recibida</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium text-center">Unidad</div>
                  </div>
                  {itemsEntrega.map(item => (
                    <div key={item.sku} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-50 last:border-0">
                      <div className="col-span-7">
                        <div className="text-xs font-medium text-gray-800">{item.nombre}</div>
                        <button type="button" onClick={() => quitarItemEntrega(item.sku)}
                          className="text-xs text-red-400 hover:text-red-600 mt-0.5">Quitar</button>
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" value={item.cantidad}
                          onChange={e => actualizarItemEntrega(item.sku, e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400" />
                      </div>
                      <div className="col-span-2 text-xs text-gray-500 text-center">{item.unidad}</div>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                    <span className="text-xs text-gray-600 font-medium">{itemsEntrega.length} producto{itemsEntrega.length > 1 ? 's' : ''} seleccionado{itemsEntrega.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              {itemsEntrega.length === 0 && !busquedaEntrega && (
                <div className="text-center py-6 text-xs text-gray-400">Busca un producto para agregarlo a la entrega</div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3">
              <p className="text-xs text-blue-700">Las cantidades ingresadas se sumarán al stock actual de cada producto automáticamente.</p>
            </div>

            {errorEntrega && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-xs text-red-700">{errorEntrega}</div>
            )}

            <button type="submit" disabled={guardandoEntrega || itemsEntrega.length === 0}
              className="w-full bg-green-600 text-white font-semibold text-base py-4 rounded-2xl hover:bg-green-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-lg shadow-green-200 flex items-center justify-center gap-3">
              {guardandoEntrega ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando entrega...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{itemsEntrega.length > 0 ? `Confirmar entrega — ${itemsEntrega.length} producto${itemsEntrega.length > 1 ? 's' : ''}` : 'Agrega productos para continuar'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── Tab: Carga inicial Excel ── */}
        {tab === 'inicial' && perfil?.rol === 'admin' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-medium text-sm flex items-center justify-center flex-shrink-0">1</div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-800 mb-1">Descarga la plantilla Excel</h3>
                  <p className="text-xs text-gray-500 mb-3">51 productos prellenados. Solo ingresa el stock actual y mínimo de cada uno.</p>
                  <button onClick={descargarPlantillaInicial}
                    className="flex items-center gap-2 text-sm px-4 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 text-green-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar plantilla
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-medium text-sm flex items-center justify-center flex-shrink-0">2</div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-800 mb-1">Sube el archivo completado</h3>
                  <p className="text-xs text-gray-500 mb-3">Si un producto ya existe se actualizará, si no existe se creará.</p>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
                    <input type="file" accept=".xlsx,.xls,.csv" id="upload-inicial"
                      onChange={procesarArchivoInicial} className="hidden" />
                    <label htmlFor="upload-inicial" className="cursor-pointer">
                      {archivoInicial ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm text-green-700 font-medium">{archivoInicial.name}</span>
                          <button type="button" onClick={() => { setArchivoInicial(null); setPreviaInicial([]) }}
                            className="text-xs text-red-400 hover:text-red-600 ml-1">✕</button>
                        </div>
                      ) : (
                        <>
                          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-gray-500 font-medium">Haz clic para subir el Excel</p>
                          <p className="text-xs text-gray-400 mt-1">.xlsx, .xls o .csv</p>
                        </>
                      )}
                    </label>
                  </div>
                  {errorInicial && <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-xs text-red-700">{errorInicial}</div>}
                </div>
              </div>
            </div>

            {previaInicial.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-medium text-sm flex items-center justify-center flex-shrink-0">3</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-800">Vista previa — {previaInicial.length} productos</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Verifica los datos antes de guardar</p>
                      </div>
                      <button onClick={guardarCargaInicial} disabled={cargandoInicial}
                        className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {cargandoInicial && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        {cargandoInicial ? 'Guardando...' : `Guardar ${previaInicial.length} productos`}
                      </button>
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-2 text-left text-xs text-gray-400 font-normal">Producto</th>
                            <th className="px-3 py-2 text-center text-xs text-gray-400 font-normal">Stock actual</th>
                            <th className="px-3 py-2 text-center text-xs text-gray-400 font-normal">Stock mínimo</th>
                            <th className="px-4 py-2 text-left text-xs text-gray-400 font-normal">Unidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previaInicial.map((item, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="px-4 py-2.5 text-gray-800 text-xs font-medium">{item.producto}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-700">{item.cantidad}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-700">{item.stock_minimo}</td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{item.unidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
