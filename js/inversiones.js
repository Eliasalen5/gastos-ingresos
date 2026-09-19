const Inversiones = {
    objetivos: [],
    aportes: [],
    _bound: false,

    INSTRUMENTOS: [
        { id: 'efectivo', label: 'Pesos / caja de ahorro', icon: 'fa-money-bill' },
        { id: 'plazo_fijo', label: 'Plazo fijo', icon: 'fa-building-columns' },
        { id: 'usd_billete', label: 'Dólar billete', icon: 'fa-dollar-sign' },
        { id: 'sp500', label: 'Broker · S&P 500', icon: 'fa-chart-line' },
        { id: 'cedears', label: 'Broker · CEDEARs', icon: 'fa-chart-simple' },
        { id: 'bonos', label: 'Bonos / Fondo común', icon: 'fa-landmark' },
        { id: 'otro', label: 'Otro', icon: 'fa-tag' }
    ],

    DEFAULTS: [
        { id: 'inv_emergencia', name: 'Fondo de emergencia', icon: 'fa-umbrella', color: '#E74C3C', pct: 25, order: 1, plazo: null, metodo: 'efectivo', metodoDetalle: '', monedaSugerida: 'ARS', lockMeses: 0, freqRetiroMeses: 0 },
        { id: 'inv_hijo', name: 'Futuro de nuestro hijo', icon: 'fa-baby', color: '#FF6B9D', pct: 20, order: 2, plazo: null, metodo: 'usd_billete', metodoDetalle: '', monedaSugerida: 'ARS', lockMeses: 12, freqRetiroMeses: 12 },
        { id: 'inv_jubilacion', name: 'Jubilación', icon: 'fa-umbrella-beach', color: '#2ECC71', pct: 15, order: 3, plazo: null, metodo: 'sp500', metodoDetalle: '', monedaSugerida: 'ARS', lockMeses: 0, freqRetiroMeses: 0 },
        { id: 'inv_serrucho', name: 'Inversión serrucho (vacaciones)', icon: 'fa-plane', color: '#3498DB', pct: 15, order: 4, plazo: '1 año', metodo: 'usd_billete', metodoDetalle: '', monedaSugerida: 'ARS', lockMeses: 12, freqRetiroMeses: 0 },
        { id: 'inv_casa', name: 'Futura casa', icon: 'fa-house-chimney', color: '#E67E22', pct: 25, order: 5, plazo: null, metodo: 'plazo_fijo', metodoDetalle: '', monedaSugerida: 'ARS', lockMeses: 0, freqRetiroMeses: 0 }
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

        document.getElementById('inv-amount')?.addEventListener('input', () => this.updatePreview());

        document.querySelectorAll('#inv-obj-modal .modal-close').forEach(b => b.addEventListener('click', () => this.closeObjModal()));
        document.querySelector('#inv-obj-modal .modal-overlay')?.addEventListener('click', () => this.closeObjModal());
        document.getElementById('inv-obj-form').addEventListener('submit', (e) => { e.preventDefault(); this.saveObjetivo(); });
    },

    async load() {
        try {
            const snap = await db.collection('inversion_objetivos').get();
            this.objetivos = [];
            snap.forEach(doc => this.objetivos.push({ id: doc.id, ...doc.data() }));
            const existingIds = this.objetivos.map(o => o.id);
            for (const obj of this.DEFAULTS) {
                if (existingIds.includes(obj.id)) continue;
                await db.collection('inversion_objetivos').doc(obj.id).set({
                    name: obj.name, icon: obj.icon, color: obj.color, pct: obj.pct, order: obj.order, plazo: obj.plazo,
                    metodo: obj.metodo, metodoDetalle: '', monedaSugerida: obj.monedaSugerida,
                    startDate: Utils.todayStr(), lockMeses: obj.lockMeses, freqRetiroMeses: obj.freqRetiroMeses
                });
                this.objetivos.push({ id: obj.id, ...obj, startDate: Utils.todayStr(), metodoDetalle: '' });
            }
            this.objetivos.sort((a, b) => (a.order || 99) - (b.order || 99));

            await this.purgeRemovedObjetivos();

            await this.migrateObjetivos();

            const snap2 = await db.collection('inversion_aportes').orderBy('date', 'desc').limit(1000).get();
            this.aportes = [];
            snap2.forEach(doc => this.aportes.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading inversiones:', e);
            if (this.objetivos.length === 0) this.objetivos = [...this.DEFAULTS];
            this.aportes = [];
        }
    },

    async purgeRemovedObjetivos() {
        const removedIds = ['inv_2anios', 'inv_5anios', 'inv_10anios'];
        const toRemove = this.objetivos.filter(o => removedIds.includes(o.id));
        if (toRemove.length === 0) return;
        for (const o of toRemove) {
            try {
                const aportesSnap = await db.collection('inversion_aportes').where('objetivoId', '==', o.id).get();
                const aporteIds = [];
                aportesSnap.forEach(d => aporteIds.push(d.id));
                for (const aporteId of aporteIds) {
                    const txSnap = await db.collection('transactions').where('inversionAporteId', '==', aporteId).get();
                    await Promise.all(txSnap.docs.map(d => d.ref.delete()));
                    await db.collection('inversion_aportes').doc(aporteId).delete();
                }
                await db.collection('inversion_objetivos').doc(o.id).delete();
            } catch (e) {
                console.error('Error purging objetivo:', o.id, e);
            }
        }
        this.objetivos = this.objetivos.filter(o => !removedIds.includes(o.id));
    },

    async migrateObjetivos() {
        const today = Utils.todayStr();
        for (const o of this.objetivos) {
            const def = this.DEFAULTS.find(d => d.id === o.id);
            const patch = {};
            if (o.metodo === undefined) patch.metodo = def ? def.metodo : 'otro';
            if (o.metodoDetalle === undefined) patch.metodoDetalle = '';
            if (o.monedaSugerida === undefined) patch.monedaSugerida = def ? def.monedaSugerida : '';
            if (o.startDate === undefined) patch.startDate = o.fechaCreacion || today;
            if (o.lockMeses === undefined) patch.lockMeses = def ? def.lockMeses : 0;
            if (o.freqRetiroMeses === undefined) patch.freqRetiroMeses = def ? def.freqRetiroMeses : 0;
            if (Object.keys(patch).length > 0) {
                try {
                    await db.collection('inversion_objetivos').doc(o.id).update(patch);
                } catch (err) {
                    console.error('Error migrating objetivo:', err);
                }
                Object.assign(o, patch);
            }
        }
    },

    getMonthIncome(userId, prefix) {
        return Transactions.list
            .filter(tx => tx.userId === userId && tx.type === 'income' && typeof tx.date === 'string' && tx.date.startsWith(prefix))
            .filter(tx => {
                const cat = Categories.getById(tx.categoryId);
                return cat && cat.name && cat.name.trim().toLowerCase() === 'salario';
            })
            .reduce((s, t) => s + (t.amount || 0), 0);
    },

    getSalaryPayments(userId, prefix) {
        return Transactions.list
            .filter(tx => tx.userId === userId && tx.type === 'income' && typeof tx.date === 'string' && tx.date.startsWith(prefix))
            .filter(tx => {
                const cat = Categories.getById(tx.categoryId);
                return cat && cat.name && cat.name.trim().toLowerCase() === 'salario';
            })
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    },

    getMonthlyTarget(userId, prefix) {
        const total = this.getMonthIncome(userId, prefix);
        return Math.round(total * 0.30 * 100) / 100;
    },

    addMonths(dateStr, n) {
        const d = new Date((dateStr || Utils.todayStr()) + 'T12:00:00');
        const y = d.getFullYear();
        const m = d.getMonth() + n;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const r = new Date(y, m, Math.min(d.getDate(), lastDay));
        return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`;
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
        if (m.currency === 'USD') {
            return m.amountARS != null ? m.amountARS : Math.round((m.amount || 0) * (m.rate || 0) * 100) / 100;
        }
        return m.amount || 0;
    },

    monthPrefix() {
        const el = document.getElementById('inversiones-month');
        return el && el.value ? el.value : Utils.currentYearMonth();
    },

    getMonthAportes(prefix) {
        const p = prefix || this.monthPrefix();
        return this.aportes.filter(a => typeof a.date === 'string' && a.date.startsWith(p));
    },

    getObjetivoTotals(objetivoId, prefix) {
        let ars = 0;
        this.getMonthAportes(prefix).forEach(a => {
            if (a.objetivoId !== objetivoId) return;
            const sign = a.type === 'retiro' ? -1 : 1;
            ars += sign * this.arsValue(a);
        });
        return ars;
    },

    getTotalEquiv(prefix) {
        let total = 0;
        this.objetivos.forEach(o => {
            total += this.getObjetivoTotals(o.id, prefix);
        });
        return total;
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
        const prefixEl = document.getElementById('inversiones-month');
        const prefix = prefixEl && prefixEl.value ? prefixEl.value : Utils.currentYearMonth();
        const monthDate = new Date(prefix + '-15T12:00:00');
        const monthLabel = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        const totalPct = this.objetivos.reduce((s, o) => s + (o.pct || 0), 0);
        const hasAportes = this.getMonthAportes(prefix).length > 0;

        el.innerHTML = ['nadia', 'elias'].map(u => {
            const name = u === 'nadia' ? 'Nadia' : 'Elias';
            const color = u === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const income = this.getMonthIncome(u, prefix);
            const base = this.getMonthlyTarget(u, prefix);
            let cobrosHtml = '';
            if (u === 'elias' && hasAportes) {
                const payments = this.getSalaryPayments(u, prefix);
                if (payments.length > 0) {
                    cobrosHtml = `<div class="target-row" style="margin-top:2px"><span>30% de cada quincena</span><b></b></div>` +
                        payments.map(p => {
                            const pct = Math.round((p.amount || 0) * 0.30 * 100) / 100;
                            return `<div class="inv-cobro-row"><span>· ${Utils.formatDate(p.date)} · ${Utils.formatMoney(p.amount)}</span><b>${Utils.formatMoney(pct)}</b></div>`;
                        }).join('');
                }
            }
            const rows = this.objetivos.map(o => {
                const monto = Math.round(base * (o.pct || 0)) / 100;
                return `<div class="target-row">
                    <span style="color:${o.color}"><i class="fas ${o.icon}"></i> ${Utils.esc(o.name)}</span>
                    <b>${Utils.formatMoney(monto)} <span class="muted">(${o.pct || 0}%)</span></b>
                </div>`;
            }).join('');
            const invBlock = hasAportes
                ? `${cobrosHtml}
                    <div class="target-row"><span>A invertir (30%)</span><b>${Utils.formatMoney(base)}</b></div>
                    <div style="margin-top:8px">${rows}</div>`
                : `<div class="target-row"><span>Invertido en el mes</span><b>${Utils.formatMoney(0)}</b></div>`;
            return `
                <div class="ahorro-target" style="border-left-color:${color}">
                    <div class="target-header">
                        <span class="fw600" style="color:${color}">${name}</span>
                        <span class="muted">${Utils.esc(monthLabel)}</span>
                    </div>
                    <div class="target-row"><span>Salario cobrado</span><b>${Utils.formatMoney(income)}</b></div>
                    ${invBlock}
                </div>`;
        }).join('');

        if (hasAportes && totalPct !== 100) {
            el.innerHTML += `<p class="muted" style="margin-top:4px"><i class="fas fa-triangle-exclamation"></i> Los porcentajes suman ${totalPct}% (deberían sumar 100%). Tocá el lápiz en cada objetivo para ajustarlos.</p>`;
        }
    },

    renderObjetivos() {
        const el = document.getElementById('inv-objetivos');
        if (!el) return;
        const prefix = this.monthPrefix();
        const grandTotal = this.getTotalEquiv(prefix);

        el.innerHTML = this.objetivos.map(o => {
            const total = this.getObjetivoTotals(o.id, prefix);
            const realPct = grandTotal > 0 ? (total / grandTotal * 100) : 0;
            const idealPct = o.pct || 0;
            const plazoBadge = o.plazo ? `<span class="inst-badge">Plazo ${Utils.esc(o.plazo)}</span>` : '';
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
            return `
                <div class="ahorro-target inv-target" style="border-left-color:${o.color}">
                    <div class="target-header">
                        <span class="fw600" style="color:${o.color}"><i class="fas ${o.icon}"></i> ${Utils.esc(o.name)}</span>
                        <span class="inv-pct-edit muted" data-editobj="${o.id}" title="Editar objetivo">${idealPct}% ${plazoBadge} <i class="fas fa-pen"></i></span>
                    </div>
                    ${metodoHtml}
                    ${statusHtml}
                    <div class="target-row"><span>Total aportado</span><b>${Utils.formatMoney(total)}</b></div>
                    <div class="target-row"><span>Peso real en la cartera</span><b>${realPct.toFixed(1)}% (ideal ${idealPct}%)</b></div>
                    <div class="progress-bar inv-bar">
                        <div class="progress-fill" style="width:${Math.min(100, realPct).toFixed(1)}%;background:${o.color}"></div>
                        <div class="inv-bar-marker" style="left:${Math.min(100, idealPct)}%"></div>
                    </div>
                    <div class="target-footer">
                        <button class="btn btn-sm btn-primary" data-aporte="${o.id}"><i class="fas fa-plus"></i> Aportar</button>
                        <button class="btn btn-sm btn-ghost" data-retiro="${o.id}"${retiroLocked ? ` disabled title="${Utils.esc(retiroTip)}"` : ''}><i class="fas fa-minus-circle"></i> Retirar</button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-aporte]').forEach(btn => btn.addEventListener('click', () => this.openMove(btn.dataset.aporte, 'aporte')));
        el.querySelectorAll('[data-retiro]').forEach(btn => btn.addEventListener('click', () => this.openMove(btn.dataset.retiro, 'retiro')));
        el.querySelectorAll('[data-editobj]').forEach(btn => btn.addEventListener('click', () => this.openEditObjetivo(btn.dataset.editobj)));
    },

    renderTotals() {
        const el = document.getElementById('inv-totals');
        if (!el) return;
        const prefix = this.monthPrefix();
        let ars = 0;
        this.objetivos.forEach(o => {
            ars += this.getObjetivoTotals(o.id, prefix);
        });
        el.innerHTML = `
            <div class="stat-card"><div class="label">Total invertido en el mes</div><div class="value">${Utils.formatMoney(ars)}</div></div>
            <div class="stat-card"><div class="label">Moneda</div><div class="value" style="color:var(--success)">Pesos (ARS)</div></div>`;
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
        sel.innerHTML = this.objetivos.map(o => `<option value="${o.id}">${Utils.esc(o.name)}</option>`).join('');
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
        this.updatePreview();
    },

    updatePreview() {
        const el = document.getElementById('inv-preview');
        if (el) el.textContent = '';
    },

    resetForm() {
        const form = document.getElementById('inv-form');
        if (form) form.reset();
        document.getElementById('inv-id').value = '';
        document.getElementById('inv-form-title').textContent = 'Registrar movimiento';
        this.setType('aporte');
        this.updateObjetivoSelect();
        document.getElementById('inv-date').value = Utils.todayStr();
        this.updatePreview();
    },

    openMove(objetivoId, type) {
        this.resetForm();
        this.setType(type);
        document.getElementById('inv-objetivo').value = objetivoId;
        document.getElementById('inv-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    async editMove(m) {
        document.getElementById('inv-id').value = m.id;
        document.getElementById('inv-form-title').textContent = 'Editar movimiento';
        this.setType(m.type || 'aporte');
        this.updateObjetivoSelect();
        document.getElementById('inv-objetivo').value = m.objetivoId;
        document.getElementById('inv-user').value = m.userId || 'nadia';
        document.getElementById('inv-amount').value = m.currency === 'USD' ? this.arsValue(m) : m.amount;
        document.getElementById('inv-date').value = m.date;
        document.getElementById('inv-description').value = m.description || '';

        this.updatePreview();
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
            const amountARS = Math.round(amount * 100) / 100;
            const data = { userId, objetivoId, type, currency: 'ARS', amount, amountARS, date, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

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
            description: `Inversión: ${(obj && obj.name) || 'objetivo'}`,
            date: data.date,
            paymentMethod: 'debito',
            paid: true,
            installments: 1,
            inversionAporteId: aporteId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async _deleteLinked(linked) {
        if (!linked) return;
        try {
            await db.collection(linked.col).doc(linked.id).delete();
        } catch (e) {
            console.error('Error deleting linked discount:', e);
        }
    },

    async syncDiscount(aporteId, obj, data) {
        const linked = await this._findLinked(aporteId);
        const catId = await this.getInversionExpenseCategoryId();
        const desc = `Inversión: ${(obj && obj.name) || 'objetivo'}`;
        if (linked) {
            await db.collection('transactions').doc(linked.id).update({
                userId: data.userId, amount: data.amountARS, categoryId: catId,
                date: data.date, paid: true, description: desc
            });
        } else {
            await this._addDiscountAsTransaction(aporteId, obj, data, catId);
        }
        if (typeof Transactions !== 'undefined' && Transactions.load) await Transactions.load();
        if (App.currentPage === 'home') Dashboard.refresh();
    },

    async getInversionExpenseCategoryId() {
        const existing = (typeof Categories !== 'undefined' ? Categories.list : [])
            .find(c => c.type === 'expense' && c.name && c.name.trim().toLowerCase() === 'inversiones');
        if (existing) return existing.id;
        try {
            const ref = await db.collection('categories').add({
                name: 'Inversiones', icon: 'fa-chart-line', color: '#16A085', type: 'expense'
            });
            if (typeof Categories !== 'undefined' && Categories.load) await Categories.load();
            if (typeof Categories !== 'undefined' && Categories.updateFilterSelect) Categories.updateFilterSelect();
            return ref.id;
        } catch (e) {
            console.error('Error creating inversion category:', e);
            return 'cat_otros_g';
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

    openEditObjetivo(objetivoId) {
        const o = this.objetivos.find(x => x.id === objetivoId);
        if (!o) return;
        document.getElementById('inv-obj-id').value = o.id;
        document.getElementById('inv-obj-title').textContent = `Editar: ${o.name}`;
        const metSel = document.getElementById('io-metodo');
        metSel.innerHTML = this.INSTRUMENTOS.map(i => `<option value="${i.id}">${i.label}</option>`).join('');
        metSel.value = o.metodo || 'otro';
        document.getElementById('io-pct').value = o.pct != null ? o.pct : '';
        document.getElementById('io-plazo').value = o.plazo || '';
        document.getElementById('io-detalle').value = o.metodoDetalle || '';
        document.getElementById('io-lock').value = o.lockMeses || 0;
        document.getElementById('io-freq').value = o.freqRetiroMeses || 0;
        const base = this.firstAporteDate(o.id);
        document.getElementById('io-base').textContent = base
            ? (lockBaseInfo(base, o.lockMeses || 0, this))
            : 'Sin aportes todavía: el plazo empieza a contar con tu primer aporte.';
        document.getElementById('inv-obj-modal').classList.remove('hidden');
    },

    closeObjModal() {
        document.getElementById('inv-obj-modal').classList.add('hidden');
    },

    async saveObjetivo() {
        const id = document.getElementById('inv-obj-id').value;
        const o = this.objetivos.find(x => x.id === id);
        if (!o) return;
        const pct = parseFloat(document.getElementById('io-pct').value);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            App.toast('Porcentaje inválido (0 a 100)', 'error');
            return;
        }
        const patch = {
            pct,
            plazo: document.getElementById('io-plazo').value.trim() || null,
            metodo: document.getElementById('io-metodo').value,
            metodoDetalle: document.getElementById('io-detalle').value.trim(),
            monedaSugerida: 'ARS',
            lockMeses: Math.max(0, parseInt(document.getElementById('io-lock').value, 10) || 0),
            freqRetiroMeses: Math.max(0, parseInt(document.getElementById('io-freq').value, 10) || 0)
        };
        try {
            await db.collection('inversion_objetivos').doc(id).update(patch);
            Object.assign(o, patch);
            const total = this.objetivos.reduce((s, x) => s + (x.pct || 0), 0);
            if (total !== 100) App.toast(`Guardado. Ojo: los porcentajes suman ${total}%`, 'info');
            else App.toast('Objetivo actualizado', 'success');
            this.closeObjModal();
            this.render();
        } catch (e) {
            App.toast('Error al actualizar', 'error');
        }
    }
};

function lockBaseInfo(firstDate, lockMeses, ctx) {
    const unlock = ctx.addMonths(firstDate, lockMeses);
    return `Primer aporte: ${Utils.formatDate(firstDate)}. ${lockMeses > 0 ? `Disponible desde ${Utils.formatDate(unlock)}.` : 'Sin bloqueo.'}`;
}
