// pages/api/qbo/auth/callback.js
// Recibe el authorization code de Intuit y lo intercambia por tokens
// GET /api/qbo/auth/callback?code=XXX&realmId=YYY&state=ZZZ

import { supabaseAdmin } from '../../../../lib/qbo/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, realmId, state, error } = req.query

  if (error) {
    console.error('[QBO Auth] Error from Intuit:', error)
    return res.status(400).send(`Error de Intuit: ${error}`)
  }

  const cookies = req.headers.cookie?.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=')
    acc[k] = v
    return acc
  }, {}) || {}

  if (!state || state !== cookies.qbo_oauth_state) {
    console.error('[QBO Auth] State mismatch - posible CSRF')
    return res.status(403).send('State invalido')
  }

  res.setHeader('Set-Cookie', 'qbo_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')

  if (!code || !realmId) {
    return res.status(400).send('Faltan parametros (code o realmId)')
  }

  try {
    const tokenResponse = await fetch(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.QBO_REDIRECT_URI
        }).toString()
      }
    )

    const data = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('[QBO Auth] Token exchange failed:', data)
      return res.status(500).send(`Error: ${data.error_description || data.error}`)
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      x_refresh_token_expires_in
    } = data

    const accessExpires = new Date(Date.now() + expires_in * 1000).toISOString()
    const refreshExpires = new Date(Date.now() + x_refresh_token_expires_in * 1000).toISOString()

    const { error: dbError } = await supabaseAdmin
      .from('qbo_tokens')
      .upsert({
        realm_id: realmId,
        access_token,
        refresh_token,
        access_token_expires_at: accessExpires,
        refresh_token_expires_at: refreshExpires,
        updated_at: new Date().toISOString()
      }, { onConflict: 'realm_id' })

    if (dbError) {
      console.error('[QBO Auth] DB error:', dbError)
      return res.status(500).send(`Error guardando tokens: ${dbError.message}`)
    }

    console.log(`[QBO Auth] Tokens guardados. Realm ID: ${realmId}`)

    res.setHeader('Content-Type', 'text/html')
    res.send(`
      <html>
        <head><title>QBO Conectado</title></head>
        <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2ca01c;">QuickBooks Conectado</h1>
          <p>La integracion con QuickBooks Online se ha establecido correctamente.</p>
          <ul>
            <li><strong>Realm ID:</strong> ${realmId}</li>
            <li><strong>Access token expira:</strong> ${accessExpires}</li>
            <li><strong>Refresh token expira:</strong> ${refreshExpires}</li>
          </ul>
          <a href="/admin">Ir al panel admin</a>
        </body>
      </html>
    `)

  } catch (err) {
    console.error('[QBO Auth] Error:', err.message)
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1 style="color: red;">Error en autenticacion</h1>
          <p>${err.message}</p>
          <a href="/api/qbo/auth/connect">Reintentar</a>
        </body>
      </html>
    `)
  }
}
