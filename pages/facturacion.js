import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const estadoColor = { pendiente: 'text-amber-600 bg-amber-50', pagada: 'text-green-700 bg-green-50', vencida: 'text-red-600 bg-red-50' }
const estadoLabel = { pendiente: 'Pendiente', pagada: 'Pagada', vencida: 'Vencida' }

export default function Facturacion({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [form, setForm] = useState({
    numero_factura: '', proveedor: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', monto: '', estado: 'pendiente', notas: ''
  })

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p); setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const { data } = await supabase.from('facturas').select('*').eq('estacion_id', p.estacion_id).order('fecha_emision', { ascending: false })
      setFacturas(data || [])
    }
    setLoading(false)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('facturas').insert({
      estacion_id: perfil.estacion_id,
      numero_factura: form.numero_factura,
      proveedor: form.proveedor,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento,
      monto: parseFloat(form.monto),
      estado: form.estado,
      notas: form.notas,
      creado_por: session.user.id,
    })
    setShowForm(false); setExito(true); await loadData()
    setTimeout(() => setExito(false), 3000)
    setGuardando(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('facturas').update({ estado }).eq('id', id)
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado } : f))
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const totalPendiente = facturas.filter(f => f.estado !== 'pagada').reduce((s, f) => s + parseFloat(f.monto), 0)
  const vencidas = facturas.filter(f => f.estado === 'vencida').length

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-3xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Facturación</h1>
            <p className="text-sm text-gray-400">
              {estacion?.nombre}
              {totalPendiente > 0 && <span className="ml-2 text-amber-600">· Q{totalPendiente.toLocaleString('es-GT', { maximumFractionDigits: 0 })} pendiente</span>}
              {vencidas > 0 && <span className="ml-2 text-red-500">· {vencidas} vencida{vencidas > 1 ? 's' : ''}</span>}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Agregar factura
          </button>
        </div>

        {exito && <div className="mb-4 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5">✓ Factura registrada correctamente</div>}

        {showForm && (
          <form onSubmit={guardar} className="bg-white rounded-xl border border-blue-100 p-5 mb-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Nueva factura</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">No. de factura</label>
                <input value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="#2031" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
                <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="TGSA Guatemala" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de emisión</label>
                <input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de vencimiento</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Monto (Q)</label>
                <input type="number" min="0" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                  <option value="pendiente">Pendiente</option>
                  <option value="pagada">Pagada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={guardando} className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Factura</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Proveedor</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Emisión</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Vencimiento</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Monto</th>
                <th className="px-5 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-xs text-gray-400">Sin facturas registradas aún</td></tr>
              )}
              {facturas.map(f => (
                <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50 ${f.estado === 'vencida' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{f.numero_factura}</td>
                  <td className="px-3 py-3 text-gray-600">{f.proveedor}</td>
                  <td className="px-3 py-3 text-gray-600">{f.fecha_emision}</td>
                  <td className="px-3 py-3 text-gray-600">{f.fecha_vencimiento}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">Q{parseFloat(f.monto).toLocaleString('es-GT', { maximumFractionDigits: 0 })}</td>
                  <td className="px-5 py-3 text-center">
                    <select value={f.estado} onChange={e => cambiarEstado(f.id, e.target.value)}
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
        </div>
      </div>
    </Layout>
  )
}
