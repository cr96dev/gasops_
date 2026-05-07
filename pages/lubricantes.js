import { useEffect, useState } from ‘react’
import { useRouter } from ‘next/router’
import { supabase } from ‘../lib/supabase’
import Layout from ‘../components/Layout’

const PRODUCTOS_INVENTARIO = new Set([
‘LIQUIDO DE FRENOS’, ‘POWER STEERING 12 ONZAS’, ‘TP COOLANT 50/50 1 LITRO’,
‘TP COOLANT 50/50 1 GALON’, ‘SHELL ADVANCE S2 DOS TT LITRO’, ‘SHELL ADVANCE AX5 4T 20W50 LITRO’,
‘HELIX HX3 SAE 40 LITRO’, ‘HELIX HX8 5W-30 LITRO’, ‘HELIX HX5 20W-50 GALÓN’,
‘HELIX HX5 20W-50 LITRO’, ‘HELIX HX7 SN 10W-30 AZUL GALÓN’, ‘HELIX HX7 SN 10W-30 AZUL LITRO’,
‘RIMULA R4X 15W-40 GRIS GALÓN’, ‘RIMULA R4X 15W-40 GRIS LITRO’, ‘SHELL SPIRAX S5 ATF X’,
‘UNO Ultra 10W-30 1 LITRO’, ‘UNO Ultra 10W-30 GALON’, ‘UNO Impulse 4T 20W-50 1 LITRO’,
‘UNO Ultra 20W-50 1 LITRO’, ‘UNO Ultra 20W-50 1 GALON’, ‘UNO Ultra 40 1 LITRO’,
‘UNO Ultra 40 1 GALON’, ‘UNO Synchron ATF 1 LITRO’, ‘TP Brake Fluid PINTA 12 OZ’,
‘TP Power Steering F PINTA 12 OZ’, ‘UNO Forza 15W-40 1 LITRO’, ‘UNO Forza 50 1 LITRO’,
‘UNO ULTRA FULL SYNT 5W-30’, ‘FORZA EURO SAE 5W-40 1 LITRO’, ‘UNO Impulse 2T LITRO’,
‘HELIX HX3 SAE 40 GALÓN’, ‘HELIX HX3 25W-60 LITRO’, ‘HELIX HX3 25W-60 GALÓN’,
‘HELIX ULTRA 5W-30 LITRO’, ‘HELIX ULTRA 5W-30 GALÓN’, ‘HELIX ULTRA 5W-40 LITRO’,
‘HELIX ULTRA 5W-40 GALÓN’, ‘UNO Ultra 15W-40 1 GALON’, ‘REFRIGERANTE TOP GUARD’,
‘SHELL SPIRAX S3 ATF MD3 LITRO’, ‘SHELL ADVANCE SAE 10W-40 ULTRA’,
‘Prodin Activador Electrolitico 18oz’, ‘Prodin Agua Destilada 18oz’,
‘PLUMILLAS BOSCH’, ‘Garantía x Lluvia’,
])

function getHoyGuatemala() {
return new Date().toLocaleDateString(‘en-CA’, { timeZone: ‘America/Guatemala’ })
}

function getAyerGuatemala() {
const d = new Date()
d.setDate(d.getDate() - 1)
return d.toLocaleDateString(‘en-CA’, { timeZone: ‘America/Guatemala’ })
}

function getHaceNDias(n) {
const d = new Date()
d.setDate(d.getDate() - n)
return d.toLocaleDateString(‘en-CA’, { timeZone: ‘America/Guatemala’ })
}

