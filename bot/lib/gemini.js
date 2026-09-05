const { getBlueRate } = require('./dolar');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function buildSystemInstruction(ctx) {
    const catsGasto = ctx.categories.filter(c => c.type === 'expense');
    const catsIngreso = ctx.categories.filter(c => c.type === 'income');

    const fase = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

    return `Sos un asistente que anota gastos e inversiones de una pareja (Nadia y Elias) en una app.

Fecha de hoy: ${fase}. Usá el día de hoy si no se menciona otra fecha.

CATEGORÍAS DE GASTO (id: nombre):
${catsGasto.map(c => `${c.id}: ${c.name}`).join('\n')}

CATEGORÍAS DE INGRESO (id: nombre):
${catsIngreso.map(c => `${c.id}: ${c.name}`).join('\n')}

OBJETIVOS DE INVERSIÓN (id: nombre · moneda sugerida):
${ctx.objectives.map(o => `${o.id}: ${o.name} · ${o.monedaSugerida}`).join('\n')}

La persona dicta montos en argentino: "quince mil"=15000, "dos kilos"=2000, "ocho lukitas"=8000, "cien dolares"=100 USD.
Moneda por defecto: ARS. Solo usá USD si la persona dice "dólares", "usd", "dolares" o el objetivo la sugiere.

Instrucciones:
- "tipo": "gasto", "ingreso" o "inversion".
- Si es inversion, indicá "objetivoId" eligiendo el id EXACTO de la lista (según lo que nombre), y "moneda" según lo que diga o la moneda sugerida del objetivo.
- Si es gasto o ingreso, indicá "categoriaId" eligiendo el id EXACTO de la lista.
- "monto": número del dinero (solo cifra). Si el audio no deja claro el monto, poné null.
- "moneda": "ARS" o "USD".
- "descripcion": descripción corta (ej. "supermercado", "expensas", "aporte a jubilación").
- "fecha": "AAAA-MM-DD" si aclara (ej. "ayer", "el 3"), sino null.
- "dudoso": true solo si no entendés el monto o falta mucha info. En ese caso "monto"=null.
- Respondé SOLO JSON válido, sin texto extra.`;
}

async function callGemini({ model, apiKey, prompt, audioBase64, mimeType }) {
    const parts = [{ text: buildSystemInstruction(prompt.ctx) }];
    if (audioBase64) {
        parts.push({ inlineData: { mimeType: mimeType || 'audio/ogg; codecs=opus', data: audioBase64 } });
    }
    if (prompt.texto) {
        parts.push({ text: prompt.texto });
    }

    const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    };

    const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000)
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini error ${res.status}: ${txt.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    const parsed = JSON.parse(text);
    return parsed;
}

function normalizeAmount(values, blue) {
    if (values.monto == null) return null;
    const moneda = (values.moneda || 'ARS').toUpperCase();
    const amountNum = Number(values.monto);
    if (!isFinite(amountNum) || amountNum <= 0) return null;
    return { amount: amountNum, moneda, amountARS: moneda === 'USD' ? Math.round(amountNum * (blue || 1) * 100) / 100 : Math.round(amountNum * 100) / 100 };
}

module.exports = { callGemini, normalizeAmount, getBlueRate };