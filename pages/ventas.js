import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const combustibles = [
  { key: 'regular', label: 'Regular' },
  { key: 'premium', label: 'Super' },
  { key: 'diesel', label: 'Diesel' },
  { key: 'diesel_plus', label: 'V-Power' },
]

const metodosPago = [
  { key: 'neonet', label: 'Neonet' },
  { key: 'bac', label: 'BAC' },
  { key: 'deposito', label: 'Depósito' },
  { key: 'cupon', label: 'Cupón' },
  { key: 'neonet_prepago', label: 'Neonet Prepago' },
  { key: 'descuento_club_bi', label: 'Descuento Club Bi' },
  { key: 'ach_transferencia', label: 'ACH / Transferencia' },
  { key: 'flota_credomatic', label: 'Flota Credomatic' },
  { key: 'caja_chica', label: 'Caja Chica' },
  { key: 'vales_clientes', label: 'Vales Clientes' },
  { key: 'uno_plus', label: 'Uno Plus' },
  { key: 'nomina', label: 'Nómina' },
  { key: 'descuento_amigo', label: 'Descuento Amigo' },
  { key: 'piloto', label: 'Piloto' },
  { key: 'gasoline', label: 'Gasoline' },
  { key: 'prueba_surtidor', label: 'Prueba de surtidor' },
]

const formInicial = {
  fecha: new Date().toISOString().split('T')[0],
  regular_litros: '', regular_ingresos: '',
  premium_litros: '', premium_ingresos: '',
  diesel_litros: '', diesel_ingresos: '',
  diesel_plus_litros: '', diesel_plus_ingresos: '',
  neonet: '', bac: '', deposito: '', cupon: '',
  neonet_prepago: '', descuento_club_bi: '', ach_transferencia: '',
  flota_credomatic: '', caja_chica: '', vales_clientes: '',
  uno_plus: '', nomina: '', descuento_amigo: '',
  piloto: '', gasoline: '', prueba_surtidor: '',
  notas: ''
}

