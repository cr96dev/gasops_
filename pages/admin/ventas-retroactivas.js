// pages/admin/ventas-retroactivas.js
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/router'

export default function VentasRetroactivas() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const [perfil, setPerfil] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  const [categoria, setCategoria] = useState('combustible')
  const [fecha, setFecha] = useState(() => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    return ayer.toISOString().split('T')[0]
  })
  const [estacionId, setEstacionId] = useState('')
  const [notas, setNotas] = useState('')

  // Combustible
  const [reg, setReg] = useState({ litros: '', ingresos: '' })
  const [pre, setPre] = useState({ litros: '', ingresos: '' })
  const [die, setDie] = useState({ litros: '', ingresos: '' })
  const [diep, setDiep] = useState({ litros: '', ingresos: '' })

  // Lubricantes
  const [lubTotal, setLubTotal] = useState('')

  // Tienda
  const [tiendaMonto, setTiendaMonto] = useState('')
  const [tiendaNumFactura, setTiendaNumFactura] = useState('')
  const [tiendaUuid, setTiendaUuid] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: p } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, rol')
        .eq('id', user.id)
        .single()

      if (!p || p.rol !== 'admin') {
        router.push('/dashboard')
        return
      }
      setPerfil(p)

      const { data: ests } = await supabase
        .from('qbo_mapping_estaciones')
        .select('gasops_estacion_id, estacion_nombre, estacion_codigo')
        .eq('activo', true)
        .order('estacion_nombre')
      setEstaciones(ests || [])
      setLoading(false)
    }
    init()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResultado(null)

    let datos = {}
    if (categoria === 'combustible') {
      datos = {
        regular_litros: parseFloat(reg.litros) || 0,
        regular_ingresos: parseFloat(reg.ingresos) || 0,
        premium_litros: parseFloat(pre.litros) || 0,
        premium_ingresos: parseFloat(pre.ingresos) || 0,
        diesel_litros: parseFloat(die.litros) || 0,
        diesel_ingresos: parseFloat(die.ingresos) || 0,
        diesel_plus_litros: parseFloat(diep.litros) || 0,
        diesel_plus_ingresos: parseFloat(diep.ingresos) || 0
      }
    } else if (categoria === 'lubricantes') {
      datos = { total_venta: parseFloat(lubTotal) || 0 }
    } else if (categoria === 'tienda') {
      datos = {
        fels: [{
          numero_factura: tiendaNumFactura,
          uuid_fel: tiendaUuid,
          nit_cliente: 'CF',
          nombre_cliente: 'CONSUMIDOR FINAL',
          monto: parseFloat(tiendaMonto) || 0
        }]
      }
    }

    try {
      const res = await fetch('/api/admin/carga-retroactiva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria, fecha, estacion_id: estacionId, datos, notas
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
      } else {
        setResultado(data)
        // Reset formulario
        setReg({ litros: '', ingresos: '' })
        setPre({ litros: '', ingresos: '' })
        setDie({ litros: '', ingresos: '' })
        setDiep({ litros: '', ingresos: '' })
        setLubTotal('')
        setTiendaMonto('')
        setTiendaNumFactura('')
        setTiendaUuid('')
        setNotas('')
      }
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (loading) return <div style={{padding: 40}}>Cargando...</div>
  if (!perfil) return null

  return (
    <div style={{maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif'}}>
      <h1>Carga Retroactiva de Ventas</h1>
      <p style={{color: '#666'}}>
        Usuario: <b>{perfil.nombre_completo}</b> · Rol: <b>{perfil.rol}</b>
      </p>
      
      <div style={{background:'#FEF3C7', padding:12, borderRadius:6, marginBottom: 20}}>
        ⚠️ Esta herramienta es solo para administradores. Todas las cargas quedan auditadas. 
        Una vez creado el registro, el cron del dia siguiente lo procesara automaticamente a QBO.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: 16}}>
          <label style={{display:'block', fontWeight:'bold'}}>Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)}
            style={{width:'100%', padding:8, marginTop:4}}>
            <option value="combustible">Combustible</option>
            <option value="lubricantes">Lubricantes</option>
            <option value="tienda">Tienda (FEL individual)</option>
          </select>
        </div>

        <div style={{display:'flex', gap:16, marginBottom: 16}}>
          <div style={{flex:1}}>
            <label style={{display:'block', fontWeight:'bold'}}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required style={{width:'100%', padding:8, marginTop:4}} />
          </div>
          <div style={{flex:1}}>
            <label style={{display:'block', fontWeight:'bold'}}>Estación</label>
            <select value={estacionId} onChange={e => setEstacionId(e.target.value)}
              required style={{width:'100%', padding:8, marginTop:4}}>
              <option value="">-- Seleccionar --</option>
              {estaciones.map(e => (
                <option key={e.gasops_estacion_id} value={e.gasops_estacion_id}>
                  {e.estacion_nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categoria === 'combustible' && (
          <div style={{background:'#F3F4F6', padding:16, borderRadius:6, marginBottom:16}}>
            <h3 style={{marginTop:0}}>Combustible (galones e ingresos por producto)</h3>
            {[['Regular', reg, setReg], ['Premium', pre, setPre], 
              ['Diesel', die, setDie], ['Diesel Plus', diep, setDiep]].map(([nombre, val, setter]) => (
              <div key={nombre} style={{display:'flex', gap:8, marginBottom:8, alignItems:'center'}}>
                <span style={{width:100, fontWeight:'bold'}}>{nombre}:</span>
                <input type="number" step="0.01" placeholder="Galones" value={val.litros}
                  onChange={e => setter({...val, litros: e.target.value})}
                  style={{flex:1, padding:8}} />
                <input type="number" step="0.01" placeholder="Ingresos Q" value={val.ingresos}
                  onChange={e => setter({...val, ingresos: e.target.value})}
                  style={{flex:1, padding:8}} />
              </div>
            ))}
          </div>
        )}

        {categoria === 'lubricantes' && (
          <div style={{background:'#F3F4F6', padding:16, borderRadius:6, marginBottom:16}}>
            <h3 style={{marginTop:0}}>Lubricantes</h3>
            <label>Total venta (Q, con IVA incluido)</label>
            <input type="number" step="0.01" value={lubTotal} onChange={e => setLubTotal(e.target.value)}
              required style={{width:'100%', padding:8, marginTop:4}} />
          </div>
        )}

        {categoria === 'tienda' && (
          <div style={{background:'#F3F4F6', padding:16, borderRadius:6, marginBottom:16}}>
            <h3 style={{marginTop:0}}>Tienda (1 FEL individual)</h3>
            <label>Número de factura</label>
            <input value={tiendaNumFactura} onChange={e => setTiendaNumFactura(e.target.value)}
              required style={{width:'100%', padding:8, marginBottom:8}} />
            <label>UUID FEL</label>
            <input value={tiendaUuid} onChange={e => setTiendaUuid(e.target.value)}
              required style={{width:'100%', padding:8, marginBottom:8}} />
            <label>Monto (Q, con IVA)</label>
            <input type="number" step="0.01" value={tiendaMonto} onChange={e => setTiendaMonto(e.target.value)}
              required style={{width:'100%', padding:8}} />
          </div>
        )}

        <div style={{marginBottom: 16}}>
          <label style={{display:'block', fontWeight:'bold'}}>Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Razon de la carga retroactiva..."
            style={{width:'100%', padding:8, marginTop:4, minHeight:60}} />
        </div>

        <button type="submit" disabled={submitting}
          style={{padding:'12px 24px', background:'#2E75B6', color:'white', 
                  border:'none', borderRadius:6, fontWeight:'bold', cursor:'pointer', fontSize:16}}>
          {submitting ? 'Guardando...' : 'Cargar venta'}
        </button>
      </form>

      {error && (
        <div style={{background:'#FEE2E2', padding:12, borderRadius:6, marginTop:16}}>
          ❌ Error: {error}
        </div>
      )}

      {resultado && (
        <div style={{background:'#D1FAE5', padding:12, borderRadius:6, marginTop:16}}>
          ✅ {resultado.mensaje}
          <div style={{marginTop:8, fontSize:14}}>
            <b>Estación:</b> {resultado.estacion}<br/>
            <b>Fecha:</b> {resultado.fecha}<br/>
            <b>Monto:</b> Q{resultado.monto_total.toFixed(2)}<br/>
            <b>Acción:</b> {resultado.accion}
          </div>
        </div>
      )}
    </div>
  )
}
