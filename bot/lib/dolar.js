async function getBlueRate() {
    try {
        const res = await fetch('https://dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        const data = await res.json();
        const blue = data.find(d => d.casa === 'blue');
        return blue ? blue.venta : null;
    } catch (e) {
        console.error('Error obteniendo dólar blue:', e.message);
        return null;
    }
}

module.exports = { getBlueRate };