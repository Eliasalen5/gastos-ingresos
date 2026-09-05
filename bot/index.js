require('dotenv').config();
const path = require('path');
const http = require('http');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');

const config = require(path.join(__dirname, 'config.json'));
const { initFirestore, loadContext, addTransaction, addAporte } = require('./lib/firestore');
const { callGemini, normalizeAmount, getBlueRate } = require('./lib/gemini');

const logger = pino({ level: 'warn' });

let context = { categories: [], objectives: [] };
const sessions = new Map(); // id -> { id, sock, selfUser, selfDigits, qr }

function localNumber(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function numDigits(n) {
    return String(n || '').replace(/\D/g, '');
}

// Devuelve el id de dispositivo (elias/nadia) cuyo número configurado es `digits`.
function findUserByNumber(digits) {
    if (!digits) return null;
    for (const dev of config.devices || []) {
        const d = numDigits(dev.number);
        if (d && digits === d) return dev.id;
    }
    for (const dev of config.devices || []) {
        const d = numDigits(dev.number);
        if (d && (digits.endsWith(d) || d.endsWith(digits))) return dev.id;
    }
    return null;
}

function extractText(msg) {
    const m = msg.message || {};
    return (m.conversation ||
        (m.extendedTextMessage && m.extendedTextMessage.text) ||
        (m.imageMessage && m.imageMessage.caption) ||
        (m.videoMessage && m.videoMessage.caption) ||
        '').trim();
}

function extractAudio(msg) {
    const m = msg.message || {};
    if (m.audioMessage) {
        return { mimeType: m.audioMessage.mimetype || 'audio/ogg; codecs=opus', ptt: !!m.audioMessage.ptt };
    }
    return null;
}

async function fetchAudioBuffer(sock, msg) {
    try {
        return await downloadMediaMessage(msg, 'buffer', {}, {
            logger,
            reuploadRequest: sock.updateMediaMessage
        });
    } catch (e) {
        console.error('Error descargando audio:', e.message);
        return null;
    }
}

function fechaHoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMoneyARS(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
}

async function processMessage(sock, jid, user, msg, texto) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        await sock.sendMessage(jid, { text: '❌ Falta GEMINI_API_KEY en .env. Revisar la config del bot.' });
        return;
    }

    const audio = extractAudio(msg);
    let audioBase64 = null;
    let mimeType = null;
    if (audio) {
        await sock.sendMessage(jid, { text: '🎧 Escuchando el audio…' });
        const buf = await fetchAudioBuffer(sock, msg);
        if (!buf) {
            await sock.sendMessage(jid, { text: '❌ No pude descargar el audio. Intentá de nuevo.' });
            return;
        }
        audioBase64 = buf.toString('base64');
        mimeType = audio.mimeType;
    } else if (!texto) {
        return;
    }

    let parsed;
    try {
        parsed = await callGemini({
            model: config.geminiModel,
            apiKey,
            prompt: { ctx: context, texto: texto || null },
            audioBase64,
            mimeType
        });
    } catch (e) {
        console.error('Error en Gemini:', e.message);
        await sock.sendMessage(jid, { text: '❌ La IA no respondió. Probá de nuevo en un rato.' });
        return;
    }

    const tipo = (parsed.tipo || '').toLowerCase();
    const blue = await getBlueRate();
    const values = normalizeAmount(parsed, blue);

    if (!values || parsed.dudoso) {
        const resp = `🤔 No entendí bien. ¿Podés repetir con monto claro?\nEj: "gasté 15 mil en supermercado" o "aporté 100 dólares a jubilación".`;
        await sock.sendMessage(jid, { text: resp });
        return;
    }

    // Resolver fecha
    const date = (parsed.fecha && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) ? parsed.fecha : fechaHoy();

    try {
        let resumen;
        if (tipo === 'inversion') {
            const objetivoId = context.objectives.find(o => o.id === parsed.objetivoId) ? parsed.objetivoId : null;
            if (!objetivoId) {
                await sock.sendMessage(jid, { text: `🤔 No reconozco ese objetivo de inversión. Los son: ${context.objectives.map(o => o.name).join(', ')}.` });
                return;
            }
            const objetivo = context.objectives.find(o => o.id === objetivoId);
            const rate = values.moneda === 'USD' ? (blue || 1) : null;
            const aporteId = await addAporte({
                userId: user,
                objetivoId,
                currency: values.moneda,
                amount: values.amount,
                rate,
                date,
                description: parsed.descripcion || '',
                objetivoName: objetivo.name
            });
            const monedaTxt = values.moneda === 'USD' ? `USD ${values.amount} (≈ ${formatMoneyARS(values.amountARS)})` : formatMoneyARS(values.amount);
            resumen = `✅ Inversión anotada: ${monedaTxt} → ${objetivo.name} · ${user} · ${date || ''}`;
        } else {
            const isIncome = tipo === 'ingreso';
            const categoriaId = context.categories.find(c => c.id === parsed.categoriaId && (isIncome ? c.type === 'income' : c.type === 'expense')) ? parsed.categoriaId : null;
            const cat = context.categories.find(c => c.id === categoriaId);
            await addTransaction({
                userId: user,
                type: isIncome ? 'income' : 'expense',
                amount: values.amountARS,
                categoryId: categoriaId || 'cat_otros_g', // fallback Otros gastos / ingresos
                description: parsed.descripcion || (cat ? cat.name : ''),
                date
            });
            const monedaTxt = values.moneda === 'USD' ? `USD ${values.amount} (≈ ${formatMoneyARS(values.amountARS)})` : formatMoneyARS(values.amount);
            resumen = `✅ ${isIncome ? 'Ingreso' : 'Gasto'} anotado: ${monedaTxt} · ${cat ? cat.name : 'Otros'} · ${user}${parsed.descripcion ? ' · ' + parsed.descripcion : ''}`;
        }
        await sock.sendMessage(jid, { text: resumen });
    } catch (e) {
        console.error('Error escribiendo en Firestore:', e);
        await sock.sendMessage(jid, { text: '❌ No se pudo guardar. Revisar la consola del bot.' });
    }
}

