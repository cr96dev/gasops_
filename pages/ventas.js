import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const campos = [
  { key: 'regular',     label: 'Regular' },
  { key: 'premium',     label: 'Super' },
  { key: 'diesel',      label: 'Diesel' },
  { key: 'diesel_plus', label: 'V-Power' },
]

export default function Ventas({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    regular_litros: '', regular_ingresos: '',
    premium_litros: '', premium_ingresos: '',
    diesel_litros: '', diesel_ingresos: '',
    diesel_plus_litros: '', diesel_plus_ingresos: '',
    notas: ''
  })

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p)
    setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const { data: h } = await supabase
        .from('ventas').select('*')
        .eq('estacion_id', p.estacion_id)
        .order('fecha', { ascending: false })
        .limit(10)
      setHistorial(h || [])
    }
    setLoading(false)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function totalIngresos() {
    return ['regular', 'premium', 'diesel', 'diesel_plus']
      .reduce((s, k) => s + (parseFloat(form[`${k}_ingresos`]) || 0), 0)
  }

  function totalLitros() {
    return ['regular', 'premium', 'diesel', 'diesel_plus']
      .reduce((s, k) => s + (parseFloat(form[`${k}_litros`]) || 0), 0)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    const payload = {
      estacion_id: perfil.estacion_id,
      fecha: form.fecha,
      regular_litros: parseFloat(form.regular_litros) || 0,
      regular_ingresos: parseFloat(form.regular_ingresos) || 0,
      premium_litros: parseFloat(form.premium_litros) || 0,
      premium_ingresos: parseFloat(form.premium_ingresos) || 0,
      diesel_litros: parseFloat(form.diesel_litros) || 0,
      diesel_ingresos: parseFloat(form.diesel_ingresos) || 0,
      diesel_plus_litros: parseFloat(form.diesel_plus_litros) || 0,
      diesel_plus_ingresos: parseFloat(form.diesel_plus_ingresos) || 0,
      notas: form.notas,
      creado_por: session.user.id,
    }
    const { error: err } = await supabase.from('ventas').upsert(payload, { onConflict: 'estacion_id,fecha' })
    if (err) setError('Error al guardar. ¿Ya existe un registro para esta fecha?')
    else { setExito(true); await loadData(); setTimeout(() => setExito(false), 3000) }
    setGuardando(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-3xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Registro de ventas</h1>
          <p className="text-sm text-gray-400">{estacion?.nombre}</p>
        </div>

        <form onSubmit={guardar} className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setField('fecha', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-xs text-gray-400 font-medium">Combustible</div>
            <div className="text-xs text-gray-400 font-medium">Galones vendidos</div>
            <div className="text-xs text-gray-400 font-medium">Ingresos (Q)</div>
          </div>

          {campos.map(c => (
            <div key={c.key} className="grid grid-cols-3 gap-2 mb-2">
              <div className="flex items-center text-sm text-gray-700">{c.label}</div>
              <input
                type="number" min="0" step="0.01"
                value={form[`${c.key}_litros`]}
                onChange={e => setField(`${c.key}_litros`, e.target.value)}
                placeholder="0"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
              <input
                type="number" min="0" step="0.01"
                value={form[`${c.key}_ingresos`]}
                onChange={e => setField(`${c.key}_ingresos`, e.target.value)}
                placeholder="0.00"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          ))}

          <div className="border-t border-gray-100 pt-3 mt-3 grid grid-cols-3 gap-2">
            <div className="text-xs font-medium text-gray-600">Total</div>
            <div className="text-sm font-medium text-gray-800">{totalLitros().toLocaleString('es-GT', { maximumFractionDigits: 1 })} gal</div>
            <div className="text-sm font-medium text-gray-800">Q{totalIngresos().toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => setField('notas', e.target.value)}
              rows={2} placeholder="Observaciones del día..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </div>

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          {exito && <p className="text-xs text-green-600 mt-2">✓ Registro guardado correctamente</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button type="submit" disabled={guardando}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {guardando ? 'Guardando...' : 'Guardar registro'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Historial reciente</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Regular (gal)</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Super (gal)</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Diesel (gal)</th>
                  <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">Total Q</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-4 text-xs text-gray-400 text-center">Sin registros aún</td></tr>
                )}
                {historial.map(v => {
                  const total = v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos
                  return (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{v.fecha}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{v.regular_litros.toLocaleString('es-GT')}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{v.premium_litros.toLocaleString('es-GT')}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{v.diesel_litros.toLocaleString('es-GT')}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800">Q{total.toLocaleString('es-GT', { maximumFractionDigits: 0 })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
