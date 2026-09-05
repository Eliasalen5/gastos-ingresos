const admin = require('firebase-admin');

let db = null;

function initFirestore() {
    if (db) return db;
    const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || './service-account.json';
    let credential;
    try {
        credential = admin.credential.cert(require(require('path').resolve(__dirname, '..', serviceAccountPath)));
    } catch (e) {
        throw new Error('No se pudo cargar la cuenta de servicio. Descargala del proyecto Firebase y guardala como bot/service-account.json (o seteá SERVICE_ACCOUNT_PATH). Detalle: ' + e.message);
    }
    admin.initializeApp({
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID || 'gastos-ingresos-5238d'
    });
    db = admin.firestore();
    return db;
}

async function loadContext() {
    const out = { categories: [], objectives: [] };
    try {
        const catSnap = await db.collection('categories').get();
        catSnap.forEach(d => {
            const data = d.data();
            out.categories.push({ id: d.id, name: data.name, type: data.type });
        });
    } catch (e) {
        console.error('Error leyendo categorías:', e.message);
    }
    try {
        const objSnap = await db.collection('inversion_objetivos').get();
        objSnap.forEach(d => {
            const data = d.data();
            out.objectives.push({ id: d.id, name: data.name, monedaSugerida: data.monedaSugerida || 'ARS' });
        });
    } catch (e) {
        console.error('Error leyendo objetivos:', e.message);
    }
    return out;
}

async function getInversionCategoryId() {
    const snap = await db.collection('categories')
        .where('type', '==', 'expense')
        .where('name', '==', 'Inversiones')
        .limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
    const ref = await db.collection('categories').add({
        name: 'Inversiones', icon: 'fa-chart-line', color: '#16A085', type: 'expense'
    });
    return ref.id;
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

async function addTransaction({ userId, type, amount, categoryId, description, date, inversionAporteId }) {
    const doc = {
        userId,
        type,
        amount: round2(amount),
        categoryId,
        description: description || '',
        date,
        paymentMethod: 'debito',
        paid: true,
        installments: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (inversionAporteId) doc.inversionAporteId = inversionAporteId;
    await db.collection('transactions').add(doc);
}

async function addAporte({ userId, objetivoId, currency, amount, rate, date, description, objetivoName }) {
    const rateNum = currency === 'USD' ? (rate || 1) : null;
    const amountARS = currency === 'USD'
        ? round2(amount * rateNum)
        : round2(amount);

    const aporteRef = await db.collection('inversion_aportes').add({
        userId,
        objetivoId,
        type: 'aporte',
        currency,
        amount: round2(amount),
        amountARS,
        rate: rateNum,
        date,
        description: description || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const invCatId = await getInversionCategoryId();
    await addTransaction({
        userId,
        type: 'expense',
        amount: amountARS,
        categoryId: invCatId,
        description: `Inversión: ${objetivoName || 'objetivo'}`,
        date,
        inversionAporteId: aporteRef.id
    });

    return aporteRef.id;
}

module.exports = { initFirestore, loadContext, addTransaction, addAporte, getInversionCategoryId };