// Regla de captura: SOLO audios que el número vinculado se envía a sí mismo
// (chat "Mensajes guardados"). Nada más: ni textos, ni audios a otros chats/grupos,
// ni mensajes de otras personas.
async function handleIncomingMessage(session, msg) {
    const jid = msg.key.remoteJid;
    if (!jid) return;
    if (jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
    if (!msg.key.fromMe) return;
    if (!session.selfUser || !session.selfDigits) return;
    const audio = extractAudio(msg);
    if (!audio) return;
    if (localNumber(jid) !== session.selfDigits) return;

    try {
        await processMessage(session.sock, jid, session.selfUser, msg, '');
    } catch (e) {
        console.error('Error procesando mensaje:', e);
    }
}

async function connectDevice(dev) {
    const authDir = path.join(__dirname, dev.authDir || `auth_info_${dev.id}`);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: [`GastosApp-${dev.id}`, 'Chrome', '1.0']
    });

    const session = { id: dev.id, sock, selfUser: null, selfDigits: null, qr: null };
    sessions.set(dev.id, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            session.qr = { qr, ts: Date.now(), device: dev.id };
            QRCode.toDataURL(qr, { width: 256, margin: 1 }).then((url) => { session.qr.dataUrl = url; }).catch(() => { session.qr.dataUrl = ''; });
            console.log(`\n📱 [${dev.id}] QR listo. Abrí http://localhost:3000 para verlo (escanear con el WhatsApp de ${dev.id}).\n`);
            qrcodeTerminal.generate(qr, { small: true });
            console.log('\n');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[${dev.id}] Conexión cerrada. Reintentando: ${shouldReconnect}`);
            if (shouldReconnect) {
                sessions.delete(dev.id);
                connectDevice(dev);
            } else {
                session.selfUser = null;
                session.selfDigits = null;
                console.log(`[${dev.id}] Sesión cerrada (logged out). Escaneá el QR de nuevo para vincularla.`);
            }
        }
        if (connection === 'open') {
            const idDigits = localNumber(sock.user?.id);
            const usr = findUserByNumber(idDigits);
            console.log(`✅ [${dev.id}] Conectado a WhatsApp como dispositivo vinculado.`);
            if (usr === dev.id) {
                session.selfUser = usr;
                session.selfDigits = idDigits;
                console.log(`Bot vinculado: ${usr} (${sock.user.id}).`);
            } else {
                session.selfUser = null;
                session.selfDigits = null;
                console.log(`⚠️ [${dev.id}] El número vinculado (${idDigits || 'desconocido'}) no coincide con el configurado (${numDigits(dev.number)}). No se procesarán mensajes.`);
            }
            try {
                context = await loadContext();
                console.log(`Contexto cargado: ${context.categories.length} categorías, ${context.objectives.length} objetivos.`);
            } catch (e) {
                console.error('Error cargando contexto:', e.message);
            }
        }
    });

    sock.ev.on('messages.upsert', async (msgs) => {
        if (msgs.type !== 'notify') return;
        for (const m of msgs.messages) {
            await handleIncomingMessage(session, m);
        }
    });
}

function startQrServer() {
    const port = Number(process.env.QR_PORT || 3000);
    http.createServer(async (req, res) => {
        if (req.url === '/qr') {
            res.setHeader('Content-Type', 'application/json');
            const pending = [...sessions.values()].find(s => s.qr && s.qr.qr);
            if (pending) {
                res.end(JSON.stringify({ device: pending.id, qr: pending.qr.qr, dataUrl: pending.qr.dataUrl || '', ts: pending.qr.ts }));
            } else {
                res.end(JSON.stringify({ device: null, qr: null, dataUrl: '' }));
            }
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escaneá el QR — GastosApp</title>
<style>
body{font-family:system-ui;background:#0b141a;color:#e9edef;display:flex;flex-direction:column;align-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}
h1{font-size:20px;margin:8px 0}
p{color:#8696a0;text-align:center;max-width:420px;line-height:1.5}
.card{background:#fff;border-radius:12px;padding:18px;margin:12px 0}
img{width:280px;height:280px;object-fit:contain;display:block}
.hint{background:#12222b;border:1px solid #1f2c33;border-radius:8px;padding:10px 16px;font-size:14px;line-height:1.6}
#state{color:#ffd279;font-size:13px;min-height:18px}
</style>
</head>
<body>
<h1>📱 Escaneá este QR</h1>
<p id="who">Cargando…</p>
<p>En tu celu: <b>WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</b> y escaneá el QR.</p>
<div class="card"><img id="qr" src="" alt="QR"></div>
<div class="hint">El QR se <b>actualiza solo</b> cada ~20 s. Si vence antes de escanear, esperá al siguiente.</div>
<p id="state">Cargando QR…</p>
<script>
async function refresh() {
  try {
    const r = await fetch('/qr');
    const d = await r.json();
    const img = document.getElementById('qr');
    if (d.qr && d.dataUrl) {
      img.src = d.dataUrl;
      document.getElementById('who').textContent = 'Dispositivo: ' + (d.device || '?');
      document.getElementById('state').textContent = 'QR listo. Escanealo con ese WhatsApp.';
    } else if (d.qr) {
      document.getElementById('who').textContent = 'Dispositivo: ' + (d.device || '?');
      document.getElementById('state').textContent = 'Generando imagen del QR…';
    } else {
      document.getElementById('state').textContent = 'Conectado — sin QR (todas las sesiones vinculadas).';
    }
  } catch (e) {
    document.getElementById('state').textContent = 'Esperando al bot…';
  }
}
refresh();
setInterval(refresh, 3000);
</script>
</html>`);
    }).listen(port, '127.0.0.1', () => {
        console.log(`🌐 Abrí http://localhost:${port} en el navegador para escanear el QR.`);
    });
}

initFirestore();
startQrServer();
for (const dev of config.devices || []) {
    connectDevice(dev);
}

process.on('SIGINT', () => { console.log('\nBot detenido.'); process.exit(0); });
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e.message));