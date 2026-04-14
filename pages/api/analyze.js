export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { data, prompt } = req.body;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Eres un analista de datos experto en sistemas de bombeo y agua.\n${prompt}\n\nDatos:\n${JSON.stringify(data, null, 2)}`
      }]
    }),
  });

  const result = await response.json();
  res.json({ analysis: result.content?.[0]?.text ?? "Sin respuesta" });
}
