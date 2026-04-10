import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import { SkeletonTable } from '../components/Skeleton'

const estadoColor = { pendiente: 'text-amber-600 bg-amber-50', confirmada: 'text-green-700 bg-green-50', cancelada: 'text-red-600 bg-red-50' }

const combustibles = [
  { key: 'regular',    label: 'Regular',  tanque: 'regular', color: '#CA8A04' },
  { key: 'premium',    label: 'Super',    tanque: 'super',   color: '#16A34A' },
  { key: 'diesel',     label: 'Diesel',   tanque: 'diesel',  color: '#1C1917' },
  { key: 'diesel_plus',label: 'V-Power',  tanque: 'vpower',  color: '#DC2626' },
]

export default function Entregas({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const { toasts, toast } = useToast()
  const [form, setForm] = useState({
    proveedor: '',
    fecha_entrega: new Date().toISOString().split('T')[0],
    estado: 'confirmada',
    notas: '',
    regular_galones: '', regular_precio: '',
    premium_galones: '', premium_precio: '',
    diesel_galones: '', diesel_precio: '',
    diesel_plus_galones: '', diesel_plus_precio: '',
  })

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p); setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const { data } = await supabase.from('entregas').select('*')
        .eq('estacion_id', p.estacion_id)
        .order('fecha_entrega', { ascending: false })
        .limit(30)
      setEntregas(data || [])
    }
    setLoading(false)
  }

  function totalEntrega() {
    return combustibles.reduce((s, c) => {
      const gal = parseFloat(form[`${c.key}_galones`]) || 0
      const precio = parseFloat(form[`${c.key}_precio`]) || 0
      return s + gal * precio
    }, 0)
  }

  function totalGalones() {
    return combustibles.reduce((s, c) => s + (parseFloat(form[`${c.key}_galones`]) || 0), 0)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)

    const combustiblesConDatos = combustibles.filter(c => parseFloat(form[`${c.key}_galones`]) > 0)

    if (combustiblesConDatos.length === 0) {
      toast('Ingresa al menos un combustible', 'warning')
      setGuardando(false)
      return
    }

    // Insertar un registro por cada combustible con datos
    for (const c of combustiblesConDatos) {
      const galones = parseFloat(form[`${c.key}_galones`])
      const precio = parseFloat(form[`${c.key}_precio`]) || 0

      const { error } = await supabase.from('entregas').insert({
        estacion_id: perfil.estacion_id,
        proveedor: form.proveedor,
        tipo_combustible: c.key,
        fecha_entrega: form.fecha_entrega,
        volumen_litros: galones,
        precio_por_litro: precio,
        costo_total: galones * precio,
        estado: form.estado,
        notas: form.notas,
        creado_por: session.user.id,
      })

      if (error) {
        toast(`Error al guardar ${c.label}`, 'error')
        continue
      }

      // Actualizar tanque
      const { data: tanqueActual } = await supabase.from('tanques')
        .select('nivel_galones, capacidad_galones')
        .eq('estacion_id', perfil.estacion_id)
        .eq('tipo', c.tanque)
        .single()

      if (tanqueActual) {
        const nuevoNivel = Math.min(
          parseFloat(tanqueActual.nivel_galones) + galones,
          parseFloat(tanqueActual.capacidad_galones)
        )
        await supabase.from('tanques').update({
          nivel_galones: nuevoNivel,
          updated_at: new Date().toISOString()
        }).eq('estacion_id', perfil.estacion_id).eq('tipo', c.tanque)

        await supabase.from('tanques_historial').insert({
          estacion_id: perfil.estacion_id,
          tipo: c.tanque,
          nivel_galones: nuevoNivel,
          capacidad_galones: tanqueActual.capacidad_galones,
          creado_por: session.user.id,
        })
      }
    }

    setShowForm(false)
    setForm({
      proveedor: '', fecha_entrega: new Date().toISOString().split('T')[0],
      estado: 'confirmada', notas: '',
      regular_galones: '', regular_precio: '',
      premium_galones: '', premium_precio: '',
      diesel_galones: '', diesel_precio: '',
      diesel_plus_galones: '', diesel_plus_precio: '',
    })
    toast(`✓ Entrega registrada — ${combustiblesConDatos.length} combustible${combustiblesConDatos.length > 1 ? 's' : ''} actualizado${combustiblesConDatos.length > 1 ? 's' : ''}`, 'success')
    await loadData()
    setGuardando(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('entregas').update({ estado }).eq('id', id)
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, estado } : e))
    toast(`Estado actualizado a ${estado}`, 'info')
  }

  if (loading) return (
    <Layout perfil={null} estacion={null}>
      <div className="p-6 max-w-3xl">
        <div className="h-6 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
        <SkeletonTable rows={5} />
      </div>
    </Layout>
  )

  const tiposLabel = { regular: 'Regular', premium: 'Super', diesel: 'Diesel', diesel_plus: 'V-Power' }
  const tipoColor = { regular: '#CA8A04', premium: '#16A34A', diesel: '#1C1917', diesel_plus: '#DC2626' }

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-3xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Entregas de combustible</h1>
            <p className="text-sm text-gray-400">{estacion?.nombre}</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Registrar entrega
          </button>
        </div>

        {showForm && (
          <form onSubmit={guardar} className="bg-white rounded-xl border border-blue-100 p-5 mb-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Nueva entrega</h2>

            {/* Info general */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
                <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="TGSA Guatemala" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de entrega</label>
                <input type="date" value={form.fecha_entrega}
                  onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400">
                  <option value="confirmada">Confirmada</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="No. remisión, conductor..." />
              </div>
            </div>

            {/* Tabla de combustibles */}
            <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
              <div className="grid grid-cols-3 gap-0 bg-gray-50 px-4 py-2 border-b border-gray-100">
                <div className="text-xs text-gray-400 font-medium">Combustible</div>
                <div className="text-xs text-gray-400 font-medium text-center">Galones recibidos</div>
                <div className="text-xs text-gray-400 font-medium text-center">Precio por galón (Q)</div>
              </div>
              {combustibles.map((c, i) => (
                <div key={c.key} className={`grid grid-cols-3 gap-3 px-4 py-3 items-center ${i < combustibles.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }}></div>
                    <span className="text-sm font-medium text-gray-700">{c.label}</span>
                  </div>
                  <input type="number" min="0" step="0.01"
                    value={form[`${c.key}_galones`]}
                    onChange={e => setForm(f => ({ ...f, [`${c.key}_galones`]: e.target.value }))}
                    placeholder="0"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400 w-full" />
                  <input type="number" min="0" step="0.0001"
                    value={form[`${c.key}_precio`]}
                    onChange={e => setForm(f => ({ ...f, [`${c.key}_precio`]: e.target.value }))}
                    placeholder="0.00"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400 w-full" />
                </div>
              ))}
            </div>

            {/* Resumen */}
            {totalGalones() > 0 && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
                <div className="text-xs text-blue-700">
                  <span className="font-medium">{totalGalones().toLocaleString('es-GT', { maximumFractionDigits: 1 })} galones</span> en total
                </div>
                <div className="text-xs text-blue-700">
                  Costo total: <span className="font-medium">Q{totalEntrega().toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={guardando}
                className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {guardando && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {guardando ? 'Guardando...' : 'Guardar entrega'}
              </button>
            </div>
          </form>
        )}

        {/* Historial */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Proveedor</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Combustible</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Galones</th>
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
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tipoColor[e.tipo_combustible] }}></div>
                      <span className="text-gray-600">{tiposLabel[e.tipo_combustible]}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{parseFloat(e.volumen_litros).toLocaleString('es-GT')}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">Q{parseFloat(e.costo_total || 0).toLocaleString('es-GT', { maximumFractionDigits: 0 })}</td>
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