export default function Ventas({ session }) {
  const router = useRouter()
  const [perfil, setPerfil] = useState(null)
  const [estacion, setEstacion] = useState(null)
  const [historial, setHistorial] = useState([])
  const [registroHoy, setRegistroHoy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [session])

  async function loadData() {
    const { data: p } = await supabase.from('perfiles').select('*, estaciones(*)').eq('id', session.user.id).single()
    setPerfil(p)
    setEstacion(p?.estaciones)
    if (p?.estacion_id) {
      const today = new Date().toISOString().split('T')[0]

      // Verificar si ya existe registro de hoy
      const { data: hoy } = await supabase
        .from('ventas').select('*')
        .eq('estacion_id', p.estacion_id)
        .eq('fecha', today)
        .single()
      setRegistroHoy(hoy || null)

      // Historial
      const { data: h } = await supabase
        .from('ventas').select('*')
        .eq('estacion_id', p.estacion_id)
        .order('fecha', { ascending: false })
        .limit(15)
      setHistorial(h || [])
    }
    setLoading(false)
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function totalGalones() {
    return combustibles.reduce((s, c) => s + (parseFloat(form[`${c.key}_litros`]) || 0), 0)
  }

  function totalIngresos() {
    return combustibles.reduce((s, c) => s + (parseFloat(form[`${c.key}_ingresos`]) || 0), 0)
  }

  function totalMetodos() {
    return metodosPago.reduce((s, m) => s + (parseFloat(form[m.key]) || 0), 0)
  }

  function diferencia() {
    return totalIngresos() - totalMetodos()
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    const payload = {
      estacion_id: perfil.estacion_id,
      fecha: new Date().toISOString().split('T')[0],
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
    metodosPago.forEach(m => { payload[m.key] = parseFloat(form[m.key]) || 0 })
    const { error: err } = await supabase.from('ventas').insert(payload)
    if (err) setError('Error al guardar. Intenta de nuevo.')
    else {
      setExito(true)
      await loadData()
    }
    setGuardando(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando...</div>

  const diff = diferencia()
  const totalI = totalIngresos()
  const totalM = totalMetodos()
  const today = new Date().toLocaleDateString('es-GT', { dateStyle: 'long' })

  return (
    <Layout perfil={perfil} estacion={estacion}>
      <div className="p-6 max-w-3xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Registro de ventas</h1>
          <p className="text-sm text-gray-400">{estacion?.nombre} — {today}</p>
        </div>

        {/* Ya existe registro de hoy — modo lectura */}
        {registroHoy ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <div className="text-green-600 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-green-800">Registro del día enviado</div>
                <div className="text-xs text-green-600 mt-0.5">Las ventas de hoy ya fueron registradas y no pueden modificarse. Si hay un error, comunícate con el administrador.</div>
              </div>
            </div>

            {/* Resumen del registro enviado */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Combustible vendido hoy</h2>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-xs text-gray-400 font-medium">Tipo</div>
                <div className="text-xs text-gray-400 font-medium text-right">Galones</div>
                <div className="text-xs text-gray-400 font-medium text-right">Ingresos (Q)</div>
              </div>
              {combustibles.map(c => (
                <div key={c.key} className="grid grid-cols-3 gap-2 py-1.5 border-b border-gray-50">
                  <div className="text-sm text-gray-700">{c.label}</div>
                  <div className="text-sm text-gray-800 text-right">{parseFloat(registroHoy[`${c.key}_litros`] || 0).toLocaleString('es-GT')}</div>
                  <div className="text-sm text-gray-800 text-right">Q{parseFloat(registroHoy[`${c.key}_ingresos`] || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 pt-2 mt-1">
                <div className="text-xs font-medium text-gray-600">Total</div>
                <div className="text-sm font-medium text-gray-800 text-right">
                  {(combustibles.reduce((s, c) => s + parseFloat(registroHoy[`${c.key}_litros`] || 0), 0)).toLocaleString('es-GT', { maximumFractionDigits: 1 })} gal
                </div>
                <div className="text-sm font-medium text-gray-800 text-right">
                  Q{(combustibles.reduce((s, c) => s + parseFloat(registroHoy[`${c.key}_ingresos`] || 0), 0)).toLocaleString('es-GT', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Formas de cobro</h2>
              {metodosPago.map(m => {
                const val = parseFloat(registroHoy[m.key] || 0)
                if (val === 0) return null
                return (
                  <div key={m.key} className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-sm text-gray-600">{m.label}</span>
                    <span className="text-sm text-gray-800">Q{val.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                  </div>
                )
              })}
              <div className="pt-2 mt-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total ingresos</span>
                  <span className="font-medium text-gray-800">Q{(combustibles.reduce((s, c) => s + parseFloat(registroHoy[`${c.key}_ingresos`] || 0), 0)).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total cobros</span>
                  <span className="font-medium text-gray-800">Q{(metodosPago.reduce((s, m) => s + parseFloat(registroHoy[m.key] || 0), 0)).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
                {(() => {
                  const totalIng = combustibles.reduce((s, c) => s + parseFloat(registroHoy[`${c.key}_ingresos`] || 0), 0)
                  const totalCob = metodosPago.reduce((s, m) => s + parseFloat(registroHoy[m.key] || 0), 0)
                  const dif = totalIng - totalCob
                  return (
                    <div className={`flex justify-between text-sm font-medium pt-1 border-t border-gray-100 ${Math.abs(dif) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                      <span>Diferencia</span>
                      <span>{Math.abs(dif) < 0.01 ? '✓ Cuadra' : `Q${dif.toFixed(2)}`}</span>
                    </div>
                  )
                })()}
              </div>
            </div>

            {registroHoy.notas && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs text-gray-500 mb-1">Observaciones</div>
                <div className="text-sm text-gray-700">{registroHoy.notas}</div>
              </div>
            )}
          </div>
        ) : (
          /* Formulario — solo si no hay registro de hoy */
          <form onSubmit={guardar} className="space-y-4">

            {exito && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-700">
                ✓ Registro guardado correctamente
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Combustible vendido</h2>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-xs text-gray-400 font-medium">Tipo</div>
                <div className="text-xs text-gray-400 font-medium">Galones</div>
                <div className="text-xs text-gray-400 font-medium">Ingresos (Q)</div>
              </div>
              {combustibles.map(c => (
                <div key={c.key} className="grid grid-cols-3 gap-2 mb-2">
                  <div className="flex items-center text-sm text-gray-700">{c.label}</div>
                  <input type="number" min="0" step="0.01"
                    value={form[`${c.key}_litros`]}
                    onChange={e => setField(`${c.key}_litros`, e.target.value)}
                    placeholder="0"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  <input type="number" min="0" step="0.01"
                    value={form[`${c.key}_ingresos`]}
                    onChange={e => setField(`${c.key}_ingresos`, e.target.value)}
                    placeholder="0.00"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-2 grid grid-cols-3 gap-2">
                <div className="text-xs font-medium text-gray-600">Total</div>
                <div className="text-sm font-medium text-gray-800">{totalGalones().toLocaleString('es-GT', { maximumFractionDigits: 1 })} gal</div>
                <div className="text-sm font-medium text-gray-800">Q{totalI.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Formas de cobro</h2>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="text-xs text-gray-400 font-medium">Método</div>
                <div className="text-xs text-gray-400 font-medium">Monto (Q)</div>
              </div>
              {metodosPago.map(m => (
                <div key={m.key} className="grid grid-cols-2 gap-2 mb-2">
                  <div className="flex items-center text-sm text-gray-700">{m.label}</div>
                  <input type="number" min="0" step="0.01"
                    value={form[m.key]}
                    onChange={e => setField(m.key, e.target.value)}
                    placeholder="0.00"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-2 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total ingresos</span>
                  <span className="font-medium text-gray-800">Q{totalI.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total formas de cobro</span>
                  <span className="font-medium text-gray-800">Q{totalM.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={`flex justify-between text-sm font-medium pt-1 border-t border-gray-100 ${Math.abs(diff) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                  <span>Diferencia</span>
                  <span>{diff >= 0 ? '+' : ''}Q{diff.toLocaleString('es-GT', { maximumFractionDigits: 2 })}</span>
                </div>
                {Math.abs(diff) < 0.01 && totalI > 0 && (
                  <div className="text-xs text-green-600 text-right">✓ Cuadra perfectamente</div>
                )}
                {Math.abs(diff) >= 0.01 && totalM > 0 && (
                  <div className="text-xs text-red-500 text-right">Hay una diferencia de Q{Math.abs(diff).toLocaleString('es-GT', { maximumFractionDigits: 2 })}</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <label className="text-xs text-gray-500 block mb-1">Observaciones (opcional)</label>
              <textarea value={form.notas} onChange={e => setField('notas', e.target.value)}
                rows={2} placeholder="Notas del día..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <p className="text-xs text-amber-700">Una vez guardado el registro no podrá ser modificado. Verifica que los datos sean correctos antes de enviar.</p>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={guardando}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {guardando ? 'Guardando...' : 'Guardar registro del día'}
              </button>
            </div>
          </form>
        )}

        {/* Historial */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mt-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Historial reciente</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Regular</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Super</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Diesel</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">V-Power</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Total Q</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-4 text-xs text-gray-400 text-center">Sin registros aún</td></tr>
                )}
                {historial.map(v => {
                  const total = v.regular_ingresos + v.premium_ingresos + v.diesel_ingresos + v.diesel_plus_ingresos
                  const cobros = metodosPago.reduce((s, m) => s + (parseFloat(v[m.key]) || 0), 0)
                  const dif = total - cobros
                  return (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{v.fecha}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.regular_litros).toLocaleString('es-GT')} gal</td>
                      <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.premium_litros).toLocaleString('es-GT')} gal</td>
                      <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.diesel_litros).toLocaleString('es-GT')} gal</td>
                      <td className="px-3 py-3 text-right text-gray-600">{parseFloat(v.diesel_plus_litros).toLocaleString('es-GT')} gal</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-800">Q{Math.round(total).toLocaleString('es-GT')}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Math.abs(dif) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {Math.abs(dif) < 0.01 ? 'OK' : `Q${dif.toFixed(2)}`}
                        </span>
                      </td>
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
