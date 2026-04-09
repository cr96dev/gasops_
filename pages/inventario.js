import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Inventario({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ producto: '', categoria: '', stock_actual: '', stock_minimo: '', unidad: 'unidades' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p); setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const { data } = await supabase.from('inventario').select('*').eq('estacion_id', p.estacion_id).order('categoria').order('producto')
      setItems(data || [])
    }
    setLoading(false)
  }

  function statusColor(item) {
    if (item.stock_actual <= item.stock_minimo) return 'text-red-600 bg-red-50'
    if (item.stock_actual <= item.stock_minimo * 1.5) return 'text-amber-600 bg-amber-50'
    return 'text-green-700 bg-green-50'
  }
  function statusLabel(item) {
    if (item.stock_actual <= item.stock_minimo) return 'Bajo'
    if (item.stock_actual <= item.stock_minimo * 1.5) return 'Monitor'
    return 'OK'
  }

  function iniciarEdicion(item) {
    setEditando(item.id)
    setForm({ producto: item.producto, categoria: item.categoria || '', stock_actual: item.stock_actual, stock_minimo: item.stock_minimo, unidad: item.unidad })
    setShowForm(true)
  }

  function nuevaFila() {
    setEditando(null)
    setForm({ producto: '', categoria: '', stock_actual: '', stock_minimo: '', unidad: 'unidades' })
    setShowForm(true)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = {
      estacion_id: perfil.estacion_id,
      producto: form.producto,
      categoria: form.categoria,
      stock_actual: parseFloat(form.stock_actual) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      unidad: form.unidad,
      updated_at: new Date().toISOString(),
    }
    if (editando) {
      await supabase.from('inventario').update(payload).eq('id', editando)
    } else {
      await supabase.from('inventario').insert(payload)
    }
    setShowForm(false); setEditando(null)
    await loadData()
    setGuardando(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const alertas = items.filter(i => i.stock_actual <= i.stock_minimo).length

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-3xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-400">{estacion?.nombre} {alertas > 0 && <span className="text-red-500 ml-1">· {alertas} producto{alertas > 1 ? 's' : ''} con stock bajo</span>}</p>
          </div>
          <button onClick={nuevaFila} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Agregar producto
          </button>
        </div>

        {showForm && (
          <form onSubmit={guardar} className="bg-white rounded-xl border border-blue-100 p-5 mb-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Producto</label>
                <input value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Aceite 10W-40" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Categoría</label>
                <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="Lubricantes" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Stock actual</label>
                <input type="number" min="0" step="0.01" value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Stock mínimo</label>
                <input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Unidad</label>
                <select value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                  <option>unidades</option><option>cajas</option><option>litros</option><option>kg</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={guardando} className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Producto</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Categoría</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Stock</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Mínimo</th>
                <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-xs text-gray-400">Sin productos aún. Agrega el primero.</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800 font-medium">{item.producto}</td>
                  <td className="px-3 py-3 text-gray-500">{item.categoria || '—'}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{item.stock_actual} {item.unidad}</td>
                  <td className="px-3 py-3 text-right text-gray-400">{item.stock_minimo}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor(item)}`}>{statusLabel(item)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => iniciarEdicion(item)} className="text-xs text-blue-500 hover:text-blue-700">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
