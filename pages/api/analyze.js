export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { data, prompt } = req.body;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Eres un analista de datos experto en sistemas de bombeo y agua.\n${prompt}\n\nDatos:\n${JSON.stringify(data, null, 2)}`
        }]
      }),
    });

    const result = await response.json();

    if (result.error) {
      return res.status(400).json({ analysis: `Error API: ${result.error.message}` });
    }

    res.status(200).json({ analysis: result.content?.[0]?.text ?? "Sin respuesta" });

  } catch (error) {
    res.status(500).json({ analysis: `Error servidor: ${error.message}` });
  }
}
