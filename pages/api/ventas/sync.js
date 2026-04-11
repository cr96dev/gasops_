export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TEMPORAL: sin verificación de secret
  const siteId = req.headers["x-site-id"];
  const body = req.body;

  return res.status(200).json({
    success: true,
    message: "Test OK",
    headers_recibidos: {
      secret: req.headers["x-bridge-secret"],
      site: req.headers["x-site-id"],
    },
    env_bridge_secret: process.env.BRIDGE_SECRET || "NO ENCONTRADO",
    body_recibido: body,
  });
}