function formatQ(n) {
return ‘Q’ + parseFloat(n || 0).toLocaleString(‘es-GT’, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Lubricantes({ session }) {
const router = useRouter()
const [perfil, setPerfil] = useState(null)
const [estacion, setEstacion] = useState(null)
const [loading, setLoading] = useState(true)
const [tab, setTab] = useState(‘ayer’)
const [ventasAyer, setVentasAyer] = useState([])
const [ventaAyerRow, setVentaAyerRow] = useState(null)
const [cargandoAyer, setCargandoAyer] = useState(false)
const [fechaInicio, setFechaInicio] = useState(getHaceNDias(30))
const [fechaFin, setFechaFin] = useState(getAyerGuatemala())
const [agrupacion, setAgrupacion] = useState(‘dia’)
const [historial, setHistorial] = useState([])
const [cargandoHistorial, setCargandoHistorial] = useState(false)
const [detalleAbierto, setDetalleAbierto] = useState(null)
const [estacionId, setEstacionId] = useState(null)

// Modal de edición de formas de cobro
const [editandoVenta, setEditandoVenta] = useState(null)
const [editEfectivo, setEditEfectivo] = useState(’’)
const [editNeonet, setEditNeonet] = useState(’’)
const [guardando, setGuardando] = useState(false)
const [errorGuardar, setErrorGuardar] = useState(’’)

useEffect(() => {
if (!session) { router.push(’/’); return }
async function init() {
const { data: p } = await supabase.from(‘perfiles’).select(’*, estaciones(*)’).eq(‘id’, session.user.id).single()
if (!p) { router.push(’/’); return }
setPerfil(p)
setEstacion(p.estaciones)
setEstacionId(p.estacion_id)
setLoading(false)
}
init()
}, [session])

useEffect(() => {
if (!estacionId) return
if (tab === ‘ayer’) cargarAyer(estacionId)
if (tab === ‘historial’) cargarHistorial(estacionId, fechaInicio, fechaFin, agrupacion)
}, [estacionId, tab])

useEffect(() => {
if (!estacionId || tab !== ‘historial’) return
cargarHistorial(estacionId, fechaInicio, fechaFin, agrupacion)
}, [fechaInicio, fechaFin, agrupacion])

async function cargarAyer(eid) {
setCargandoAyer(true)
const ayer = getAyerGuatemala()

```
const { data: items } = await supabase
  .from('facturas_fel_items')
  .select('descripcion, cantidad, total')
  .eq('estacion_id', eid)
  .eq('fecha', ayer)
const mapa = {}
for (const item of (items || [])) {
  if (!PRODUCTOS_INVENTARIO.has(item.descripcion)) continue
  if (!mapa[item.descripcion]) mapa[item.descripcion] = { descripcion: item.descripcion, cantidad: 0, total: 0 }
  mapa[item.descripcion].cantidad += parseFloat(item.cantidad) || 0
  mapa[item.descripcion].total += parseFloat(item.total) || 0
}
setVentasAyer(Object.values(mapa).sort((a, b) => b.total - a.total))

const { data: vl } = await supabase
  .from('ventas_lubricantes')
  .select('id, fecha, total_venta, efectivo, neonet')
  .eq('estacion_id', eid)
  .eq('fecha', ayer)
  .maybeSingle()
setVentaAyerRow(vl || null)

setCargandoAyer(false)
```

}

async function cargarHistorial(eid, ini, fin, agrup) {
setCargandoHistorial(true)
const { data } = await supabase
.from(‘facturas_fel_items’)
.select(‘descripcion, cantidad, total, fecha’)
.eq(‘estacion_id’, eid)
.gte(‘fecha’, ini)
.lte(‘fecha’, fin)
.order(‘fecha’, { ascending: false })

```
const filtrado = (data || []).filter(i => PRODUCTOS_INVENTARIO.has(i.descripcion))
const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const mapa = {}
for (const item of filtrado) {
  let key, label
  if (agrup === 'dia') {
    key = item.fecha; label = item.fecha
  } else if (agrup === 'semana') {
    const d = new Date(item.fecha + 'T12:00:00')
    const inicio = new Date(d); inicio.setDate(d.getDate() - d.getDay())
    key = inicio.toLocaleDateString('en-CA')
    label = `Semana del ${inicio.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}`
  } else {
    key = item.fecha.substring(0, 7)
    const [y, m] = key.split('-')
    label = `${meses[parseInt(m)-1]} ${y}`
  }
  if (!mapa[key]) mapa[key] = { periodo: key, label, total: 0, cantidad: 0, items: {} }
  mapa[key].total += parseFloat(item.total) || 0
  mapa[key].cantidad += parseFloat(item.cantidad) || 0
  if (!mapa[key].items[item.descripcion]) mapa[key].items[item.descripcion] = { cantidad: 0, total: 0 }
  mapa[key].items[item.descripcion].cantidad += parseFloat(item.cantidad) || 0
  mapa[key].items[item.descripcion].total += parseFloat(item.total) || 0
}
setHistorial(Object.values(mapa).sort((a, b) => b.periodo.localeCompare(a.periodo)))
setCargandoHistorial(false)
```

}

function abrirEditor(venta) {
setEditandoVenta(venta)
setEditEfectivo(venta.efectivo > 0 ? String(venta.efectivo) : ‘’)
setEditNeonet(venta.neonet > 0 ? String(venta.neonet) : ‘’)
setErrorGuardar(’’)
}

function cerrarEditor() {
setEditandoVenta(null)
setEditEfectivo(’’)
setEditNeonet(’’)
setErrorGuardar(’’)
}

async function guardarFormasCobro() {
if (!editandoVenta) return
setGuardando(true)
setErrorGuardar(’’)
const efectivo = parseFloat(editEfectivo) || 0
const neonet = parseFloat(editNeonet) || 0
const { error } = await supabase
.from(‘ventas_lubricantes’)
.update({ efectivo, neonet })
.eq(‘id’, editandoVenta.id)
setGuardando(false)
if (error) {
setErrorGuardar(error.message || ‘No se pudo guardar. Verifica que sea una venta de hoy o ayer de tu estación.’)
return
}
cerrarEditor()
if (estacionId) cargarAyer(estacionId)
}

const totalAyer = ventasAyer.reduce((s, v) => s + v.total, 0)
const unidadesAyer = ventasAyer.reduce((s, v) => s + v.cantidad, 0)

const hoy = getHoyGuatemala()
const ayer = getAyerGuatemala()
const puedeEditarVentaAyer = ventaAyerRow && (
perfil?.rol === ‘admin’ ||
ventaAyerRow.fecha === hoy || ventaAyerRow.fecha === ayer
)

const totalCobrosEdit = (parseFloat(editEfectivo) || 0) + (parseFloat(editNeonet) || 0)
const diffEdit = editandoVenta ? (parseFloat(editandoVenta.total_venta) || 0) - totalCobrosEdit : 0

if (loading) return (
<div className="min-h-screen flex items-center justify-center">
<div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
</div>
)

return (
<Layout perfil={perfil} estacion={estacion}>
<div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

```
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Lubricantes</h1>
      <p className="text-sm text-gray-400 mt-0.5">{estacion?.nombre} · Ventas desde Infile</p>
    </div>

    <div className="flex gap-1 border-b border-gray-100">
      {[['ayer', 'Ayer'], ['historial', 'Historial']].map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          {label}
        </button>
      ))}
    </div>

    {/* ── Tab: Ayer ── */}
    {tab === 'ayer' && (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Total vendido ayer</div>
            <div className="text-2xl font-bold text-gray-900">{formatQ(totalAyer)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Unidades vendidas</div>
            <div className="text-2xl font-bold text-gray-900">{unidadesAyer.toLocaleString('es-GT')}</div>
          </div>
        </div>

        {/* Formas de cobro */}
        {ventaAyerRow ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">Formas de cobro</h2>
              {puedeEditarVentaAyer && (
                <button onClick={() => abrirEditor(ventaAyerRow)}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  {(ventaAyerRow.efectivo > 0 || ventaAyerRow.neonet > 0) ? 'Editar' : 'Cargar formas de cobro'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Efectivo</div>
                <div className="font-medium text-gray-800">{formatQ(ventaAyerRow.efectivo)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Neonet</div>
                <div className="font-medium text-gray-800">{formatQ(ventaAyerRow.neonet)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Total venta</div>
                <div className="font-medium text-gray-800">{formatQ(ventaAyerRow.total_venta)}</div>
              </div>
            </div>
            {(() => {
              const cobros = (parseFloat(ventaAyerRow.efectivo) || 0) + (parseFloat(ventaAyerRow.neonet) || 0)
              const tv = parseFloat(ventaAyerRow.total_venta) || 0
              const diff = tv - cobros
              if (cobros === 0) return (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-amber-600">
                  ⚠ Falta cargar formas de cobro
                </div>
              )
              if (Math.abs(diff) < 0.01) return (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-green-700">✓ Cuadra</div>
              )
              return (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-red-600">
                  Diferencia: Q{diff.toFixed(2)}
                </div>
              )
            })()}
          </div>
        ) : (
          !cargandoAyer && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
              Aún no hay registro de venta de lubricantes para ayer en esta estación. La sincronización desde Infile corre cada noche.
            </div>
          )
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Productos vendidos ayer — {getAyerGuatemala()}</h2>
            {cargandoAyer && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
          </div>
          {ventasAyer.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              {cargandoAyer ? 'Cargando...' : 'Sin ventas de lubricantes ayer'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-xs text-gray-400 font-normal">Producto</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-normal">Cant.</th>
                  <th className="px-5 py-2.5 text-right text-xs text-gray-400 font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventasAyer.map((v, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-700 text-xs">{v.descripcion}</td>
                    <td className="px-3 py-3 text-center text-gray-600 text-xs">{parseFloat(v.cantidad).toLocaleString('es-GT')}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 text-xs">{formatQ(v.total)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t border-gray-100">
                  <td className="px-5 py-3 text-xs font-semibold text-gray-700">Total</td>
                  <td className="px-3 py-3 text-center text-xs font-semibold text-gray-700">{unidadesAyer.toLocaleString('es-GT')}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatQ(totalAyer)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center">Los datos se sincronizan automáticamente cada noche desde Infile</p>
      </>
    )}

    {/* ── Tab: Historial ── */}
    {tab === 'historial' && (
      <>
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Desde</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hasta</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Agrupar por</label>
            <div className="flex gap-2">
              {[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([key, label]) => (
                <button key={key} onClick={() => setAgrupacion(key)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${agrupacion === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {cargandoHistorial ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : historial.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">
            Sin ventas en el período seleccionado
          </div>
        ) : (
          <div className="space-y-2">
            {historial.map((h, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button onClick={() => setDetalleAbierto(detalleAbierto === h.periodo ? null : h.periodo)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-800">{h.label || h.periodo}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{h.cantidad.toLocaleString('es-GT')} unidades</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">{formatQ(h.total)}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${detalleAbierto === h.periodo ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {detalleAbierto === h.periodo && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left py-1 font-normal">Producto</th>
                          <th className="text-center py-1 font-normal w-16">Cant.</th>
                          <th className="text-right py-1 font-normal w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(h.items)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([nombre, datos], j) => (
                            <tr key={j} className="border-t border-gray-100">
                              <td className="py-1.5 text-gray-700">{nombre}</td>
                              <td className="py-1.5 text-center text-gray-500">{datos.cantidad.toLocaleString('es-GT')}</td>
                              <td className="py-1.5 text-right font-medium text-gray-800">{formatQ(datos.total)}</td>
                            </tr>
                          ))}
                        <tr className="border-t border-gray-200">
                          <td className="py-2 font-semibold text-gray-700">Total</td>
                          <td className="py-2 text-center font-semibold text-gray-700">{h.cantidad.toLocaleString('es-GT')}</td>
                          <td className="py-2 text-right font-bold text-gray-900">{formatQ(h.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    )}

    {/* ── Modal: editar formas de cobro ── */}
    {editandoVenta && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Formas de cobro</h3>
            <button onClick={cerrarEditor} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Venta del {editandoVenta.fecha} · Total {formatQ(editandoVenta.total_venta)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Efectivo (Q)</label>
              <input type="number" min="0" step="0.01" value={editEfectivo}
                onChange={e => setEditEfectivo(e.target.value)} placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Neonet (Q)</label>
              <input type="number" min="0" step="0.01" value={editNeonet}
                onChange={e => setEditNeonet(e.target.value)} placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          {(editEfectivo || editNeonet) && (
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total venta</span>
                <span className="font-medium text-gray-800">{formatQ(editandoVenta.total_venta)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total cobros</span>
                <span className="font-medium text-gray-800">{formatQ(totalCobrosEdit)}</span>
              </div>
              <div className={`flex justify-between text-sm font-medium pt-1 border-t border-gray-100 ${Math.abs(diffEdit) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                <span>Diferencia</span>
                <span>{Math.abs(diffEdit) < 0.01 ? '✓ Cuadra' : `Q${diffEdit.toFixed(2)}`}</span>
              </div>
            </div>
          )}

          {errorGuardar && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              {errorGuardar}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={cerrarEditor} disabled={guardando}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={guardarFormasCobro} disabled={guardando}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    )}

  </div>
</Layout>
```

)
}