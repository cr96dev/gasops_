// pages/api/qbo/auth/callback-prod.js
// OAuth callback para QBO PRODUCTION

import { supabaseAdmin } from '../../../../lib/qbo/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { code, realmId, state, error } = req.query

  if (error) return res.status(400).send(`Error de Intuit: ${error}`)
  if (!code || !realmId) return res.status(400).send('Faltan parametros (code o realmId)')

  res.setHeader('Set-Cookie', 'qbo_oauth_state_prod=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')

  try {
    const redirectUri = process.env.QBO_REDIRECT_URI_PROD

    const tokenResponse = await fetch(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            `${process.env.QBO_CLIENT_ID_PROD}:${process.env.QBO_CLIENT_SECRET_PROD}`
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        }).toString()
      }
    )

    const responseText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      return res.status(500).send(`<pre>Token exchange failed
Status: ${tokenResponse.status}
Body: ${responseText}
</pre>`)
    }

    const data = JSON.parse(responseText)
    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = data

    const accessExpires = new Date(Date.now() + expires_in * 1000).toISOString()
    const refreshExpires = new Date(Date.now() + x_refresh_token_expires_in * 1000).toISOString()

    // Upsert con flag is_production = true
    const { error: dbError } = await supabaseAdmin
      .from('qbo_tokens')
      .upsert({
        realm_id: realmId,
        access_token,
        refresh_token,
        access_token_expires_at: accessExpires,
        refresh_token_expires_at: refreshExpires,
        is_production: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'realm_id' })

    if (dbError) {
      return res.status(500).send(`Error guardando tokens: ${dbError.message}`)
    }

    res.setHeader('Content-Type', 'text/html')
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2ca01c;">QuickBooks PRODUCTION Conectado</h1>
          <p>La integracion con tu QuickBooks Online REAL se ha establecido correctamente.</p>
          <ul>
            <li>Realm ID: <strong>${realmId}</strong></li>
            <li>Modo: <strong style="color: #dc2626;">PRODUCTION (datos reales)</strong></li>
            <li>Access expira: ${accessExpires}</li>
            <li>Refresh expira: ${refreshExpires}</li>
          </ul>
          <p style="margin-top: 30px; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong>Importante:</strong> Esta conexion es con tu QBO real. Antes de crear Sales Receipts validar mapeos.
          </p>
        </body>
      </html>
    `)

  } catch (err) {
    console.error('[QBO Auth Prod] Error:', err.message)
    res.status(500).send(`Error: ${err.message}`)
  }
}
