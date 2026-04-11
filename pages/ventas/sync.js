export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-bridge-secret"];
  if (!secret || secret !== process.env.BRIDGE_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const siteId = req.headers["x-site-id"];
  const body = req.body;

  if (!body || !body.date || !siteId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("ventas_diarias")
      .upsert(
        {
          site_id: body.site_id || siteId,
          site_name: body.site_name,
          fecha: body.date,
          total_litros: body.totals?.total_litros || null,
          total_ventas: body.totals?.total_ventas || null,
          num_transacciones: body.totals?.num_transacciones || null,
          raw_data: body,
          sincronizado_en: new Date().toISOString(),
        },
        { onConflict: "site_id,fecha" }
      )
      .select();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Ventas del ${body.date} guardadas para ${body.site_name}`,
      record: data[0],
    });
  } catch (err) {
    console.error("Error guardando en Supabase:", err);
    return res.status(500).json({ error: err.message });
  }
}
