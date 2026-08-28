const Ahorro = {
    list: [],
    dolar: { blue: null, oficial: null, source: 'error' },
    _bound: false,
    RATE_KEY: 'app_dolar_cache',
    RATE_TTL: 60 * 60 * 1000,

    async init() {
        if (!this._bound) { this.bindEvents(); this._bound = true; }
        const m = document.getElementById('ahorro-month');
        if (m && !m.value) m.value = Utils.currentYearMonth();
        document.getElementById('ahorro-date').value = Utils.todayStr();
        await this.load();
        await this.fetchDolar();
        this.resetForm();
        this.render();
    },

    async refresh() {
        await this.fetchDolar();
        this.render();
    },

    bindEvents() {
        document.getElementById('ahorro-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
        document.getElementById('ahorro-cancel').addEventListener('click', () => this.resetForm());
        document.getElementById('ahorro-month')?.addEventListener('change', () => this.render());

        document.querySelectorAll('.mov-type-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setType(btn.dataset.ahorroType));
        });

        document.getElementById('ahorro-currency')?.addEventListener('change', () => this.updatePreview());
        document.getElementById('ahorro-amount')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('ahorro-rate')?.addEventListener('input', () => this.updatePreview());
    },

    async load() {
        try {
            const snap = await db.collection('ahorros').orderBy('date', 'desc').limit(1000).get();
            this.list = [];
            snap.forEach(doc => this.list.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading ahorros:', e);
            this.list = [];
        }
    },

    async fetchDolar() {
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem(this.RATE_KEY)) || null; } catch (e) { cached = null; }

        if (cached && cached.blue && cached.fetchedAt && (Date.now() - cached.fetchedAt) < this.RATE_TTL) {
            this.dolar = { blue: cached.blue, oficial: cached.oficial || null, source: 'cache' };
            return;
        }

        try {
            const res = await fetch('https://dolarapi.com/v1/dolares');
            const data = await res.json();
            const blue = data.find(d => d.casa === 'blue');
            const oficial = data.find(d => d.casa === 'oficial');
            if (blue) {
                this.dolar = {
                    blue: { compra: blue.compra, venta: blue.venta, fecha: blue.fechaActualizacion },
                    oficial: oficial ? { compra: oficial.compra, venta: oficial.venta, fecha: oficial.fechaActualizacion } : null,
                    source: 'api'
                };
                localStorage.setItem(this.RATE_KEY, JSON.stringify({
                    blue: this.dolar.blue,
                    oficial: this.dolar.oficial,
                    fetchedAt: Date.now()
                }));
            }
        } catch (e) {
            console.error('Error fetching dolar:', e);
            if (cached && cached.blue) {
                this.dolar = { blue: cached.blue, oficial: cached.oficial || null, source: 'cache' };
            } else {
                this.dolar = { blue: null, oficial: null, source: 'error' };
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

    getMonthSaved(userId, prefix) {
        return this.list
            .filter(m => m.userId === userId && typeof m.date === 'string' && m.date.startsWith(prefix))
            .reduce((s, m) => s + (m.type === 'cambio' ? 0 : (m.type === 'deposito' ? 1 : -1)) * (m.amountARS || 0), 0);
    },

    getMonthSavedAll(prefix) {
        return this.list
            .filter(m => typeof m.date === 'string' && m.date.startsWith(prefix))
            .reduce((s, m) => s + (m.type === 'cambio' ? 0 : (m.type === 'deposito' ? 1 : -1)) * (m.amountARS || 0), 0);
    },

    getTotals() {
        let ars = 0, usd = 0;
        this.list.forEach(m => {
            if (m.type === 'cambio') {
                ars -= (m.amountARS || 0);
                usd += (m.amount || 0);
                return;
            }
            const sign = m.type === 'deposito' ? 1 : -1;
            if (m.currency === 'USD') usd += sign * (m.amount || 0);
            else ars += sign * (m.amount || 0);
        });
        return { ars, usd };
    },

    fmtUSD(n) {
        return `U$S ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    render() {
        this.renderDolar();
        this.renderTargets();
        this.renderTotals();
        this.renderHistory();
    },

    renderDolar() {
        const el = document.getElementById('dolar-rates');
        const meta = document.getElementById('dolar-meta');
        if (!el) return;
        const b = this.dolar.blue;
        const o = this.dolar.oficial;

        if (!b) {
            el.innerHTML = '<p class="muted">No se pudo obtener la cotización. Verificá tu conexión.</p>';
            if (meta) meta.textContent = '';
            return;
        }

        el.innerHTML = `
            <div class="dolar-rate">
                <div class="dolar-name"><i class="fas fa-money-bill-wave" style="color:var(--elias)"></i> Dólar Blue</div>
                <div class="dolar-values">
                    <span>Compra <b>${Utils.formatMoney(b.compra)}</b></span>
                    <span>Venta <b>${Utils.formatMoney(b.venta)}</b></span>
                </div>
            </div>
            ${o ? `<div class="dolar-rate">
                <div class="dolar-name"><i class="fas fa-landmark" style="color:var(--primary)"></i> Dólar Oficial</div>
                <div class="dolar-values">
                    <span>Compra <b>${Utils.formatMoney(o.compra)}</b></span>
                    <span>Venta <b>${Utils.formatMoney(o.venta)}</b></span>
                </div>
            </div>` : ''}`;

        if (meta && b.fecha) {
            const d = new Date(b.fecha);
            meta.textContent = `Cotización actualizada el ${d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
        }
    },

    renderTargets() {
        const el = document.getElementById('ahorro-targets');
        if (!el) return;
        const prefix = document.getElementById('ahorro-month').value || Utils.currentYearMonth();
        const monthDate = new Date(prefix + '-15T12:00:00');
        const monthLabel = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        el.innerHTML = ['nadia', 'elias'].map(u => {
            const name = u === 'nadia' ? 'Nadia' : 'Elias';
            const color = u === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const income = this.getMonthIncome(u, prefix);
            const target = this.getMonthlyTarget(u, prefix);
            const saved = this.getMonthSaved(u, prefix);
            const available = income - saved;
            const pct = target > 0 ? Math.max(0, Math.min(100, saved / target * 100)) : 0;

            return `
                <div class="ahorro-target" style="border-left-color:${color}">
                    <div class="target-header">
                        <span class="fw600" style="color:${color}">${name}</span>
                        <span class="muted">${Utils.esc(monthLabel)}</span>
                    </div>
                    <div class="target-row"><span>Salario cobrado</span><b>${Utils.formatMoney(income)}</b></div>
                    <div class="target-row"><span>30% a ahorrar</span><b style="color:${color}">${Utils.formatMoney(target)}</b></div>
                    <div class="target-row"><span>Ahorrado este mes</span><b style="color:var(--success)">${Utils.formatMoney(saved)}</b></div>
                    <div class="target-row"><span>Disponible después de ahorrar</span><b>${Utils.formatMoney(available)}</b></div>
                    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
                    <div class="target-footer">
                        <button class="btn btn-sm btn-primary" data-save30="${u}"><i class="fas fa-piggy-bank"></i> Guardar 30%</button>
                        <button class="btn btn-sm btn-ghost" data-retirar="${u}"><i class="fas fa-minus-circle"></i> Retirar</button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-save30]').forEach(btn => {
            btn.addEventListener('click', () => this.openDeposit(btn.dataset.save30, prefix));
        });
        el.querySelectorAll('[data-retirar]').forEach(btn => {
            btn.addEventListener('click', () => this.openWithdraw(btn.dataset.retirar));
        });
    },

    renderTotals() {
        const el = document.getElementById('ahorro-totals');
        if (!el) return;
        const { ars, usd } = this.getTotals();
        const blue = this.dolar.blue ? this.dolar.blue.venta : null;

        let equiv = '<span class="muted" style="font-size:0.72rem">Sin cotización disponible</span>';
        if (blue && blue > 0) {
            equiv = `<div>En pesos: ${Utils.formatMoney(ars + usd * blue)}</div>
                <div style="color:var(--success)">En dólares: ${this.fmtUSD(usd + ars / blue)}</div>`;
        }

        el.innerHTML = `
            <div class="stat-card"><div class="label">Total en pesos</div><div class="value">${Utils.formatMoney(ars)}</div></div>
            <div class="stat-card"><div class="label">Total en dólares</div><div class="value" style="color:var(--success)">${this.fmtUSD(usd)}</div></div>
            <div class="stat-card"><div class="label">Equivalente al Blue de hoy</div><div class="value" style="font-size:0.9rem;line-height:1.6">${equiv}</div></div>`;
    },

    renderHistory() {
        const el = document.getElementById('ahorro-history');
        if (!el) return;
        if (this.list.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-piggy-bank"></i><p>Sin movimientos de ahorro</p></div>';
            return;
        }

        const sorted = [...this.list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        el.innerHTML = sorted.map(m => {
            const isCambio = m.type === 'cambio';
            const isDep = m.type === 'deposito';
            const user = m.userId === 'nadia' ? 'Nadia' : 'Elias';
            const ucolor = m.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const color = isCambio ? 'var(--primary)' : (isDep ? 'var(--success)' : 'var(--error)');
            const icon = isCambio ? 'fa-exchange-alt' : (isDep ? 'fa-arrow-up' : 'fa-arrow-down');
            const label = m.description || (isCambio ? 'Cambio de pesos' : (isDep ? 'Depósito' : 'Retiro'));
            const amount = m.currency === 'USD' ? this.fmtUSD(m.amount) : Utils.formatMoney(m.amount);
            const rateBadge = m.rate ? `<span class="inst-badge">@ ${Utils.formatMoney(m.rate)}</span>` : '';
            const signStr = (isDep || isCambio) ? '+' : '-';

            return `
                <div class="tx-item">
                    <div class="tx-icon" style="background:${color}"><i class="fas ${icon}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${Utils.esc(label)} ${rateBadge}</div>
                        <div class="tx-meta"><span class="user-dot" style="background:${ucolor}"></span> ${user} · ${Utils.formatDate(m.date)} · ${m.currency}</div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-value" style="color:${color}">${signStr}${amount}</div>
                    </div>
                    <div class="tx-actions">
                        <button class="icon-btn" data-edit="${m.id}"><i class="fas fa-pen"></i></button>
                        <button class="icon-btn danger" data-del="${m.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = this.list.find(x => x.id === btn.dataset.edit);
                if (m) this.editMove(m);
            });
        });
        el.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMove(btn.dataset.del));
        });
    },

    async save() {
        const id = document.getElementById('ahorro-id').value;
        const type = document.querySelector('.mov-type-btn.active')?.dataset.ahorroType || 'deposito';
        const currency = document.getElementById('ahorro-currency').value;
        const userId = document.getElementById('ahorro-user').value;
        const amount = parseFloat(document.getElementById('ahorro-amount').value);
        const date = document.getElementById('ahorro-date').value;
        const description = document.getElementById('ahorro-description').value.trim();

        if (!amount || !date) {
            App.toast('Completá los campos', 'error');
            return;
        }

        let data;
        if (type === 'cambio') {
            const rate = parseFloat(document.getElementById('ahorro-rate').value) || (this.dolar.blue ? this.dolar.blue.venta : 0);
            if (amount <= 0 || !rate || rate <= 0) {
                App.toast('Indicá los pesos a cambiar y el tipo de cambio', 'error');
                return;
            }
            const ars = Math.round(amount * 100) / 100;
            const usd = Math.round(ars / rate * 100) / 100;
            data = { userId, type, currency: 'USD', amount: usd, amountARS: ars, rate, date, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        } else {
            const rate = currency === 'USD'
                ? (parseFloat(document.getElementById('ahorro-rate').value) || (this.dolar.blue ? this.dolar.blue.venta : 0))
                : null;
            if (currency === 'USD' && (!rate || rate <= 0)) {
                App.toast('Indicá el tipo de cambio del dólar', 'error');
                return;
            }
            const amountARS = currency === 'USD' ? Math.round(amount * rate * 100) / 100 : Math.round(amount * 100) / 100;
            data = { userId, type, currency, amount, amountARS, rate, date, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        }

        const submitBtn = document.querySelector('#ahorro-form button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (id) {
                await db.collection('ahorros').doc(id).update(data);
            } else {
                await db.collection('ahorros').add(data);
            }
            App.toast('Guardado', 'success');
            this.resetForm();
            await this.load();
            this.render();
            if (App.currentPage === 'home') Dashboard.refresh();
        } catch (e) {
            App.toast('Error al guardar', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async deleteMove(id) {
        if (!confirm('¿Eliminar movimiento?')) return;
        try {
            await db.collection('ahorros').doc(id).delete();
            App.toast('Eliminado', 'success');
            await this.load();
            this.render();
            if (App.currentPage === 'home') Dashboard.refresh();
        } catch (e) {
            App.toast('Error al eliminar', 'error');
        }
    },

    editMove(m) {
        document.getElementById('ahorro-id').value = m.id;
        document.getElementById('ahorro-form-title').textContent = 'Editar movimiento';
        this.setType(m.type || 'deposito');
        document.getElementById('ahorro-currency').value = m.type === 'cambio' ? 'ARS' : (m.currency || 'ARS');
        document.getElementById('ahorro-user').value = m.userId || 'nadia';
        document.getElementById('ahorro-amount').value = m.type === 'cambio' ? (m.amountARS || m.amount || '') : m.amount;
        document.getElementById('ahorro-rate').value = m.rate || (this.dolar.blue ? this.dolar.blue.venta : '');
        document.getElementById('ahorro-date').value = m.date;
        document.getElementById('ahorro-description').value = m.description || '';
        this.updatePreview();
        document.getElementById('ahorro-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    resetForm() {
        const form = document.getElementById('ahorro-form');
        if (form) form.reset();
        document.getElementById('ahorro-id').value = '';
        document.getElementById('ahorro-form-title').textContent = 'Registrar movimiento';
        this.setType('deposito');
        document.getElementById('ahorro-currency').value = 'ARS';
        document.getElementById('ahorro-date').value = Utils.todayStr();
        document.getElementById('ahorro-rate').value = this.dolar.blue ? this.dolar.blue.venta : '';
        this.updatePreview();
    },

    setType(type) {
        document.querySelectorAll('.mov-type-btn').forEach(b => b.classList.toggle('active', b.dataset.ahorroType === type));
        const currencyGroup = document.getElementById('ahorro-currency-group');
        const amountLabel = document.getElementById('ahorro-amount-label');
        if (currencyGroup) currencyGroup.classList.toggle('hidden', type === 'cambio');
        if (amountLabel) amountLabel.textContent = type === 'cambio' ? 'Pesos a cambiar (ARS)' : 'Monto';
        if (type === 'cambio') document.getElementById('ahorro-currency').value = 'ARS';
        this.updatePreview();
    },

    updatePreview() {
        const el = document.getElementById('ahorro-preview');
        const rateGroup = document.getElementById('ahorro-rate-group');
        const type = document.querySelector('.mov-type-btn.active')?.dataset.ahorroType || 'deposito';
        const currency = document.getElementById('ahorro-currency').value;
        if (rateGroup) rateGroup.classList.toggle('hidden', currency !== 'USD' && type !== 'cambio');

        const amount = parseFloat(document.getElementById('ahorro-amount').value) || 0;
        const rate = parseFloat(document.getElementById('ahorro-rate').value) || (this.dolar.blue ? this.dolar.blue.venta : 0);
        if (type === 'cambio') {
            el.textContent = (amount > 0 && rate > 0)
                ? `≈ ${this.fmtUSD(Math.round(amount / rate * 100) / 100)}`
                : '';
        } else if (currency === 'USD' && amount > 0 && rate > 0) {
            el.textContent = `≈ ${Utils.formatMoney(Math.round(amount * rate * 100) / 100)} en pesos`;
        } else {
            el.textContent = '';
        }
    },

    openDeposit(userId, prefix) {
        const income = this.getMonthIncome(userId, prefix);
        const name = userId === 'nadia' ? 'Nadia' : 'Elias';
        if (income <= 0) {
            App.toast(`No hay ingresos registrados para ${name} este mes`, 'error');
            return;
        }
        const target = this.getMonthlyTarget(userId, prefix);
        this.resetForm();
        this.setType('deposito');
        document.getElementById('ahorro-user').value = userId;
        document.getElementById('ahorro-amount').value = target;
        const monthDate = new Date(prefix + '-15T12:00:00');
        const monthLabel = monthDate.toLocaleDateString('es-AR', { month: 'long' });
        document.getElementById('ahorro-description').value = `Ahorro 30% ${monthLabel}`;
        this.updatePreview();
        document.getElementById('ahorro-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    openWithdraw(userId) {
        this.resetForm();
        this.setType('retiro');
        document.getElementById('ahorro-user').value = userId;
        this.updatePreview();
        document.getElementById('ahorro-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};
