require('dotenv').config();
const path = require('path');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');

const config = require(path.join(__dirname, 'config.json'));
const { initFirestore, loadContext, addTransaction, addAporte } = require('./lib/firestore');
const { callGemini, normalizeAmount, getBlueRate } = require('./lib/gemini');

const logger = pino({ level: 'warn' });

let sock = null;
let context = { categories: [], objectives: [] };
const USERS_REV = Object.fromEntries(Object.entries(config.users).map(([k, v]) => [v, k]));

function resolveUser(jid) {
    const phone = String(jid).split('@')[0].replace(/^\+/, '');
    for (const num of Object.keys(config.users)) {
        const clean = num.replace(/^\+/, '');
        if (phone === clean || phone.endsWith(clean) || clean.endsWith(phone) || phone.endsWith(clean.slice(-9)) || clean.endsWith(phone.slice(-9))) {
            return config.users[num];
        }
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

async function fetchAudioBuffer(msg) {
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

async function processMessage(jid, user, msg, texto) {
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
        const buf = await fetchAudioBuffer(msg);
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
    const values = normalizeAmount(parsed, await getBlueRate());

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
            const aporteId = await addAporte({
                userId: user,
                objetivoId,
                currency: values.moneda,
                amount: values.amount,
                rate: values.moneda === 'USD' ? (await getBlueRate()) : null,
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

async function handleIncomingMessage(msg) {
    const jid = msg.key.remoteJid;
    if (!jid || msg.key.fromMe) return;
    if (jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;

    const user = resolveUser(msg.key.participant || msg.key.remoteJid);
    if (!user) return;

    const texto = extractText(msg);
    const audio = extractAudio(msg);
    if (!texto && !audio) return;

    try {
        await processMessage(jid, user, msg, texto);
    } catch (e) {
        console.error('Error procesando mensaje:', e);
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info'));

    sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['GastosApp', 'Chrome', '1.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('\n=== Escaneá este QR desde WhatsApp > Dispositivos vinculados ===\n');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('\n');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reintentando:', shouldReconnect);
            if (shouldReconnect) {
                sock = null;
                connectToWhatsApp();
            } else {
                console.log('Sesión cerrada. Corré el bot de nuevo para escanear el QR.');
                process.exit(1);
            }
        }
        if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp como dispositivo vinculado.');
            try {
                context = await loadContext();
                console.log(`Contexto cargado: ${context.categories.length} categorías, ${context.objectives.length} objetivos.`);
            } catch (e) {
                console.error('Error cargando contexto:', e.message);
            }
        }
    });

    sock.ev.on('messages.upsert', async (msgs) => {
        for (const m of msgs.messages) {
            if (msgs.type === 'notify') {
                await handleIncomingMessage(m);
            }
        }
    });
}

initFirestore();
connectToWhatsApp();

process.on('SIGINT', () => { console.log('\nBot detenido.'); process.exit(0); });
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e.message));