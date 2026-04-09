import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const tiposTanque = [
  { key: 'vpower',  label: 'V-Power',  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { key: 'super',   label: 'Super',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'regular', label: 'Regular',  color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
  { key: 'diesel',  label: 'Diesel',   color: '#1C1917', bg: '#F5F5F4', border: '#D6D3D1' },
]

function CirculoTanque({ tipo, nivel, capacidad, onClick }) {
  const pct = capacidad > 0 ? Math.min(100, (nivel / capacidad) * 100) : 0
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const alertColor = pct < 20 ? '#DC2626' : pct < 40 ? '#CA8A04' : tipo.color

  return (
    <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={onClick}>
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#E5E7EB" strokeWidth="12" />
          <circle cx="70" cy="70" r={r} fill="none"
            stroke={alertColor} strokeWidth="12"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold" style={{ color: alertColor }}>{Math.round(pct)}%</span>
          <span className="text-xs text-gray-400">{Math.round(nivel).toLocaleString('es-GT')} gal</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-medium" style={{ color: tipo.color }}>{tipo.label}</div>
        <div className="text-xs text-gray-400">Cap: {Math.round(capacidad).toLocaleString('es-GT')} gal</div>
        {pct < 20 && <div className="text-xs text-red-500 font-medium mt-0.5">Nivel crítico</div>}
        {pct >= 20 && pct < 40 && <div className="text-xs text-amber-500 font-medium mt-0.5">Nivel bajo</div>}
      </div>
    </div>
  )
}

export default function Tanques({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [tanques, setTanques] = useState({})
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ capacidad_galones: '', nivel_galones: '' })
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p)
    setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const { data } = await supabase.from('tanques').select('*').eq('estacion_id', p.estacion_id)
      const map = {}
      ;(data || []).forEach(t => { map[t.tipo] = t })
      setTanques(map)
    }
    setLoading(false)
  }

  function abrirEdicion(tipo) {
    const t = tanques[tipo.key]
    setEditando(tipo)
    setForm({
      capacidad_galones: t?.capacidad_galones || '',
      nivel_galones: t?.nivel_galones || '',
    })
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = {
      estacion_id: perfil.estacion_id,
      tipo: editando.key,
      capacidad_galones: parseFloat(form.capacidad_galones) || 0,
      nivel_galones: parseFloat(form.nivel_galones) || 0,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('tanques').upsert(payload, { onConflict: 'estacion_id,tipo' })
    setEditando(null)
    setExito(true)
    await loadData()
    setTimeout(() => setExito(false), 2000)
    setGuardando(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const totalGalones = tiposTanque.reduce((s, t) => s + (tanques[t.key]?.nivel_galones || 0), 0)
  const totalCapacidad = tiposTanque.reduce((s, t) => s + (tanques[t.key]?.capacidad_galones || 0), 0)

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Tanques de combustible</h1>
            <p className="text-sm text-gray-400">{estacion?.nombre}</p>
          </div>
          {exito && <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">✓ Guardado</span>}
        </div>

        {/* Resumen */}
        {totalCapacidad > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Total en tanques</div>
              <div className="text-xl font-medium text-gray-900">{Math.round(totalGalones).toLocaleString('es-GT')} gal</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Capacidad total</div>
              <div className="text-xl font-medium text-gray-900">{Math.round(totalCapacidad).toLocaleString('es-GT')} gal</div>
            </div>
          </div>
        )}

        {/* Círculos */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center">
            {tiposTanque.map(tipo => (
              <CirculoTanque
                key={tipo.key}
                tipo={tipo}
                nivel={tanques[tipo.key]?.nivel_galones || 0}
                capacidad={tanques[tipo.key]?.capacidad_galones || 0}
                onClick={() => abrirEdicion(tipo)}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">Haz clic en cualquier tanque para actualizar su nivel</p>
        </div>

        {/* Formulario de edición */}
        {editando && (
          <form onSubmit={guardar} className="bg-white rounded-xl border-2 p-5 mb-4"
            style={{ borderColor: editando.border || '#E5E7EB' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full" style={{ background: editando.color }}></div>
              <h2 className="text-sm font-medium text-gray-800">Actualizar tanque — {editando.label}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Capacidad total (gal)</label>
                <input type="number" min="0" step="0.01"
                  value={form.capacidad_galones}
                  onChange={e => setForm(f => ({ ...f, capacidad_galones: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nivel actual (gal)</label>
                <input type="number" min="0" step="0.01"
                  value={form.nivel_galones}
                  onChange={e => setForm(f => ({ ...f, nivel_galones: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            {form.capacidad_galones && form.nivel_galones && (
              <div className="text-xs text-gray-500 mb-3">
                Nivel: <span className="font-medium text-gray-800">
                  {Math.round((parseFloat(form.nivel_galones) / parseFloat(form.capacidad_galones)) * 100)}%
                </span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditando(null)}
                className="text-sm px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                className="text-sm px-4 py-1.5 text-white rounded-lg disabled:opacity-50"
                style={{ background: editando.color }}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla resumen */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Combustible</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Nivel (gal)</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Capacidad (gal)</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">%</th>
                <th className="px-5 py-2.5 text-center text-xs text-gray-400 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tiposTanque.map(tipo => {
                const t = tanques[tipo.key]
                const pct = t?.capacidad_galones > 0 ? Math.round((t.nivel_galones / t.capacidad_galones) * 100) : 0
                return (
                  <tr key={tipo.key} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => abrirEdicion(tipo)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: tipo.color }}></div>
                        <span className="font-medium text-gray-800">{tipo.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{t ? Math.round(t.nivel_galones).toLocaleString('es-GT') : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-500">{t ? Math.round(t.capacidad_galones).toLocaleString('es-GT') : '—'}</td>
                    <td className="px-3 py-3 text-right font-medium" style={{ color: tipo.color }}>{t ? `${pct}%` : '—'}</td>
                    <td className="px-5 py-3 text-center">
                      {t ? (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${pct < 20 ? 'bg-red-50 text-red-600' : pct < 40 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-700'}`}>
                          {pct < 20 ? 'Crítico' : pct < 40 ? 'Bajo' : 'Normal'}
                        </span>
                      ) : <span className="text-xs text-gray-400">Sin datos</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
