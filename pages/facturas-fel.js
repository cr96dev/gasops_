import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useToast, ToastContainer } from '../components/Toast'
import * as XLSX from 'xlsx'

// ─── Credenciales INFILE ──────────────────────────────────────────────────────
const NIT_DEMO    = '11700574K'
const ALIAS_FIRMA = 'CARLOSR_DEMO'
const TOKEN_SIGNER= 'e10fd84400cce128d2a610d26c4fba88'
const USUARIO_CERT= 'CARLOSR_DEMO'
const LLAVE_CERT  = 'E6DAD6FB31C98E80D5C17746CCA08BC0'

// ─── Datos de estaciones para el XML emisor ───────────────────────────────────
const DATOS_ESTACIONES = {
  'a5bf7621-fa0a-44b2-891c-982446488d53': { nombre: 'ESTACIÓN DE SERVICIO QUETZAL',      cod: '5',  dir: 'BOULEVARD PRINCIPAL 15-0 B ZONA 0',  cp: '01001', mun: 'SAN JUAN SACATEPÉQUEZ', dep: 'GUATEMALA' },
  'cef374e5-139b-4279-a62e-0fe9544c2fa2': { nombre: 'ESTACIÓN DE SERVICIO BRISAS',       cod: '6',  dir: 'KM 17.5 CARRETERA AL PACIFICO',       cp: '01001', mun: 'VILLA NUEVA',           dep: 'GUATEMALA' },
  '6d616281-099b-49bf-9adc-5872ed1299ef': { nombre: 'ESTACIÓN DE SERVICIO HINCAPIÉ',     cod: '7',  dir: 'KM 9.5 CARRETERA AL ATLÁNTICO',       cp: '01001', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
  '3ae77767-ffa0-47f7-b391-f787e025d6cf': { nombre: 'ESTACIÓN DE SERVICIO KM. 13',       cod: '8',  dir: 'KM 13 CARRETERA AL ATLÁNTICO',        cp: '01001', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
  '507dbcbc-430e-4f98-935c-50e819df90b0': { nombre: 'ESTACIÓN DE SERVICIO KM. 7',        cod: '9',  dir: 'KM 7 CARRETERA AL ATLÁNTICO',         cp: '01001', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
  '82e478e3-2394-44c4-ab96-eff40f5159c7': { nombre: 'ESTACIÓN DE SERVICIO MATEO FLORES', cod: '10', dir: 'CALZADA AGUILAR BATRES 22-00 Z12',    cp: '01012', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
  '64a4e5c8-781f-4f53-92a4-bb6f6ae387b9': { nombre: 'ESTACIÓN DE SERVICIO MIRADOR',      cod: '11', dir: 'KM 15.5 CARRETERA AL PACÍFICO',       cp: '01001', mun: 'VILLA NUEVA',           dep: 'GUATEMALA' },
  '7e611589-c875-422a-ab81-979e8d7dd7d2': { nombre: 'ESTACIÓN DE SERVICIO PETAPA',       cod: '12', dir: 'BOULEVARD PETAPA KM 20',              cp: '01001', mun: 'SAN MIGUEL PETAPA',     dep: 'GUATEMALA' },
  'cc62be07-f32c-49f4-8da0-557ac479842b': { nombre: 'ESTACIÓN DE SERVICIO RIVERA DEL RIO',cod:'13', dir: 'CALZADA ROOSEVELT 32-00 ZONA 11',      cp: '01011', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
  'b04130a9-ac02-44a6-b995-5ee5ea8f19d8': { nombre: 'ESTACIÓN DE SERVICIO SAN CRISTÓBAL',cod:'14', dir: 'CALZADA SAN CRISTÓBAL Z8',             cp: '01008', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
  'ae6216ff-18ee-4a7d-a8a8-3a9eab00c420': { nombre: 'ESTACIÓN DE SERVICIO SAN PEDRITO',  cod: '15', dir: 'KM 24.5 CARRETERA AL PACIFICO',       cp: '01001', mun: 'AMATITLÁN',             dep: 'GUATEMALA' },
  '85da69a8-1e81-48a7-8b0d-82df9eeec15e': { nombre: 'TIENDA DE CONVENIENCIA OAKLAND',    cod: '1',  dir: 'CALZADA ROOSEVELT 32-00 ZONA 11',      cp: '01011', mun: 'GUATEMALA',             dep: 'GUATEMALA' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toBase64(str) {
  if (typeof window !== 'undefined' && window.btoa) {
    return window.btoa(unescape(encodeURIComponent(str)))
  }
  return Buffer.from(str, 'utf-8').toString('base64')
}

function generarXMLFactura({ estacionId, receptor, items, fecha }) {
  const est = DATOS_ESTACIONES[estacionId] || {}
  const now  = fecha || new Date().toISOString().replace('Z', '-06:00').substring(0, 25)

  const calcIva = (total) => {
    const gravable  = parseFloat((total / 1.12).toFixed(10))
    const impuesto  = parseFloat((total - gravable).toFixed(10))
    return { gravable, impuesto }
  }

  const itemsXml = items.map((item, i) => {
    const total = parseFloat((item.cantidad * item.precio).toFixed(2))
    const { gravable, impuesto } = calcIva(total)
    return `
    <dte:Item BienOServicio="B" NumeroLinea="${i + 1}">
      <dte:Cantidad>${parseFloat(item.cantidad).toFixed(2)}</dte:Cantidad>
      <dte:UnidadMedida>UND</dte:UnidadMedida>
      <dte:Descripcion>${escapeXml(item.descripcion)}</dte:Descripcion>
      <dte:PrecioUnitario>${parseFloat(item.precio).toFixed(2)}</dte:PrecioUnitario>
      <dte:Precio>${parseFloat(item.precio).toFixed(2)}</dte:Precio>
      <dte:Descuento>0.00</dte:Descuento>
      <dte:Impuestos>
        <dte:Impuesto>
          <dte:NombreCorto>IVA</dte:NombreCorto>
          <dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable>
          <dte:MontoGravable>${gravable.toFixed(10)}</dte:MontoGravable>
          <dte:MontoImpuesto>${impuesto.toFixed(10)}</dte:MontoImpuesto>
        </dte:Impuesto>
      </dte:Impuestos>
      <dte:Total>${total.toFixed(2)}</dte:Total>
    </dte:Item>`
  }).join('')

  const granTotal = parseFloat(items.reduce((s, i) => s + i.cantidad * i.precio, 0).toFixed(2))
  const totalIva  = calcIva(granTotal).impuesto

  return `<dte:GTDocumento xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1" xsi:schemaLocation="http://www.sat.gob.gt/dte/fel/0.2.0">
  <dte:SAT ClaseDocumento="dte">
    <dte:DTE ID="DatosCertificados">
      <dte:DatosEmision ID="DatosEmision">
        <dte:DatosGenerales CodigoMoneda="GTQ" FechaHoraEmision="${now}" Tipo="FACT"></dte:DatosGenerales>
        <dte:Emisor AfiliacionIVA="GEN" CodigoEstablecimiento="${est.cod || '1'}" CorreoEmisor="" NITEmisor="${NIT_DEMO}" NombreComercial="${escapeXml(est.nombre || 'HIDROCOM')}" NombreEmisor="HIDROCOM, SOCIEDAD ANONIMA">
          <dte:DireccionEmisor>
            <dte:Direccion>${escapeXml(est.dir || 'CIUDAD')}</dte:Direccion>
            <dte:CodigoPostal>${est.cp || '01001'}</dte:CodigoPostal>
            <dte:Municipio>${escapeXml(est.mun || 'GUATEMALA')}</dte:Municipio>
            <dte:Departamento>${escapeXml(est.dep || 'GUATEMALA')}</dte:Departamento>
            <dte:Pais>GT</dte:Pais>
          </dte:DireccionEmisor>
        </dte:Emisor>
        <dte:Receptor CorreoReceptor="${escapeXml(receptor.correo || '')}" IDReceptor="${escapeXml(receptor.nit || 'CF')}" NombreReceptor="${escapeXml(receptor.nombre || 'Consumidor Final')}">
          <dte:DireccionReceptor>
            <dte:Direccion>${escapeXml(receptor.direccion || 'Ciudad')}</dte:Direccion>
            <dte:CodigoPostal>01001</dte:CodigoPostal>
            <dte:Municipio>GUATEMALA</dte:Municipio>
            <dte:Departamento>GUATEMALA</dte:Departamento>
            <dte:Pais>GT</dte:Pais>
          </dte:DireccionReceptor>
        </dte:Receptor>
        <dte:Frases>
          <dte:Frase CodigoEscenario="1" TipoFrase="1"></dte:Frase>
          <dte:Frase CodigoEscenario="1" TipoFrase="2"></dte:Frase>
        </dte:Frases>
        <dte:Items>${itemsXml}
        </dte:Items>
        <dte:Totales>
          <dte:TotalImpuestos>
            <dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${totalIva.toFixed(10)}"></dte:TotalImpuesto>
          </dte:TotalImpuestos>
          <dte:GranTotal>${granTotal.toFixed(2)}</dte:GranTotal>
        </dte:Totales>
      </dte:DatosEmision>
    </dte:DTE>
  </dte:SAT>
</dte:GTDocumento>`
}

// ─── Llamadas via API Routes (evita CORS) ─────────────────────────────────────
async function firmarXML(xml, codigoInterno) {
  const xmlB64 = toBase64(xml)
  const res = await fetch('/api/fel/firmar', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      llave:        TOKEN_SIGNER,
      archivo:      xmlB64,
      codigo:       codigoInterno,
      alias:        ALIAS_FIRMA,
      es_anulacion: 'N'
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  if (!data.xml || data.xml.toLowerCase().includes('error')) {
    throw new Error('Error en firma: ' + (data.xml || '').substring(0, 300))
  }
  return data.xml
}

async function certificarXML(xmlFirmado, codigoInterno) {
  const xmlB64 = toBase64(xmlFirmado)
  const res = await fetch('/api/fel/certificar', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      usuario:       USUARIO_CERT,
      llave:         LLAVE_CERT,
      identificador: codigoInterno,
      body: {
        nit_emisor:   NIT_DEMO,
        correo_copia: '',
        xml_dte:      xmlB64
      }
    })
  })
  return await res.json()
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FacturasFEL({ session }) {
  const router = useRouter()
  const [perfil,           setPerfil]           = useState(null)
  const [estaciones,       setEstaciones]        = useState([])
  const [facturas,         setFacturas]          = useState([])
  const [loading,          setLoading]           = useState(true)
  const [cargando,         setCargando]          = useState(false)
  const [detalleAbierto,   setDetalleAbierto]    = useState(null)
  const [itemsDetalle,     setItemsDetalle]      = useState({})
  const [tab,              setTab]               = useState('ver')
  const [filtros,          setFiltros]           = useState({
    estacion:    'todas',
    vista:       'hoy',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin:    new Date().toISOString().split('T')[0],
    busqueda:    ''
  })
  const [totalesFEL,       setTotalesFEL]        = useState({ cantidad: 0, monto: 0 })
  const [resumenEstaciones,setResumenEstaciones] = useState([])

  // Estado emisión
  const [emitiendo,        setEmitiendo]         = useState(false)
  const [pasoEmision,      setPasoEmision]       = useState('')
  const [resultadoEmision, setResultadoEmision]  = useState(null)
  const [estacionEmit,     setEstacionEmit]      = useState('')
  const [receptor,         setReceptor]          = useState({ nit: 'CF', nombre: 'Consumidor Final', correo: '', direccion: 'Ciudad' })
  const [itemsEmit,        setItemsEmit]         = useState([{ descripcion: '', cantidad: 1, precio: '' }])

  const { toasts, toast } = useToast()

  useEffect(() => {
    if (!session) { router.push('/'); return }
    async function init() {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || p.rol !== 'admin') { router.push('/dashboard'); return }
      setPerfil(p)
      const { data: ests } = await supabase.from('estaciones').select('*').eq('activa', true).order('nombre')
      setEstaciones(ests || [])
      setLoading(false)
    }
    init()
  }, [session])

  const getFechas = useCallback((vista, fi, ff) => {
    const hoy = new Date()
    const fmt  = d => d.toISOString().split('T')[0]
    if (vista === 'hoy')    { const h = fmt(hoy); return { ini: h, fin: h } }
    if (vista === 'ayer')   { const a = new Date(hoy); a.setDate(hoy.getDate()-1); const s = fmt(a); return { ini: s, fin: s } }
    if (vista === 'semana') { const s = new Date(hoy); s.setDate(hoy.getDate()-6); return { ini: fmt(s), fin: fmt(hoy) } }
    if (vista === 'mes')    { return { ini: `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`, fin: fmt(hoy) } }
    if (vista === 'año')    { return { ini: `${hoy.getFullYear()}-01-01`, fin: fmt(hoy) } }
    return { ini: fi, fin: ff }
  }, [])

  const buscar = useCallback(async (f) => {
    const filtrosActivos = f || filtros
    setCargando(true)
    const { ini, fin } = getFechas(filtrosActivos.vista, filtrosActivos.fechaInicio, filtrosActivos.fechaFin)

    // Totalizador global (sin límite)
    let qMonto = supabase.from('facturas')
      .select('monto')
      .eq('sincronizado_infile', true)
      .gte('fecha_emision', ini)
      .lte('fecha_emision', fin)
    if (filtrosActivos.estacion !== 'todas') qMonto = qMonto.eq('estacion_id', filtrosActivos.estacion)
    const { data: montos } = await qMonto
    const totalMonto    = (montos || []).reduce((s, r) => s + parseFloat(r.monto || 0), 0)
    setTotalesFEL({ cantidad: montos?.length || 0, monto: totalMonto })

    // Resumen por estación
    let qRes = supabase.from('facturas')
      .select('estacion_id, monto, estaciones(nombre)')
      .eq('sincronizado_infile', true)
      .gte('fecha_emision', ini)
      .lte('fecha_emision', fin)
    if (filtrosActivos.estacion !== 'todas') qRes = qRes.eq('estacion_id', filtrosActivos.estacion)
    const { data: resumen } = await qRes
    const resMap = {}
    ;(resumen || []).forEach(r => {
      const key = r.estacion_id
      if (!resMap[key]) resMap[key] = { nombre: r.estaciones?.nombre, cantidad: 0, monto: 0 }
      resMap[key].cantidad++
      resMap[key].monto += parseFloat(r.monto || 0)
    })
    setResumenEstaciones(Object.values(resMap).sort((a, b) => b.monto - a.monto))

    // Tabla paginada (50)
    let qTabla = supabase.from('facturas')
      .select('*, estaciones(nombre)')
      .eq('sincronizado_infile', true)
      .gte('fecha_emision', ini)
      .lte('fecha_emision', fin)
      .order('fecha_emision', { ascending: false })
      .order('created_at',    { ascending: false })
      .limit(50)
    if (filtrosActivos.estacion !== 'todas') qTabla = qTabla.eq('estacion_id', filtrosActivos.estacion)
    const { data } = await qTabla
    setFacturas(data || [])
    setCargando(false)
  }, [filtros, getFechas])

  useEffect(() => { if (!loading) buscar() }, [loading])

  function cambiarVista(vista) {
    const nf = { ...filtros, vista }
    setFiltros(nf)
    buscar(nf)
  }

  function cambiarEstacion(estacion) {
    const nf = { ...filtros, estacion }
    setFiltros(nf)
    buscar(nf)
  }

  async function verItemsDetalle(facturaId) {
    if (detalleAbierto === facturaId) { setDetalleAbierto(null); return }
    setDetalleAbierto(facturaId)
    if (itemsDetalle[facturaId]) return
    const { data } = await supabase.from('facturas_fel_items').select('*').eq('factura_id', facturaId).order('id')
    setItemsDetalle(prev => ({ ...prev, [facturaId]: data || [] }))
  }

  // ─── Exportar Excel ───────────────────────────────────────────────────────
  async function exportarExcel() {
    const { ini, fin } = getFechas(filtros.vista, filtros.fechaInicio, filtros.fechaFin)
    const wb = XLSX.utils.book_new()

    let qf = supabase.from('facturas')
      .select('*, estaciones(nombre)')
      .eq('sincronizado_infile', true)
      .gte('fecha_emision', ini).lte('fecha_emision', fin)
      .order('fecha_emision')
    if (filtros.estacion !== 'todas') qf = qf.eq('estacion_id', filtros.estacion)
    const { data: facts } = await qf

    const ws1 = XLSX.utils.json_to_sheet((facts || []).map(f => ({
      Fecha:          f.fecha_emision,
      Estación:       f.estaciones?.nombre,
      'No. Factura':  f.numero_factura,
      Cliente:        f.proveedor,
      'Monto (Q)':    parseFloat(f.monto),
      UUID:           f.uuid_fel || ''
    })))
    XLSX.utils.book_append_sheet(wb, ws1, 'Facturas')

    // Ítems en lotes
    const ids = (facts || []).map(f => f.id)
    let allItems = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data: it } = await supabase.from('facturas_fel_items').select('*').in('factura_id', ids.slice(i, i + 100))
      allItems = allItems.concat(it || [])
    }
    const ws2 = XLSX.utils.json_to_sheet(allItems.map(it => ({
      Fecha:             it.fecha,
      Descripción:       it.descripcion,
      Cantidad:          it.cantidad,
      Unidad:            it.unidad,
      'Precio Unitario': it.precio_unitario,
      'Total (Q)':       it.total
    })))
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle ítems')

    const ws3 = XLSX.utils.json_to_sheet(resumenEstaciones.map(r => ({
      Estación:           r.nombre,
      'Cant. facturas':   r.cantidad,
      'Total (Q)':        parseFloat(r.monto.toFixed(2))
    })))
    XLSX.utils.book_append_sheet(wb, ws3, 'Resumen estaciones')

    XLSX.writeFile(wb, `FacturasFEL_${ini}_al_${fin}.xlsx`)
    toast('✓ Excel descargado', 'success')
  }

  // ─── Emisión ──────────────────────────────────────────────────────────────
  function agregarItem()                           { setItemsEmit(prev => [...prev, { descripcion: '', cantidad: 1, precio: '' }]) }
  function quitarItem(i)                           { setItemsEmit(prev => prev.filter((_, idx) => idx !== i)) }
  function actualizarItem(i, campo, valor)         { setItemsEmit(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it)) }

  const totalEmision = itemsEmit.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio) || 0), 0)

  async function emitirFactura() {
    if (!estacionEmit)                             { toast('Selecciona una estación', 'warning'); return }
    if (itemsEmit.some(i => !i.descripcion || !i.precio || parseFloat(i.precio) <= 0)) {
      toast('Completa descripción y precio de todos los productos', 'warning'); return
    }

    setEmitiendo(true)
    setResultadoEmision(null)

    try {
      const codigoInterno = `GAS-${Date.now()}`
      const fechaHora     = new Date().toISOString().replace('Z', '').substring(0, 19) + '-06:00'

      // Paso 1 — XML
      setPasoEmision('Generando XML...')
      const xml = generarXMLFactura({
        estacionId: estacionEmit,
        receptor,
        items: itemsEmit.map(i => ({
          descripcion: i.descripcion,
          cantidad:    parseFloat(i.cantidad) || 1,
          precio:      parseFloat(i.precio)   || 0
        })),
        fecha: fechaHora
      })

      // Paso 2 — Firma
      setPasoEmision('Firmando XML con signer INFILE...')
      const xmlFirmado = await firmarXML(xml, codigoInterno)

      // Paso 3 — Certificación
      setPasoEmision('Certificando con INFILE...')
      const certResp = await certificarXML(xmlFirmado, codigoInterno)

      if (!certResp.resultado) {
        const errores = (certResp.descripcion_errores || [])
          .map(e => e.mensaje_error || e.validacion)
          .join(' | ')
        throw new Error(errores || certResp.descripcion || 'Error en certificación')
      }

      const { uuid, serie, numero } = certResp
      const granTotal = parseFloat(totalEmision.toFixed(2))
      const esOakland = estacionEmit === '85da69a8-1e81-48a7-8b0d-82df9eeec15e'
      const fechaSolo = fechaHora.split('T')[0]

      if (esOakland) {
        await supabase.from('tienda_facturas_fel').insert({
          fecha:          fechaSolo,
          numero_factura: `${serie}-${numero}`,
          nit_cliente:    receptor.nit    || 'CF',
          nombre_cliente: receptor.nombre || 'Consumidor Final',
          monto:          granTotal,
          estado:         'ACTIVO',
          uuid_fel:       uuid,
          tipo_documento: 'FACT'
        })
      } else {
        const { data: factInsertada } = await supabase.from('facturas').insert({
          estacion_id:         estacionEmit,
          numero_factura:      `${serie}-${numero}`,
          proveedor:           receptor.nombre || 'Consumidor Final',
          fecha_emision:       fechaSolo,
          fecha_vencimiento:   fechaSolo,
          monto:               granTotal,
          estado:              'pagada',
          notas:               `FEL emitido | NIT: ${receptor.nit || 'CF'} | UUID: ${uuid}`,
          uuid_fel:            uuid,
          sincronizado_infile: true
        }).select()

        if (factInsertada?.[0]?.id) {
          const itsPayload = itemsEmit.map(it => ({
            factura_id:      factInsertada[0].id,
            estacion_id:     estacionEmit,
            fecha:           fechaSolo,
            descripcion:     it.descripcion,
            cantidad:        parseFloat(it.cantidad) || 1,
            unidad:          'UND',
            precio_unitario: parseFloat(it.precio) || 0,
            total:           (parseFloat(it.cantidad) || 1) * (parseFloat(it.precio) || 0),
            tipo:            'Bien'
          }))
          await supabase.from('facturas_fel_items').insert(itsPayload)
        }
      }

      setResultadoEmision({
        ok:      true,
        uuid,
        serie,
        numero,
        total:   granTotal,
        alertas: certResp.descripcion_alertas_infile || []
      })
      toast(`✓ Factura ${serie}-${numero} emitida correctamente`, 'success')

      // Resetear formulario
      setReceptor({ nit: 'CF', nombre: 'Consumidor Final', correo: '', direccion: 'Ciudad' })
      setItemsEmit([{ descripcion: '', cantidad: 1, precio: '' }])
      setEstacionEmit('')

    } catch (err) {
      setResultadoEmision({ ok: false, error: err.message })
      toast('Error al emitir: ' + err.message, 'error')
    }

    setPasoEmision('')
    setEmitiendo(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const vistas = [
    { key: 'hoy',          label: 'Hoy'         },
    { key: 'ayer',         label: 'Ayer'         },
    { key: 'semana',       label: '7 días'       },
    { key: 'mes',          label: 'Este mes'     },
    { key: 'año',          label: 'Este año'     },
    { key: 'personalizado',label: 'Personalizado'},
  ]

  const facturasFiltradas = filtros.busqueda
    ? facturas.filter(f => {
        const b = filtros.busqueda.toLowerCase()
        return f.numero_factura?.toLowerCase().includes(b) || f.proveedor?.toLowerCase().includes(b)
      })
    : facturas

  return (
    <Layout perfil={perfil} estacion={null}>
      <ToastContainer toasts={toasts} />
      <div className="p-6 max-w-6xl">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Facturas FEL — INFILE</h1>
          <p className="text-sm text-gray-400">Sincronización automática y emisión de facturas electrónicas</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-100">
          {[['ver','Ver facturas'],['emitir','+ Emitir factura']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab===key?'border-blue-600 text-blue-700 font-medium':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ════════════ TAB VER ════════════ */}
        {tab === 'ver' && (
          <>
            {/* Filtros de vista */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {vistas.map(v => (
                <button key={v.key} onClick={() => cambiarVista(v.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filtros.vista===v.key?'bg-blue-600 border-blue-600 text-white':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {v.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <select value={filtros.estacion} onChange={e => cambiarEstacion(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400">
                  <option value="todas">Todas las estaciones</option>
                  {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <button onClick={exportarExcel}
                  className="text-xs px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 text-green-700">
                  ↓ Excel
                </button>
              </div>
            </div>

            {/* Rango personalizado */}
            {filtros.vista === 'personalizado' && (
              <div className="flex gap-3 mb-4 items-end">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Inicio</label>
                  <input type="date" value={filtros.fechaInicio}
                    onChange={e => setFiltros(f => ({ ...f, fechaInicio: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fin</label>
                  <input type="date" value={filtros.fechaFin}
                    onChange={e => setFiltros(f => ({ ...f, fechaFin: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <button onClick={() => buscar()}
                  className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700">
                  Buscar
                </button>
              </div>
            )}

            {/* Totalizadores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total facturas',    valor: totalesFEL.cantidad.toLocaleString('es-GT') },
                { label: 'Monto total',       valor: `Q${totalesFEL.monto.toLocaleString('es-GT',{maximumFractionDigits:2})}` },
                { label: 'Promedio / factura',valor: totalesFEL.cantidad > 0 ? `Q${(totalesFEL.monto/totalesFEL.cantidad).toLocaleString('es-GT',{maximumFractionDigits:2})}` : '—' },
                { label: 'Estaciones',        valor: resumenEstaciones.length },
              ].map(({ label, valor }) => (
                <div key={label} className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-600 mb-1">{label}</div>
                  <div className="text-2xl font-medium text-blue-800">{valor}</div>
                </div>
              ))}
            </div>

            {/* Resumen por estación */}
            {resumenEstaciones.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-medium text-gray-700">Resumen por estación</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2 text-left text-xs text-gray-400 font-normal">Estación</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-400 font-normal">Facturas</th>
                      <th className="px-5 py-2 text-right text-xs text-gray-400 font-normal">Total Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenEstaciones.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-xs font-medium text-gray-800">{r.nombre}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{r.cantidad}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-800">Q{r.monto.toLocaleString('es-GT',{maximumFractionDigits:2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Buscador */}
            <div className="mb-3">
              <input type="text" value={filtros.busqueda} placeholder="Buscar por factura o cliente..."
                onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>

            {/* Tabla facturas */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {cargando ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : facturasFiltradas.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">No hay facturas para el período seleccionado</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-normal">Fecha</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Estación</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">No. Factura</th>
                        <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-normal">Cliente</th>
                        <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-normal">Monto</th>
                        <th className="px-4 py-2.5 text-center text-xs text-gray-400 font-normal">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasFiltradas.map(f => (
                        <>
                          <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-600 text-xs">{f.fecha_emision}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">{f.estaciones?.nombre}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">{f.numero_factura}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600">{f.proveedor}</td>
                            <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                              Q{parseFloat(f.monto).toLocaleString('es-GT',{minimumFractionDigits:2})}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={() => verItemsDetalle(f.id)}
                                className="text-xs text-blue-600 hover:text-blue-800">
                                {detalleAbierto===f.id ? '▲ Cerrar' : '▼ Ver'}
                              </button>
                            </td>
                          </tr>
                          {detalleAbierto === f.id && (
                            <tr key={f.id+'-det'} className="border-b border-gray-100">
                              <td colSpan={6} className="px-4 py-3 bg-blue-50/40">
                                {!itemsDetalle[f.id] ? (
                                  <div className="text-xs text-gray-400 text-center py-2">Cargando...</div>
                                ) : itemsDetalle[f.id].length === 0 ? (
                                  <div className="text-xs text-gray-400 text-center py-2">Sin detalle disponible</div>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-4 px-2 py-1.5 text-xs text-gray-400 font-medium border-b border-blue-100">
                                      <div className="col-span-2">Producto</div>
                                      <div className="text-center">Cantidad</div>
                                      <div className="text-right">Total</div>
                                    </div>
                                    {itemsDetalle[f.id].map((it, idx) => (
                                      <div key={idx} className="grid grid-cols-4 px-2 py-2 text-xs border-b border-blue-50 last:border-0">
                                        <div className="col-span-2 text-gray-700 font-medium">{it.descripcion}</div>
                                        <div className="text-center text-gray-500">{parseFloat(it.cantidad)} {it.unidad}</div>
                                        <div className="text-right text-gray-800 font-medium">Q{parseFloat(it.total).toLocaleString('es-GT',{minimumFractionDigits:2})}</div>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
                    Mostrando {facturasFiltradas.length} de {totalesFEL.cantidad} facturas
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ════════════ TAB EMITIR ════════════ */}
        {tab === 'emitir' && (
          <div className="max-w-2xl space-y-4">

            {/* Aviso demo */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700">
                <span className="font-medium">Modo demo</span> — Las facturas se emiten con credenciales de prueba (NIT 11700574K).
                La serie aparecerá como <code className="bg-amber-100 px-1 rounded font-mono">** PRUEBAS **</code> y no tiene validez fiscal.
                Cuando obtengas credenciales de producción se actualiza con un solo cambio.
              </p>
            </div>

            {/* Estación */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Estación emisora</h2>
              <select value={estacionEmit} onChange={e => setEstacionEmit(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                <option value="">Selecciona una estación...</option>
                {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            {/* Receptor */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Datos del receptor</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'NIT (o CF)',       key: 'nit',       placeholder: 'CF' },
                  { label: 'Nombre',           key: 'nombre',    placeholder: 'Consumidor Final' },
                  { label: 'Correo (opcional)',key: 'correo',    placeholder: 'cliente@email.com' },
                  { label: 'Dirección (opc.)', key: 'direccion', placeholder: 'Ciudad' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <input value={receptor[key]} placeholder={placeholder}
                      onChange={e => setReceptor(r => ({ ...r, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Ítems */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-700">Productos / servicios</h2>
                <button onClick={agregarItem} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar línea</button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                  <div className="col-span-6 text-xs text-gray-400 font-medium">Descripción</div>
                  <div className="col-span-2 text-xs text-gray-400 font-medium text-center">Cant.</div>
                  <div className="col-span-3 text-xs text-gray-400 font-medium text-center">Precio (Q c/IVA)</div>
                  <div className="col-span-1"></div>
                </div>

                {itemsEmit.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-50 last:border-0">
                    <div className="col-span-6">
                      <input value={item.descripcion}
                        onChange={e => actualizarItem(i, 'descripcion', e.target.value)}
                        placeholder="Combustible, lubricante..."
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="0.01" step="0.01" value={item.cantidad}
                        onChange={e => actualizarItem(i, 'cantidad', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-blue-400" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" min="0.01" step="0.01" value={item.precio}
                        onChange={e => actualizarItem(i, 'precio', e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-blue-400" />
                    </div>
                    <div className="col-span-1 text-center">
                      {itemsEmit.length > 1 && (
                        <button onClick={() => quitarItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </div>
                  </div>
                ))}

                {totalEmision > 0 && (
                  <div className="grid grid-cols-12 px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="col-span-8 text-xs font-medium text-gray-600">Gran Total (IVA incluido)</div>
                    <div className="col-span-3 text-sm font-medium text-gray-800 text-center">
                      Q{totalEmision.toLocaleString('es-GT',{minimumFractionDigits:2})}
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Resultado */}
            {resultadoEmision && (
              <div className={`rounded-xl border px-5 py-4 ${resultadoEmision.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {resultadoEmision.ok ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-green-800">Factura emitida y certificada</span>
                    </div>
                    <div className="space-y-1 text-xs text-green-700">
                      <div>Serie: <span className="font-mono font-medium">{resultadoEmision.serie}</span></div>
                      <div>Número: <span className="font-mono font-medium">{resultadoEmision.numero}</span></div>
                      <div>UUID: <span className="font-mono">{resultadoEmision.uuid}</span></div>
                      <div>Total: <span className="font-medium">Q{resultadoEmision.total.toLocaleString('es-GT',{minimumFractionDigits:2})}</span></div>
                    </div>
                    {resultadoEmision.alertas?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="text-xs text-green-600 font-medium mb-1">Alertas INFILE:</div>
                        {resultadoEmision.alertas.map((a, i) => (
                          <div key={i} className="text-xs text-green-600">• {a}</div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <span className="text-sm font-medium text-red-700">Error al emitir</span>
                    </div>
                    <p className="text-xs text-red-600">{resultadoEmision.error}</p>
                  </>
                )}
              </div>
            )}

            {/* Botón emitir */}
            <button onClick={emitirFactura} disabled={emitiendo || !estacionEmit || totalEmision === 0}
              className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-3">
              {emitiendo ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{pasoEmision}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Emitir y certificar factura FEL
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
