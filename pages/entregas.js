import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const tiposLabel = { regular: 'Regular', premium: 'Super', diesel: 'Diesel', diesel_plus: 'V-Power' }
const estadoColor = { pendiente: 'text-amber-600 bg-amber-50', confirmada: 'text-green-700 bg-green-50', cancelada: 'text-red-600 bg-red-50' }

export default function Entregas({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [form, setForm] = useState({
    proveedor: '', tipo_combustible: 'regular',
    fecha_entrega: new Date().toISOString().split('T')[0],
    volumen_litros: '', precio_por_litro: '', estado: 'pendiente', notas: ''
  })

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p); setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const { data } = await supabase.from('entregas').select('*').eq('estacion_id', p.estacion_id).order('fecha_entrega', { ascending: false }).limit(20)
      setEntregas(data || [])
    }
    setLoading(false)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('entregas').insert({
      estacion_id: perfil.estacion_id,
      proveedor: form.proveedor,
      tipo_combustible: form.tipo_combustible,
      fecha_entrega: form.fecha_entrega,
      volumen_litros: parseFloat(form.volumen_litros),
      precio_por_litro: parseFloat(form.precio_por_litro),
      estado: form.estado,
      notas: form.notas,
      creado_por: session.user.id,
    })
    if (!error) { setShowForm(false); setExito(true); await loadData(); setTimeout(() => setExito(false), 3000) }
    setGuardando(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('entregas').update({ estado }).eq('id', id)
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, estado } : e))
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-3xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Entregas de combustible</h1>
            <p className="text-sm text-gray-400">{estacion?.nombre}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Registrar entrega
          </button>
        </div>

        {exito && <div className="mb-4 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5">✓ Entrega registrada correctamente</div>}

        {showForm && (
          <form onSubmit={guardar} className="bg-white rounded-xl border border-blue-100 p-5 mb-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Nueva entrega</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
                <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="TGSA Guatemala" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo de combustible</label>
                <select value={form.tipo_combustible} onChange={e => setForm(f => ({ ...f, tipo_combustible: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                  <option value="regular">Regular</option>
                  <option value="premium">Super</option>
                  <option value="diesel">Diesel</option>
                  <option value="diesel_plus">V-Power</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
                <input type="date" value={form.fecha_entrega} onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmada">Confirmada</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Volumen (litros)</label>
                <input type="number" min="0" step="0.01" value={form.volumen_litros} onChange={e => setForm(f => ({ ...f, volumen_litros: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="15000" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Precio por litro (Q)</label>
                <input type="number" min="0" step="0.0001" value={form.precio_por_litro} onChange={e => setForm(f => ({ ...f, precio_por_litro: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="3.88" />
              </div>
              {form.volumen_litros && form.precio_por_litro && (
                <div className="col-span-2 bg-gray-50 rounded-lg px-4 py-2 text-sm">
                  Costo total estimado: <span className="font-medium text-gray-800">Q{(parseFloat(form.volumen_litros) * parseFloat(form.precio_por_litro)).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" placeholder="Número de remisión, conductor, etc." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={guardando} className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar entrega'}</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Proveedor</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Combustible</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Litros</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Costo Q</th>
                <th className="px-5 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {entregas.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-xs text-gray-400">Sin entregas registradas aún</td></tr>
              )}
              {entregas.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{e.fecha_entrega}</td>
                  <td className="px-3 py-3 text-gray-700">{e.proveedor}</td>
                  <td className="px-3 py-3 text-gray-600">{tiposLabel[e.tipo_combustible]}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{parseFloat(e.volumen_litros).toLocaleString('es-GT')}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">Q{parseFloat(e.costo_total).toLocaleString('es-GT', { maximumFractionDigits: 0 })}</td>
                  <td className="px-5 py-3 text-center">
                    <select value={e.estado} onChange={ev => cambiarEstado(e.id, ev.target.value)}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${estadoColor[e.estado]}`}>
                      <option value="pendiente">Pendiente</option>
                      <option value="confirmada">Confirmada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
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
