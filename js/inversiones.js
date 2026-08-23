const Inversiones = {
    objetivos: [],
    aportes: [],
    _bound: false,

    DEFAULTS: [
        { id: 'inv_emergencia', name: 'Fondo de emergencia', icon: 'fa-umbrella', color: '#E74C3C', pct: 25, order: 1, plazo: null },
        { id: 'inv_hijo', name: 'Futuro de nuestro hijo', icon: 'fa-baby', color: '#FF6B9D', pct: 20, order: 2, plazo: null },
        { id: 'inv_jubilacion', name: 'Jubilación', icon: 'fa-umbrella-beach', color: '#2ECC71', pct: 15, order: 3, plazo: null },
        { id: 'inv_serrucho', name: 'Inversión serrucho (vacaciones)', icon: 'fa-plane', color: '#3498DB', pct: 15, order: 4, plazo: '1 año' },
        { id: 'inv_2anios', name: 'Inversión a 2 años', icon: 'fa-hourglass-half', color: '#9B59B6', pct: 10, order: 5, plazo: '2 años' },
        { id: 'inv_5anios', name: 'Inversión a 5 años', icon: 'fa-seedling', color: '#1ABC9C', pct: 10, order: 6, plazo: '5 años' },
        { id: 'inv_10anios', name: 'Inversión a 10 años', icon: 'fa-tree', color: '#27AE60', pct: 5, order: 7, plazo: '10 años' }
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

        document.querySelectorAll('.inv-type-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setType(btn.dataset.invType));
        });

        document.getElementById('inv-currency')?.addEventListener('change', () => this.updatePreview());
        document.getElementById('inv-amount')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('inv-rate')?.addEventListener('input', () => this.updatePreview());
    },

    async load() {
        try {
            const snap = await db.collection('inversion_objetivos').get();
            this.objetivos = [];
            snap.forEach(doc => this.objetivos.push({ id: doc.id, ...doc.data() }));
            if (this.objetivos.length === 0) {
                for (const obj of this.DEFAULTS) {
                    await db.collection('inversion_objetivos').doc(obj.id).set({
                        name: obj.name, icon: obj.icon, color: obj.color, pct: obj.pct, order: obj.order, plazo: obj.plazo
                    });
                }
                this.objetivos = [...this.DEFAULTS];
            }
            this.objetivos.sort((a, b) => (a.order || 99) - (b.order || 99));

            const snap2 = await db.collection('inversion_aportes').orderBy('date', 'desc').limit(1000).get();
            this.aportes = [];
            snap2.forEach(doc => this.aportes.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading inversiones:', e);
            if (this.objetivos.length === 0) this.objetivos = [...this.DEFAULTS];
            this.aportes = [];
        }
    },

    blueRate() {
        return (typeof Ahorro !== 'undefined' && Ahorro.dolar && Ahorro.dolar.blue) ? Ahorro.dolar.blue.venta : null;
    },

    getObjetivoTotals(objetivoId) {
        let ars = 0, usd = 0;
        this.aportes.forEach(a => {
            if (a.objetivoId !== objetivoId) return;
            const sign = a.type === 'retiro' ? -1 : 1;
            if (a.currency === 'USD') usd += sign * (a.amount || 0);
            else ars += sign * (a.amount || 0);
        });
        return { ars, usd };
    },

    getTotalEquiv() {
        const blue = this.blueRate();
        let total = 0;
        this.objetivos.forEach(o => {
            const t = this.getObjetivoTotals(o.id);
            total += t.ars + (blue ? t.usd * blue : 0);
        });
        return total;
    },

    fmtUSD(n) {
        return `U$S ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

        el.innerHTML = ['nadia', 'elias'].map(u => {
            const name = u === 'nadia' ? 'Nadia' : 'Elias';
            const color = u === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const income = Ahorro.getMonthIncome(u, prefix);
            const base = Math.round(income * 0.3 * 100) / 100;
            const rows = this.objetivos.map(o => {
                const monto = Math.round(base * (o.pct || 0)) / 100;
                return `<div class="target-row">
                    <span style="color:${o.color}"><i class="fas ${o.icon}"></i> ${Utils.esc(o.name)}</span>
                    <b>${Utils.formatMoney(monto)} <span class="muted">(${o.pct || 0}%)</span></b>
                </div>`;
            }).join('');
            return `
                <div class="ahorro-target" style="border-left-color:${color}">
                    <div class="target-header">
                        <span class="fw600" style="color:${color}">${name}</span>
                        <span class="muted">${Utils.esc(monthLabel)}</span>
                    </div>
                    <div class="target-row"><span>Salario cobrado</span><b>${Utils.formatMoney(income)}</b></div>
                    <div class="target-row"><span>30% a invertir</span><b>${Utils.formatMoney(base)}</b></div>
                    <div style="margin-top:8px">${rows}</div>
                </div>`;
        }).join('');

        if (totalPct !== 100) {
            el.innerHTML += `<p class="muted" style="margin-top:4px"><i class="fas fa-triangle-exclamation"></i> Los porcentajes suman ${totalPct}% (deberían sumar 100%). Tocá el lápiz en cada objetivo para ajustarlos.</p>`;
        }
    },

    renderObjetivos() {
        const el = document.getElementById('inv-objetivos');
        if (!el) return;
        const blue = this.blueRate();
        const grandTotal = this.getTotalEquiv();

        el.innerHTML = this.objetivos.map(o => {
            const t = this.getObjetivoTotals(o.id);
            const equiv = t.ars + (blue ? t.usd * blue : 0);
            const realPct = grandTotal > 0 ? (equiv / grandTotal * 100) : 0;
            const idealPct = o.pct || 0;
            const plazoBadge = o.plazo ? `<span class="inst-badge">Plazo ${Utils.esc(o.plazo)}</span>` : '';
            return `
                <div class="ahorro-target inv-target" style="border-left-color:${o.color}">
                    <div class="target-header">
                        <span class="fw600" style="color:${o.color}"><i class="fas ${o.icon}"></i> ${Utils.esc(o.name)}</span>
                        <span class="inv-pct-edit muted" data-editpct="${o.id}" title="Editar porcentaje">${idealPct}% ${plazoBadge} <i class="fas fa-pen"></i></span>
                    </div>
                    <div class="target-row"><span>Total aportado (ARS)</span><b>${Utils.formatMoney(t.ars)}</b></div>
                    <div class="target-row"><span>Total aportado (USD)</span><b style="color:var(--success)">${this.fmtUSD(t.usd)}</b></div>
                    <div class="target-row"><span>Peso real en la cartera</span><b>${realPct.toFixed(1)}% (ideal ${idealPct}%)</b></div>
                    <div class="progress-bar inv-bar">
                        <div class="progress-fill" style="width:${Math.min(100, realPct).toFixed(1)}%;background:${o.color}"></div>
                        <div class="inv-bar-marker" style="left:${Math.min(100, idealPct)}%"></div>
                    </div>
                    <div class="target-footer">
                        <button class="btn btn-sm btn-primary" data-aporte="${o.id}"><i class="fas fa-plus"></i> Aportar</button>
                        <button class="btn btn-sm btn-ghost" data-retiro="${o.id}"><i class="fas fa-minus-circle"></i> Retirar</button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-aporte]').forEach(btn => btn.addEventListener('click', () => this.openMove(btn.dataset.aporte, 'aporte')));
        el.querySelectorAll('[data-retiro]').forEach(btn => btn.addEventListener('click', () => this.openMove(btn.dataset.retiro, 'retiro')));
        el.querySelectorAll('[data-editpct]').forEach(btn => btn.addEventListener('click', () => this.editPct(btn.dataset.editpct)));
    },

    renderTotals() {
        const el = document.getElementById('inv-totals');
        if (!el) return;
        let ars = 0, usd = 0;
        this.objetivos.forEach(o => {
            const t = this.getObjetivoTotals(o.id);
            ars += t.ars;
            usd += t.usd;
        });
        const blue = this.blueRate();
        let equiv = '<span class="muted" style="font-size:0.72rem">Sin cotización disponible</span>';
        if (blue && blue > 0) {
            equiv = `<div>En pesos: ${Utils.formatMoney(ars + usd * blue)}</div>
                <div style="color:var(--success)">En dólares: ${this.fmtUSD(usd + ars / blue)}</div>`;
        }
        el.innerHTML = `
            <div class="stat-card"><div class="label">Total invertido en pesos</div><div class="value">${Utils.formatMoney(ars)}</div></div>
            <div class="stat-card"><div class="label">Total invertido en dólares</div><div class="value" style="color:var(--success)">${this.fmtUSD(usd)}</div></div>
            <div class="stat-card"><div class="label">Equivalente al Blue de hoy</div><div class="value" style="font-size:0.9rem;line-height:1.6">${equiv}</div></div>`;
    },

    renderHistory() {
        const el = document.getElementById('inv-history');
        if (!el) return;
        if (this.aportes.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-chart-line"></i><p>Sin movimientos de inversión</p></div>';
            return;
        }
        const sorted = [...this.aportes].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        el.innerHTML = sorted.map(m => {
            const o = this.objetivos.find(x => x.id === m.objetivoId);
            const isRetiro = m.type === 'retiro';
            const user = m.userId === 'nadia' ? 'Nadia' : 'Elias';
            const ucolor = m.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const color = isRetiro ? 'var(--error)' : 'var(--success)';
            const icon = isRetiro ? 'fa-arrow-down' : 'fa-arrow-up';
            const label = m.description || (o ? o.name : 'Inversión');
            const amount = m.currency === 'USD' ? this.fmtUSD(m.amount) : Utils.formatMoney(m.amount);
            const rateBadge = m.rate ? `<span class="inst-badge">@ ${Utils.formatMoney(m.rate)}</span>` : '';

            return `
                <div class="tx-item">
                    <div class="tx-icon" style="background:${o ? o.color : '#95A5A6'}"><i class="fas ${icon}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${Utils.esc(label)} ${rateBadge}${isRetiro ? '' : '<span class="pending-badge">Aporte</span>'}</div>
                        <div class="tx-meta"><span class="user-dot" style="background:${ucolor}"></span> ${user} · ${Utils.formatDate(m.date)} · ${m.currency || 'ARS'}</div>
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
        document.querySelectorAll('.inv-type-btn').forEach(b => b.classList.toggle('active', b.dataset.invType === type));
        const descontarGroup = document.getElementById('inv-descontar-group');
        const currencyGroup = document.getElementById('inv-currency-group');
        if (descontarGroup) descontarGroup.classList.toggle('hidden', type === 'retiro');
        if (currencyGroup) currencyGroup.classList.toggle('hidden', false);
        this.updatePreview();
    },

    updatePreview() {
        const el = document.getElementById('inv-preview');
        const rateGroup = document.getElementById('inv-rate-group');
        const type = document.querySelector('.inv-type-btn.active')?.dataset.invType || 'aporte';
        const currency = document.getElementById('inv-currency').value;
        if (rateGroup) rateGroup.classList.toggle('hidden', currency !== 'USD');

        const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
        const rate = parseFloat(document.getElementById('inv-rate').value) || this.blueRate() || 0;
        if (currency === 'USD' && amount > 0 && rate > 0) {
            el.textContent = `≈ ${Utils.formatMoney(Math.round(amount * rate * 100) / 100)} en pesos`;
        } else if (currency === 'ARS' && amount > 0 && rate > 0) {
            el.textContent = `≈ ${this.fmtUSD(Math.round(amount / rate * 100) / 100)}`;
        } else {
            el.textContent = '';
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
        document.getElementById('inv-rate').value = this.blueRate() || '';
        this.updatePreview();
    },

    openMove(objetivoId, type) {
        this.resetForm();
        this.setType(type);
        document.getElementById('inv-objetivo').value = objetivoId;
        document.getElementById('inv-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    editMove(m) {
        document.getElementById('inv-id').value = m.id;
        document.getElementById('inv-form-title').textContent = 'Editar movimiento';
        this.setType(m.type || 'aporte');
        this.updateObjetivoSelect();
        document.getElementById('inv-objetivo').value = m.objetivoId;
        document.getElementById('inv-user').value = m.userId || 'nadia';
        document.getElementById('inv-currency').value = m.currency || 'ARS';
        document.getElementById('inv-amount').value = m.amount;
        document.getElementById('inv-rate').value = m.rate || (this.blueRate() || '');
        document.getElementById('inv-date').value = m.date;
        document.getElementById('inv-description').value = m.description || '';
        this.updatePreview();
        document.getElementById('inv-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    async save() {
        const id = document.getElementById('inv-id').value;
        const type = document.querySelector('.inv-type-btn.active')?.dataset.invType || 'aporte';
        const objetivoId = document.getElementById('inv-objetivo').value;
        const userId = document.getElementById('inv-user').value;
        const currency = document.getElementById('inv-currency').value;
        const amount = parseFloat(document.getElementById('inv-amount').value);
        const date = document.getElementById('inv-date').value;
        const description = document.getElementById('inv-description').value.trim();
        const descontar = type === 'aporte' && document.getElementById('inv-descontar').checked;

        if (!amount || !objetivoId || !date) {
            App.toast('Completá los campos', 'error');
            return;
        }

        let rate = null;
        if (currency === 'USD') {
            rate = parseFloat(document.getElementById('inv-rate').value) || this.blueRate();
            if (!rate || rate <= 0) {
                App.toast('Indicá el tipo de cambio del dólar', 'error');
                return;
            }
        }

        const submitBtn = document.querySelector('#inv-form button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;
        if (submitBtn) submitBtn.disabled = true;

        try {
            const obj = this.objetivos.find(o => o.id === objetivoId);
            const amountARS = currency === 'USD' ? Math.round(amount * rate * 100) / 100 : Math.round(amount * 100) / 100;
            const data = { userId, objetivoId, type, currency, amount, amountARS, rate, date, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

            if (id) {
                await db.collection('inversion_aportes').doc(id).update(data);
            } else {
                await db.collection('inversion_aportes').add(data);
                if (descontar) {
                    await db.collection('ahorros').add({
                        userId,
                        type: 'retiro',
                        currency,
                        amount,
                        amountARS,
                        rate,
                        date,
                        description: `Inversión: ${(obj && obj.name) || 'objetivo'}`,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    if (typeof Ahorro !== 'undefined' && Ahorro.load) await Ahorro.load();
                    App.toast('Descontado de Ahorro Dólar', 'info');
                }
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

    async deleteMove(id) {
        if (!confirm('¿Eliminar movimiento?')) return;
        try {
            await db.collection('inversion_aportes').doc(id).delete();
            App.toast('Eliminado', 'success');
            await this.load();
            this.render();
        } catch (e) {
            App.toast('Error al eliminar', 'error');
        }
    },

    async editPct(objetivoId) {
        const o = this.objetivos.find(x => x.id === objetivoId);
        if (!o) return;
        const val = prompt(`Porcentaje mensual para "${o.name}" (los objetivos deberían sumar 100%):`, o.pct != null ? o.pct : '');
        if (val === null) return;
        const pct = parseFloat(val);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            App.toast('Porcentaje inválido (0 a 100)', 'error');
            return;
        }
        try {
            await db.collection('inversion_objetivos').doc(objetivoId).update({ pct });
            o.pct = pct;
            const total = this.objetivos.reduce((s, x) => s + (x.pct || 0), 0);
            if (total !== 100) App.toast(`Ojo: los porcentajes ahora suman ${total}%`, 'info');
            else App.toast('Porcentaje actualizado', 'success');
            this.render();
        } catch (e) {
            App.toast('Error al actualizar', 'error');
        }
    }
};
