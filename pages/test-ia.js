import { useState } from "react";

export default function TestIA() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const test = async () => {
    setLoading(true);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Dame un resumen ejecutivo",
        data: { ventas: 150, clientes: 30, mes: "abril" }
      })
    });
    const json = await res.json();
    setResult(json.analysis);
    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={test} disabled={loading}>
        {loading ? "Analizando..." : "Probar IA"}
      </button>
      {result && <p>{result}</p>}
    </div>
  );
}
