const Inversiones = {
    objetivos: [],
    aportes: [],
    settings: { pctInversion: 30, catGastoInversionId: '', legacyPurgeDone: false },
    _bound: false,

    SETTINGS_COLLECTION: 'app_settings',
    SETTINGS_DOC: 'inversiones',
    DEFAULT_PCT: 30,

    USERS: [
        { id: 'nadia', name: 'Nadia', color: 'var(--nadia)' },
        { id: 'elias', name: 'Elias', color: 'var(--elias)' }
    ],

    INSTRUMENTOS: [
        { id: 'efectivo', label: 'Pesos / caja de ahorro', icon: 'fa-money-bill' },
        { id: 'plazo_fijo', label: 'Plazo fijo', icon: 'fa-building-columns' },
        { id: 'usd_billete', label: 'Dólar billete', icon: 'fa-dollar-sign' },
        { id: 'sp500', label: 'Broker · S&P 500', icon: 'fa-chart-line' },
        { id: 'cedears', label: 'Broker · CEDEARs', icon: 'fa-chart-simple' },
        { id: 'bonos', label: 'Bonos / Fondo común', icon: 'fa-landmark' },
        { id: 'otro', label: 'Otro', icon: 'fa-tag' }
    ],

    INV_ICONS: [
        'fa-piggy-bank', 'fa-umbrella', 'fa-umbrella-beach', 'fa-baby', 'fa-house-chimney',
        'fa-plane', 'fa-graduation-cap', 'fa-car', 'fa-gift', 'fa-heart',
        'fa-chart-line', 'fa-chart-simple', 'fa-coins', 'fa-money-bill-wave', 'fa-dollar-sign',
        'fa-building-columns', 'fa-landmark', 'fa-wallet', 'fa-shield-halved', 'fa-seedling',
        'fa-briefcase', 'fa-rocket', 'fa-fire', 'fa-star', 'fa-tag'
    ],

    async init() {
        if (!this._bound) { this.bindEvents(); this._bound = true; }
        const m = document.getElementById('inversiones-month');
        if (m && !m.value) m.value = Utils.currentYearMonth();
        document.getElementById('inv-date').value = Utils.todayStr();
        await this.load();
        this.resetForm();
        this.render();
    },

    async refresh() {
        await this.load();
        this.render();
    },

    bindEvents() {
        document.getElementById('inv-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
        document.getElementById('inv-cancel').addEventListener('click', () => this.resetForm());
        document.getElementById('inversiones-month')?.addEventListener('change', () => this.render());
        document.getElementById('inv-pct-global')?.addEventListener('change', () => this.savePctGlobal());
        document.getElementById('inv-new-obj')?.addEventListener('click', () => this.openNewObjetivo());

        document.querySelectorAll('#inv-obj-modal .modal-close').forEach(b => b.addEventListener('click', () => this.closeObjModal()));
        document.querySelector('#inv-obj-modal .modal-overlay')?.addEventListener('click', () => this.closeObjModal());
        document.getElementById('inv-obj-form').addEventListener('submit', (e) => { e.preventDefault(); this.saveObjetivo(); });
    },

    async load() {
        try {
            await this.loadSettings();

            const snap = await db.collection('inversion_objetivos').get();
            this.objetivos = [];
            snap.forEach(doc => this.objetivos.push({ id: doc.id, ...doc.data() }));
            this.objetivos.sort((a, b) => (a.order || 99) - (b.order || 99));

            await this.migrateObjetivos();
            await this.purgeLegacyOnce();

            const snap2 = await db.collection('inversion_aportes').orderBy('date', 'desc').limit(1000).get();
            this.aportes = [];
            snap2.forEach(doc => this.aportes.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading inversiones:', e);
        }
    },

    async loadSettings() {
        const fallback = { pctInversion: this.DEFAULT_PCT, catGastoInversionId: '', legacyPurgeDone: false };
        try {
            const doc = await db.collection(this.SETTINGS_COLLECTION).doc(this.SETTINGS_DOC).get();
            const data = doc.exists ? (doc.data() || {}) : {};
            this.settings = {
                pctInversion: this.clampPct(data.pctInversion, this.DEFAULT_PCT),
                catGastoInversionId: data.catGastoInversionId || '',
                legacyPurgeDone: data.legacyPurgeDone === true
            };
        } catch (e) {
            console.error('Error cargando ajustes de inversiones:', e);
            this.settings = { ...fallback };
        }
        const input = document.getElementById('inv-pct-global');
        if (input) input.value = this.getPctInversion();
    },

    async saveSettings(patch) {
        this.settings = { ...this.settings, ...patch };
        try {
            await db.collection(this.SETTINGS_COLLECTION).doc(this.SETTINGS_DOC).set(this.settings, { merge: true });
        } catch (e) {
            console.error('Error guardando ajustes de inversiones:', e);
        }
    },

    getPctInversion() {
        return this.settings.pctInversion;
    },

    clampPct(value, fallback) {
        const n = parseFloat(value);
        if (isNaN(n)) return fallback;
        return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
    },

    async savePctGlobal() {
        const input = document.getElementById('inv-pct-global');
        if (!input) return;
        const pct = this.clampPct(input.value, this.DEFAULT_PCT);
        input.value = pct;
        if (pct === this.getPctInversion()) return;
        await this.saveSettings({ pctInversion: pct });
        App.toast(`Ahora se invierte el ${pct}% de cada salario`, 'success');
        this.render();
    },

    async migrateObjetivos() {
        const today = Utils.todayStr();
        for (const o of this.objetivos) {
            const legacyPct = o.pct != null ? this.clampPct(o.pct, 0) : 0;
            const patch = {};
            if (o.pctNadia === undefined) patch.pctNadia = legacyPct;
            if (o.pctElias === undefined) patch.pctElias = legacyPct;
            if (o.pct !== undefined) patch.pct = firebase.firestore.FieldValue.delete();
            if (o.metodo === undefined) patch.metodo = 'otro';
            if (o.metodoDetalle === undefined) patch.metodoDetalle = '';
            if (o.startDate === undefined) patch.startDate = today;
            if (o.lockMeses === undefined) patch.lockMeses = 0;
            if (o.freqRetiroMeses === undefined) patch.freqRetiroMeses = 0;
            if (o.monedaSugerida !== undefined) patch.monedaSugerida = firebase.firestore.FieldValue.delete();
            if (Object.keys(patch).length === 0) continue;
            try {
                await db.collection('inversion_objetivos').doc(o.id).update(patch);
            } catch (e) {
                console.error('Error migrando objetivo:', e);
                continue;
            }
            Object.keys(patch).forEach(k => {
                if (patch[k] === undefined) return;
                if (k === 'pct' || k === 'monedaSugerida') delete o[k];
                else o[k] = patch[k];
            });
        }
    },

    async purgeLegacyOnce() {
        if (this.settings.legacyPurgeDone) return;
        const removedIds = ['inv_2anios', 'inv_5anios', 'inv_10anios'];
        const toRemove = this.objetivos.filter(o => removedIds.includes(o.id));
        for (const o of toRemove) {
            try {
                await this.deleteObjetivoData(o.id);
            } catch (e) {
                console.error('Error purging legacy objetivo:', o.id, e);
            }
        }
        this.objetivos = this.objetivos.filter(o => !removedIds.includes(o.id));
        await this.saveSettings({ legacyPurgeDone: true });
    },

    isSalaryTx(tx) {
        if (!tx || tx.type !== 'income') return false;
        if (tx.categoryId === 'cat_salario') return true;
        const cat = Categories.getById(tx.categoryId);
        return !!cat && !!cat.name && cat.name.trim().toLowerCase() === 'salario';
    },

    getSalaryPayments(userId, prefix) {
        return Transactions.list
            .filter(tx => tx.userId === userId && typeof tx.date === 'string' && tx.date.startsWith(prefix) && this.isSalaryTx(tx))
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    },

    getMonthIncome(userId, prefix) {
        return this.getSalaryPayments(userId, prefix).reduce((s, t) => s + (t.amount || 0), 0);
    },

    getMonthlyTarget(userId, prefix) {
        return this.round2(this.getMonthIncome(userId, prefix) * this.getPctInversion() / 100);
    },

    pctFor(o, userId) {
        const n = parseFloat(userId === 'nadia' ? o.pctNadia : o.pctElias);
        return isNaN(n) ? 0 : n;
    },

    getCardTarget(o, userId, prefix) {
        return this.round2(this.getMonthlyTarget(userId, prefix) * this.pctFor(o, userId) / 100);
    },

    pctSum(userId) {
        return this.round2(this.objetivos.reduce((s, o) => s + this.pctFor(o, userId), 0));
    },

    round2(n) {
        return Math.round((n || 0) * 100) / 100;
    },

    addMonths(dateStr, n) {
        const d = new Date((dateStr || Utils.todayStr()) + 'T12:00:00');
        const y = d.getFullYear();
        const m = d.getMonth() + n;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const r = new Date(y, m, Math.min(d.getDate(), lastDay));
        return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`;
    },

    monthPrefix() {
        const el = document.getElementById('inversiones-month');
        return el && el.value ? el.value : Utils.currentYearMonth();
    },

    monthEnd(prefix) {
        const p = prefix || this.monthPrefix();
        const [y, m] = String(p).split('-').map(n => parseInt(n, 10));
        if (!y || !m) return '9999-12-31';
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    },

    monthLabel(prefix) {
        const p = prefix || this.monthPrefix();
        const d = new Date(p + '-15T12:00:00');
        if (isNaN(d.getTime())) return p;
        return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    },

    firstAporteDate(objetivoId) {
        const dates = this.aportes
            .filter(a => a.objetivoId === objetivoId && a.type === 'aporte' && a.date)
            .map(a => a.date)
            .sort();
        return dates[0] || null;
    },

    getWithdrawStatus(o) {
        const hoy = Utils.todayStr();
        const lock = o.lockMeses || 0;
        const freq = o.freqRetiroMeses || 0;
        if (lock > 0) {
            const base = this.firstAporteDate(o.id) || o.startDate || Utils.todayStr();
            const unlock = this.addMonths(base, lock);
            if (hoy < unlock) return { estado: 'bloqueado', fecha: unlock };
        }
        if (freq > 0) {
            const last = this.aportes
                .filter(a => a.objetivoId === o.id && a.type === 'retiro' && a.date)
                .map(a => a.date)
                .sort()
                .pop();
            if (last) {
                const next = this.addMonths(last, freq);
                if (hoy < next) return { estado: 'ventana', fecha: next };
            }
        }
        return { estado: 'libre', fecha: null };
    },

    arsValue(m) {
        if (m.amountARS != null) return m.amountARS;
        return m.amount || 0;
    },

    getMonthAportes(prefix) {
        const p = prefix || this.monthPrefix();
        return this.aportes.filter(a => typeof a.date === 'string' && a.date.startsWith(p));
    },

    getAportesHastaFinDeMes(objetivoId, prefix) {
        const limit = this.monthEnd(prefix);
        return this.aportes.filter(a => a.objetivoId === objetivoId && typeof a.date === 'string' && a.date <= limit);
    },

    getObjetivoTotals(objetivoId, prefix) {
        let ars = 0;
        this.getMonthAportes(prefix).forEach(a => {
            if (a.objetivoId !== objetivoId) return;
            ars += (a.type === 'retiro' ? -1 : 1) * this.arsValue(a);
        });
        return this.round2(ars);
    },

    getObjetivoAcumulado(objetivoId, prefix, userId) {
        let ars = 0;
        this.getAportesHastaFinDeMes(objetivoId, prefix).forEach(a => {
            if (userId && a.userId !== userId) return;
            ars += (a.type === 'retiro' ? -1 : 1) * this.arsValue(a);
        });
        return this.round2(ars);
    },

    getTotalEquiv(prefix) {
        return this.round2(this.objetivos.reduce((s, o) => s + this.getObjetivoTotals(o.id, prefix), 0));
    },

    getTotalAcumulado(prefix, userId) {
        return this.round2(this.objetivos.reduce((s, o) => s + this.getObjetivoAcumulado(o.id, prefix, userId), 0));
    },

    render() {
        this.renderSummary();
        this.renderObjetivos();
        this.renderTotals();
        this.renderHistory();
    },

    renderSummary() {
        const el = document.getElementById('inv-summary');
        if (!el) return;
        const prefix = this.monthPrefix();
        const monthLabel = this.monthLabel(prefix);
        const pctGlobal = this.getPctInversion();
        const avisos = [];

        el.innerHTML = this.USERS.map(u => {
            const income = this.getMonthIncome(u.id, prefix);
            const base = this.getMonthlyTarget(u.id, prefix);
            const payments = this.getSalaryPayments(u.id, prefix);
            let cobrosHtml = '';
            if (payments.length > 0) {
                cobrosHtml = `<div class="target-row" style="margin-top:2px"><span>${pctGlobal}% de cada cobro</span><b></b></div>` +
                    payments.map(p => {
                        const pct = this.round2((p.amount || 0) * pctGlobal / 100);
                        return `<div class="inv-cobro-row"><span>· ${Utils.formatDate(p.date)} · ${Utils.formatMoney(p.amount)}</span><b>${Utils.formatMoney(pct)}</b></div>`;
                    }).join('');
            }
            const rows = this.objetivos.map(o => {
                const monto = this.getCardTarget(o, u.id, prefix);
                return `<div class="target-row">
                    <span style="color:${o.color}"><i class="fas ${o.icon}"></i> ${Utils.esc(o.name)}</span>
                    <b>${Utils.formatMoney(monto)} <span class="muted">(${this.pctFor(o, u.id)}%)</span></b>
                </div>`;
            }).join('');
            const suma = this.pctSum(u.id);
            if (suma !== 100) avisos.push(`${u.name} suma ${suma}%`);
            return `
                <div class="ahorro-target" style="border-left-color:${u.color}">
                    <div class="target-header">
                        <span class="fw600" style="color:${u.color}">${u.name}</span>
                        <span class="muted">${Utils.esc(monthLabel)}</span>
                    </div>
                    <div class="target-row"><span>Salario cobrado</span><b>${Utils.formatMoney(income)}</b></div>
                    ${cobrosHtml}
                    <div class="target-row"><span>A invertir (${pctGlobal}%)</span><b>${Utils.formatMoney(base)}</b></div>
                    <div style="margin-top:8px">${rows || '<p class="muted" style="margin:0">Todavía no hay inversiones cargadas.</p>'}</div>
                </div>`;
        }).join('');

        if (avisos.length > 0) {
            el.innerHTML += `<p class="muted" style="margin-top:4px"><i class="fas fa-triangle-exclamation"></i> Ojo con los porcentajes (${Utils.esc(avisos.join(' · '))}): deberían sumar 100% cada uno. Tocá el lápiz en cada inversión para ajustarlos.</p>`;
        }
    },

    renderObjetivos() {
        const el = document.getElementById('inv-objetivos');
        if (!el) return;
        const prefix = this.monthPrefix();
        const label = Utils.esc(this.monthLabel(prefix));

        if (this.objetivos.length === 0) {
            el.innerHTML = `<div class="empty"><i class="fas fa-chart-line"></i><p>Todavía no hay inversiones</p><p class="muted">Tocá "+ Nueva inversión" para crear la primera y empezar a repartir el porcentaje.</p></div>`;
            return;
        }

        el.innerHTML = this.objetivos.map(o => {
            const delMes = this.getObjetivoTotals(o.id, prefix);
            const acum = this.getObjetivoAcumulado(o.id, prefix);
            const inst = this.INSTRUMENTOS.find(i => i.id === o.metodo);
            const metodoHtml = inst ? `
                    <div class="inv-metodo"><i class="fas ${inst.icon}"></i> ${Utils.esc(inst.label)}${o.metodoDetalle ? ` · ${Utils.esc(o.metodoDetalle)}` : ''}</div>` : '';
            const st = this.getWithdrawStatus(o);
            let statusHtml;
            if (st.estado === 'bloqueado') statusHtml = `<div class="inv-lock locked"><i class="fas fa-lock"></i> Disponible desde ${Utils.formatDate(st.fecha)}</div>`;
            else if (st.estado === 'ventana') statusHtml = `<div class="inv-lock window"><i class="fas fa-hourglass-half"></i> Próxima ventana de retiro: ${Utils.formatDate(st.fecha)}</div>`;
            else statusHtml = `<div class="inv-lock free"><i class="fas fa-lock-open"></i> Retiros libres</div>`;
            const retiroLocked = st.estado !== 'libre';
            const retiroTip = st.estado === 'bloqueado'
                ? `Disponible desde ${Utils.formatDate(st.fecha)}`
                : `Próxima ventana de retiro: ${Utils.formatDate(st.fecha)}`;

            const splitRows = this.USERS.map(u => {
                const pct = this.pctFor(o, u.id);
                const target = this.getCardTarget(o, u.id, prefix);
                const propio = this.getObjetivoAcumulado(o.id, prefix, u.id);
                const propioHtml = (propio !== 0)
                    ? ` <span class="muted">· ${Utils.formatMoney(propio)} aportados</span>`
                    : '';
                return `<div class="inv-split-row">
                    <span class="inv-split-name"><span class="user-dot" style="background:${u.color}"></span>${u.name} <span class="muted">${pct}%</span></span>
                    <span class="inv-split-value">${Utils.formatMoney(target)}${propioHtml}</span>
                </div>`;
            }).join('');

            return `
                <div class="ahorro-target inv-target" style="border-left-color:${o.color}">
                    <div class="target-header">
                        <span class="fw600 inv-target-name" style="color:${o.color}"><i class="fas ${o.icon}"></i> ${Utils.esc(o.name)}</span>
                        <span class="inv-target-actions">
                            <button class="icon-btn" data-editobj="${o.id}" title="Editar inversión"><i class="fas fa-pen"></i></button>
                            <button class="icon-btn danger" data-delobj="${o.id}" title="Eliminar inversión"><i class="fas fa-trash"></i></button>
                        </span>
                    </div>
                    ${metodoHtml}
                    ${statusHtml}
                    <div class="inv-split">${splitRows}</div>
                    <div class="target-row"><span>Invertido este mes</span><b>${Utils.formatMoney(delMes)}</b></div>
                    <div class="target-row"><span>Acumulado (hasta ${label})</span><b class="inv-acum">${Utils.formatMoney(acum)}</b></div>
                    <div class="target-footer">
                        <button class="btn btn-sm btn-primary" data-aporte="${o.id}"><i class="fas fa-plus"></i> Aportar</button>
                        <button class="btn btn-sm btn-ghost" data-retiro="${o.id}"${retiroLocked ? ` disabled title="${Utils.esc(retiroTip)}"` : ''}><i class="fas fa-minus-circle"></i> Retirar</button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-aporte]').forEach(btn => btn.addEventListener('click', () => this.openMove(btn.dataset.aporte, 'aporte')));
        el.querySelectorAll('[data-retiro]').forEach(btn => btn.addEventListener('click', () => this.openMove(btn.dataset.retiro, 'retiro')));
        el.querySelectorAll('[data-editobj]').forEach(btn => btn.addEventListener('click', () => this.openEditObjetivo(btn.dataset.editobj)));
        el.querySelectorAll('[data-delobj]').forEach(btn => btn.addEventListener('click', () => this.deleteObjetivo(btn.dataset.delobj)));
    },

    renderTotals() {
        const el = document.getElementById('inv-totals');
        if (!el) return;
        const prefix = this.monthPrefix();
        const label = Utils.esc(this.monthLabel(prefix));
        el.innerHTML = `
            <div class="stat-card"><div class="label">Invertido este mes</div><div class="value">${Utils.formatMoney(this.getTotalEquiv(prefix))}</div></div>
            <div class="stat-card"><div class="label">Acumulado al ${label}</div><div class="value">${Utils.formatMoney(this.getTotalAcumulado(prefix))}</div></div>
            <div class="stat-card"><div class="label">Aportado por vos</div><div class="value" style="color:var(--primary)">${Utils.formatMoney(this.getTotalAcumulado(prefix, Auth.currentUser))}</div></div>`;
    },

    renderHistory() {
        const el = document.getElementById('inv-history');
        if (!el) return;
        const prefix = this.monthPrefix();
        const monthAportes = this.getMonthAportes(prefix);
        if (monthAportes.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-chart-line"></i><p>Sin movimientos en este mes</p></div>';
            return;
        }
        const sorted = [...monthAportes].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        el.innerHTML = sorted.map(m => {
            const o = this.objetivos.find(x => x.id === m.objetivoId);
            const isRetiro = m.type === 'retiro';
            const user = m.userId === 'nadia' ? 'Nadia' : 'Elias';
            const ucolor = m.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const color = isRetiro ? 'var(--error)' : 'var(--success)';
            const icon = isRetiro ? 'fa-arrow-down' : 'fa-arrow-up';
            const label = m.description || (o ? o.name : 'Inversión');
            const amount = Utils.formatMoney(this.arsValue(m));

            return `
                <div class="tx-item">
                    <div class="tx-icon" style="background:${o ? o.color : '#95A5A6'}"><i class="fas ${icon}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${Utils.esc(label)}${isRetiro ? '' : '<span class="pending-badge">Aporte</span>'}</div>
                        <div class="tx-meta"><span class="user-dot" style="background:${ucolor}"></span> ${user} · ${Utils.formatDate(m.date)}</div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-value" style="color:${color}">${isRetiro ? '-' : '+'}${amount}</div>
                    </div>
                    <div class="tx-actions">
                        <button class="icon-btn" data-edit="${m.id}"><i class="fas fa-pen"></i></button>
                        <button class="icon-btn danger" data-del="${m.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = this.aportes.find(x => x.id === btn.dataset.edit);
                if (m) this.editMove(m);
            });
        });
        el.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMove(btn.dataset.del));
        });
    },

    updateObjetivoSelect() {
        const sel = document.getElementById('inv-objetivo');
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = this.objetivos.map(o => `<option value="${o.id}">${Utils.esc(o.name)}</option>`).join('');
        if (current && this.objetivos.some(o => o.id === current)) sel.value = current;
    },

    setType(type) {
        this._formType = type === 'retiro' ? 'retiro' : 'aporte';
        const title = document.getElementById('inv-form-title');
        if (title && !document.getElementById('inv-id').value) {
            title.textContent = this._formType === 'retiro' ? 'Registrar retiro' : 'Registrar movimiento';
        }
        const btn = document.getElementById('inv-type-btn');
        if (btn) {
            const isRetiro = this._formType === 'retiro';
            btn.classList.toggle('active', isRetiro);
            btn.innerHTML = isRetiro ? '<i class="fas fa-arrow-down"></i> Retirar' : '<i class="fas fa-arrow-up"></i> Aportar';
        }
    },

    resetForm() {
        const form = document.getElementById('inv-form');
        if (form) form.reset();
        document.getElementById('inv-id').value = '';
        document.getElementById('inv-form-title').textContent = 'Registrar movimiento';
        this.setType('aporte');
        this.updateObjetivoSelect();
        document.getElementById('inv-date').value = Utils.todayStr();
        const userSel = document.getElementById('inv-user');
        if (userSel) userSel.value = Auth.currentUser || 'nadia';
    },

    openMove(objetivoId, type) {
        this.resetForm();
        this.setType(type);
        const userId = Auth.currentUser || 'nadia';
        document.getElementById('inv-objetivo').value = objetivoId;
        document.getElementById('inv-user').value = userId;
        document.getElementById('inv-date').value = Utils.todayStr();
        if (type === 'aporte') {
            const o = this.objetivos.find(x => x.id === objetivoId);
            const target = o ? this.getCardTarget(o, userId, this.monthPrefix()) : 0;
            if (target > 0) document.getElementById('inv-amount').value = target;
        }
        document.getElementById('inv-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    editMove(m) {
        document.getElementById('inv-id').value = m.id;
        document.getElementById('inv-form-title').textContent = 'Editar movimiento';
        this.setType(m.type || 'aporte');
        this.updateObjetivoSelect();
        document.getElementById('inv-objetivo').value = m.objetivoId;
        document.getElementById('inv-user').value = m.userId || 'nadia';
        document.getElementById('inv-amount').value = this.arsValue(m);
        document.getElementById('inv-date').value = m.date;
        document.getElementById('inv-description').value = m.description || '';
        document.getElementById('inv-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    async save() {
        const id = document.getElementById('inv-id').value;
        const type = this._formType || 'aporte';
        const objetivoId = document.getElementById('inv-objetivo').value;
        const userId = document.getElementById('inv-user').value;
        const amount = parseFloat(document.getElementById('inv-amount').value);
        const date = document.getElementById('inv-date').value;
        const description = document.getElementById('inv-description').value.trim();

        if (!amount || !objetivoId || !date) {
            App.toast('Completá los campos', 'error');
            return;
        }

        const obj = this.objetivos.find(o => o.id === objetivoId);

        if (type === 'retiro' && obj) {
            const st = this.getWithdrawStatus(obj);
            if (st.estado !== 'libre') {
                App.toast(st.estado === 'bloqueado'
                    ? `🔒 ${obj.name}: se puede retirar recién desde ${Utils.formatDate(st.fecha)}`
                    : `⏳ Próxima ventana de retiro: ${Utils.formatDate(st.fecha)}`, 'error');
                return;
            }
        }

        const submitBtn = document.querySelector('#inv-form button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;
        if (submitBtn) submitBtn.disabled = true;

        try {
            const amountARS = this.round2(amount);
            const data = { userId, objetivoId, type, amount, amountARS, date, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

            let idFinal;
            if (id) {
                await db.collection('inversion_aportes').doc(id).update(data);
                idFinal = id;
            } else {
                const aporteRef = await db.collection('inversion_aportes').add(data);
                idFinal = aporteRef.id;
            }
            if (type === 'aporte') {
                await this.syncDiscount(idFinal, obj, data);
            }

            App.toast('Guardado', 'success');
            this.resetForm();
            await this.load();
            this.render();
        } catch (e) {
            console.error('Error saving inversion:', e);
            App.toast('Error al guardar', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async _findLinked(aporteId) {
        try {
            const t = await db.collection('transactions').where('inversionAporteId', '==', aporteId).limit(1).get();
            if (!t.empty) return { col: 'transactions', id: t.docs[0].id };
            return null;
        } catch (e) {
            console.error('Error finding linked discount:', e);
            return null;
        }
    },

    async _addDiscountAsTransaction(aporteId, obj, data, catId) {
        await db.collection('transactions').add({
            userId: data.userId,
            type: 'expense',
            amount: data.amountARS,
            categoryId: catId,
            subcategoryId: '',
            description: `Inversión: ${(obj && obj.name) || 'inversión'}`,
            date: data.date,
            paymentMethod: 'debito',
            paid: true,
            installments: 1,
            inversionAporteId: aporteId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async syncDiscount(aporteId, obj, data) {
        const linked = await this._findLinked(aporteId);
        const catId = await this.getInversionExpenseCategoryId();
        const desc = `Inversión: ${(obj && obj.name) || 'inversión'}`;
        if (linked) {
            await db.collection('transactions').doc(linked.id).update({
                userId: data.userId, amount: data.amountARS, categoryId: catId, subcategoryId: '',
                date: data.date, paid: true, description: desc
            });
        } else {
            await this._addDiscountAsTransaction(aporteId, obj, data, catId);
        }
        if (typeof Transactions !== 'undefined' && Transactions.load) await Transactions.load();
        if (App.currentPage === 'home') Dashboard.refresh();
    },

    async getInversionExpenseCategoryId() {
        const savedId = this.settings.catGastoInversionId;
        if (savedId && typeof Categories !== 'undefined' && Categories.getById(savedId)) return savedId;
        const existing = (typeof Categories !== 'undefined' ? Categories.list : [])
            .find(c => c.type === 'expense' && c.name && c.name.trim().toLowerCase() === 'inversiones');
        if (existing) {
            await this.saveSettings({ catGastoInversionId: existing.id });
            return existing.id;
        }
        try {
            const ref = await db.collection('categories').add({
                name: 'Inversiones', icon: 'fa-chart-line', color: '#16A085', type: 'expense',
                kind: 'fixed', subcategories: []
            });
            await this.saveSettings({ catGastoInversionId: ref.id });
            if (typeof Categories !== 'undefined' && Categories.load) await Categories.load();
            if (typeof Categories !== 'undefined' && Categories.updateFilterSelect) Categories.updateFilterSelect();
            if (typeof Categories !== 'undefined' && Categories.renderGrid) Categories.renderGrid();
            return ref.id;
        } catch (e) {
            console.error('Error creating inversion category:', e);
            return '';
        }
    },

    async revertLinkedDiscount(aporteId, m) {
        const linked = [];
        try {
            const snapT = await db.collection('transactions').where('inversionAporteId', '==', aporteId).get();
            snapT.forEach(d => linked.push({ col: 'transactions', id: d.id }));

            if (linked.length === 0 && m && m.type !== 'retiro') {
                const snap = await db.collection('transactions')
                    .where('userId', '==', m.userId)
                    .where('date', '==', m.date)
                    .where('amount', '==', m.amount)
                    .where('type', '==', 'expense')
                    .get();
                snap.forEach(d => {
                    const dd = d.data();
                    if (!dd.inversionAporteId && (dd.description || '').startsWith('Inversión:')) {
                        linked.push({ col: 'transactions', id: d.id });
                    }
                });
            }

            for (const l of linked) {
                await db.collection(l.col).doc(l.id).delete();
            }
            return linked.length > 0;
        } catch (e) {
            console.error('Error revirtiendo el descuento:', e);
            return false;
        }
    },

    async deleteMove(id) {
        const m = this.aportes.find(x => x.id === id);
        if (!confirm(m && m.type !== 'retiro' ? '¿Eliminar aporte? Se revertirá el descuento del sueldo.' : '¿Eliminar movimiento?')) return;
        try {
            await db.collection('inversion_aportes').doc(id).delete();
            const reverted = await this.revertLinkedDiscount(id, m);
            App.toast(reverted ? 'Eliminado · descuento revertido' : 'Eliminado', 'success');
            await this.load();
            this.render();
            if (typeof Transactions !== 'undefined' && Transactions.load) await Transactions.load();
            if (App.currentPage === 'home') Dashboard.refresh();
        } catch (e) {
            console.error(e);
            App.toast('Error al eliminar', 'error');
        }
    },

    async deleteObjetivoData(id) {
        const aportesSnap = await db.collection('inversion_aportes').where('objetivoId', '==', id).get();
        for (const d of aportesSnap.docs) {
            const txSnap = await db.collection('transactions').where('inversionAporteId', '==', d.id).get();
            await Promise.all(txSnap.docs.map(t => t.ref.delete()));
            await d.ref.delete();
        }
        await db.collection('inversion_objetivos').doc(id).delete();
    },

    async deleteObjetivo(id) {
        const o = this.objetivos.find(x => x.id === id);
        if (!o) return;
        const n = this.aportes.filter(a => a.objetivoId === id).length;
        const msg = n > 0
            ? `¿Eliminar "${o.name}"? Se borran también sus ${n} aporte${n === 1 ? '' : 's'} y el descuento que hicieron en Gastos.`
            : `¿Eliminar "${o.name}"?`;
        if (!confirm(msg)) return;
        try {
            await this.deleteObjetivoData(id);
            this.objetivos = this.objetivos.filter(x => x.id !== id);
            this.aportes = this.aportes.filter(a => a.objetivoId !== id);
            App.toast('Inversión eliminada', 'success');
            this.updateObjetivoSelect();
            this.render();
            if (typeof Transactions !== 'undefined' && Transactions.load) await Transactions.load();
            if (App.currentPage === 'home') Dashboard.refresh();
        } catch (e) {
            console.error(e);
            App.toast('Error al eliminar', 'error');
        }
    },

    _fillObjetivoForm(o) {
        const metSel = document.getElementById('io-metodo');
        metSel.innerHTML = this.INSTRUMENTOS.map(i => `<option value="${i.id}">${i.label}</option>`).join('');
        metSel.value = o.metodo || 'otro';
        document.getElementById('io-name').value = o.name || '';
        document.getElementById('io-color').value = o.color || '#6C63FF';
        document.getElementById('io-pct-nadia').value = this.pctFor(o, 'nadia');
        document.getElementById('io-pct-elias').value = this.pctFor(o, 'elias');
        document.getElementById('io-detalle').value = o.metodoDetalle || '';
        document.getElementById('io-plazo').value = o.plazo || '';
        document.getElementById('io-lock').value = o.lockMeses || 0;
        document.getElementById('io-freq').value = o.freqRetiroMeses || 0;
        this.selectedIcon = o.icon || this.INV_ICONS[0];
        Categories.renderIconPicker('inv-icon-picker', this.selectedIcon, (i) => { this.selectedIcon = i; }, this.INV_ICONS);
    },

    _setLockBaseInfo(id) {
        const o = this.objetivos.find(x => x.id === id);
        const el = document.getElementById('io-base');
        if (!el) return;
        if (!o) {
            el.textContent = 'El bloqueo se cuenta desde tu primer aporte a esta inversión.';
            return;
        }
        const base = this.firstAporteDate(o.id);
        el.textContent = base
            ? lockBaseInfo(base, o.lockMeses || 0, this)
            : 'Sin aportes todavía: el plazo de bloqueo empieza a contar con tu primer aporte.';
    },

    openEditObjetivo(objetivoId) {
        const o = this.objetivos.find(x => x.id === objetivoId);
        if (!o) return;
        document.getElementById('inv-obj-id').value = o.id;
        document.getElementById('inv-obj-title').textContent = `Editar: ${o.name}`;
        this._fillObjetivoForm(o);
        this._setLockBaseInfo(o.id);
        document.getElementById('inv-obj-modal').classList.remove('hidden');
    },

    openNewObjetivo() {
        document.getElementById('inv-obj-id').value = '';
        document.getElementById('inv-obj-title').textContent = 'Nueva inversión';
        this._fillObjetivoForm({ icon: this.INV_ICONS[0], color: '#6C63FF' });
        this._setLockBaseInfo(null);
        document.getElementById('inv-obj-modal').classList.remove('hidden');
    },

    closeObjModal() {
        document.getElementById('inv-obj-modal').classList.add('hidden');
    },

    _warnPctSums(nombre) {
        const fuera = this.USERS.filter(u => this.pctSum(u.id) !== 100);
        if (fuera.length === 0) return;
        App.toast(`Guardado. Ojo: los porcentajes de ${fuera.map(u => u.name).join(' y ')} no suman 100%`, 'info');
    },

    async saveObjetivo() {
        const id = document.getElementById('inv-obj-id').value;
        const name = document.getElementById('io-name').value.trim();
        if (!name) {
            App.toast('Poné un nombre para la inversión', 'error');
            return;
        }
        const patch = {
            name,
            icon: this.selectedIcon,
            color: document.getElementById('io-color').value || '#6C63FF',
            pctNadia: this.clampPct(document.getElementById('io-pct-nadia').value, 0),
            pctElias: this.clampPct(document.getElementById('io-pct-elias').value, 0),
            metodo: document.getElementById('io-metodo').value,
            metodoDetalle: document.getElementById('io-detalle').value.trim(),
            plazo: document.getElementById('io-plazo').value.trim() || null,
            lockMeses: Math.max(0, parseInt(document.getElementById('io-lock').value, 10) || 0),
            freqRetiroMeses: Math.max(0, parseInt(document.getElementById('io-freq').value, 10) || 0)
        };
        try {
            if (id) {
                const o = this.objetivos.find(x => x.id === id);
                if (!o) return;
                await db.collection('inversion_objetivos').doc(id).update(patch);
                Object.assign(o, patch);
                App.toast('Inversión actualizada', 'success');
            } else {
                const order = this.objetivos.reduce((m, o) => Math.max(m, o.order || 0), 0) + 1;
                const ref = await db.collection('inversion_objetivos').add({ ...patch, order, startDate: Utils.todayStr() });
                this.objetivos.push({ id: ref.id, ...patch, order, startDate: Utils.todayStr() });
                App.toast('Inversión creada', 'success');
            }
            this.objetivos.sort((a, b) => (a.order || 99) - (b.order || 99));
            this.closeObjModal();
            this.updateObjetivoSelect();
            this.render();
            this._warnPctSums(name);
        } catch (e) {
            console.error('Error guardando la inversión:', e);
            App.toast('Error al guardar', 'error');
        }
    }
};

function lockBaseInfo(firstDate, lockMeses, ctx) {
    const unlock = ctx.addMonths(firstDate, lockMeses);
    return `Primer aporte: ${Utils.formatDate(firstDate)}. ${lockMeses > 0 ? `Disponible desde ${Utils.formatDate(unlock)}.` : 'Sin bloqueo.'}`;
}
