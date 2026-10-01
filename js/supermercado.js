const Supermercado = {
    movimientos: [],
    tipoForm: 'deposito',
    _bound: false,

    COLLECTION: 'super_movimientos',
    CAT_ID: 'cat_super',
    TRANSFER_DESC: 'Aporte al supermercado',

    USERS: [
        { id: 'nadia', name: 'Nadia', color: 'var(--nadia)' },
        { id: 'elias', name: 'Elias', color: 'var(--elias)' }
    ],

    async init() {
        if (!this._bound) { this.bindEvents(); this._bound = true; }
        this.resetForm();
        await this.load();
        this.render();
    },

    async refresh() {
        await this.load();
        this.render();
    },

    bindEvents() {
        document.getElementById('super-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
        document.getElementById('super-cancel')?.addEventListener('click', () => this.resetForm());
        document.getElementById('super-period')?.addEventListener('change', () => this.render());

        document.querySelectorAll('#super-kind-toggle .seg-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                this.tipoForm = btn.dataset.tipo;
                document.querySelectorAll('#super-kind-toggle .seg-opt').forEach(b => b.classList.toggle('active', b === btn));
                this.paintTipo();
            });
        });
    },

    load() {
        return db.collection(this.COLLECTION).orderBy('date', 'desc').limit(1000).get()
            .then(snap => {
                this.movimientos = [];
                snap.forEach(doc => this.movimientos.push({ id: doc.id, ...doc.data() }));
            })
            .catch(e => {
                console.error('Error cargando supermercado:', e);
                this.movimientos = [];
            });
    },

    /* ── Cálculos ── */

    getSaldo() {
        return this.movimientos.reduce(
            (s, m) => s + (m.tipo === 'deposito' ? (m.monto || 0) : -(m.monto || 0)),
            0
        );
    },

    /** Movimientos del período elegido, del más nuevo al más viejo. */
    getPeriodo() {
        const raw = document.getElementById('super-period')?.value || '';
        const mes = raw.length >= 7 ? raw.slice(0, 7) : '';
        if (!mes) return this.movimientos.slice();
        return this.movimientos.filter(m => typeof m.date === 'string' && m.date.startsWith(mes));
    },

    getTotales(movs) {
        const ingresos = movs.filter(m => m.tipo === 'deposito').reduce((s, m) => s + (m.monto || 0), 0);
        const gastos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + (m.monto || 0), 0);
        return { ingresos, gastos };
    },

    getPorUsuario(movs) {
        return this.USERS.map(u => {
            const propios = movs.filter(m => m.userId === u.id);
            const ingresos = propios.filter(m => m.tipo === 'deposito').reduce((s, m) => s + (m.monto || 0), 0);
            const gastos = propios.filter(m => m.tipo === 'gasto').reduce((s, m) => s + (m.monto || 0), 0);
            return { ...u, ingresos, gastos, balance: ingresos - gastos };
        });
    },

    /**
     * Saldo acumulado justo antes de un movimiento, para pintar la columna
     * "Saldo" del historial (restar el propio movimiento al saldo final).
     */
    getSaldoHasta(mov) {
        return this.getSaldo() - (mov.tipo === 'deposito' ? (mov.monto || 0) : -(mov.monto || 0));
    },

    /* ── Formulario ── */

    paintTipo() {
        const esGasto = this.tipoForm === 'gasto';
        document.getElementById('super-gasto-fields')?.classList.toggle('hidden', !esGasto);
        const btn = document.querySelector('#super-form button[type="submit"]');
        if (btn) btn.innerHTML = esGasto
            ? '<i class="fas fa-cart-shopping"></i> Anotar gasto'
            : '<i class="fas fa-plus"></i> Depositar';
        const title = document.getElementById('super-form-title');
        if (title) title.textContent = esGasto ? 'Anotar gasto del súper' : 'Depositar en el súper';
    },

    paintSubSelect() {
        const sel = document.getElementById('super-subcategory');
        if (!sel) return;
        const cat = Categories.getById(this.CAT_ID);
        const subs = (cat && cat.subcategories) || [];
        sel.innerHTML = '<option value="">— Sin subcategoría —</option>' +
            subs.map(s => `<option value="${s.id}">${Utils.esc(s.name)}</option>`).join('');
    },

    resetForm() {
        const form = document.getElementById('super-form');
        if (form) form.reset();
        const d = document.getElementById('super-date');
        if (d) d.value = Utils.todayStr();
        this.paintSubSelect();
        this.paintTipo();
    },

    /* ── Alta / baja ── */

    async save() {
        const monto = parseFloat(document.getElementById('super-amount').value);
        const date = document.getElementById('super-date').value;
        const descripcion = (document.getElementById('super-description').value || '').trim();
        const submitBtn = document.querySelector('#super-form button[type="submit"]');
        const esGasto = this.tipoForm === 'gasto';

        if (!monto || monto <= 0 || !date) {
            App.toast('Completá el monto y la fecha', 'error');
            return;
        }
        if (esGasto) {
            if (monto > this.getSaldo()) {
                App.toast(`No hay saldo suficiente en el súper (${Utils.formatMoney(this.getSaldo())})`, 'error');
                return;
            }
        } else {
            const prefijo = date.slice(0, 7);
            const sueldo = Inversiones.getMonthIncome(Auth.currentUser, prefijo);
            if (sueldo > 0 && monto > sueldo) {
                const mesLabel = Utils.formatMonth(Number(prefijo.slice(0, 4)), Number(prefijo.slice(5, 7)));
                const ok = confirm(`Tu salario de ${mesLabel} es de ${Utils.formatMoney(sueldo)} y querés depositar ${Utils.formatMoney(monto)}. ¿Seguir igual?`);
                if (!ok) return;
            }
        }

        if (submitBtn && submitBtn.disabled) return;
        if (submitBtn) submitBtn.disabled = true;

        try {
            const data = {
                tipo: esGasto ? 'gasto' : 'deposito',
                monto,
                userId: Auth.currentUser,
                date,
                descripcion,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (esGasto) {
                data.categoryId = this.CAT_ID;
                data.subcategoryId = document.getElementById('super-subcategory')?.value || '';
            }

            const movRef = db.collection(this.COLLECTION).doc();
            const batch = db.batch();
            batch.set(movRef, data);

            // El depósito sale de la cuenta general: se anota como egreso para que
            // el balance lo descuente. Los gastos del súper NO se anotan acá, así
            // que ninguna plata se descuenta dos veces.
            if (!esGasto) {
                const txRef = db.collection('transactions').doc();
                batch.set(txRef, {
                    type: 'expense',
                    amount: monto,
                    categoryId: this.CAT_ID,
                    subcategoryId: '',
                    description: this.TRANSFER_DESC,
                    date,
                    paymentMethod: 'debito',
                    paid: true,
                    userId: Auth.currentUser,
                    origen: 'super',
                    superMovId: movRef.id,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            await batch.commit();

            if (!esGasto) await Transactions.load();
            await this.load();

            App.toast(esGasto ? 'Gasto anotado' : 'Depósito registrado', 'success');

            const yo = Auth.currentUser === 'nadia' ? 'Nadia' : 'Elias';
            const otro = Auth.currentUser === 'nadia' ? 'elias' : 'nadia';
            const titulo = esGasto ? 'Gasto en el súper' : 'Aporte al súper';
            const detalle = esGasto
                ? `${yo} gastó ${Utils.formatMoney(monto)}${descripcion ? ` en ${descripcion}` : ''} · Saldo ${Utils.formatMoney(this.getSaldo())}`
                : `${yo} depositó ${Utils.formatMoney(monto)} · Saldo ${Utils.formatMoney(this.getSaldo())}`;
            Notifications.add('transaction', titulo, detalle, otro);

            this.resetForm();
            this.render();
            Dashboard.refresh();
        } catch (e) {
            console.error('Error guardando movimiento del súper:', e);
            App.toast('Error al guardar', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    /**
     * Borra un movimiento. `skipTx` se usa cuando el llamador ya borró el
     * asiento de `transactions` (borrar el aporte desde la lista de Gastos),
     * y `skipConfirm` cuando ya se pidió confirmación.
     */
    async deleteMovimiento(id, opts = {}) {
        const skipTx = opts.skipTx === true;
        const mov = this.movimientos.find(m => m.id === id);
        if (!mov) return;
        if (!opts.skipConfirm) {
            const texto = mov.tipo === 'deposito'
                ? `¿Eliminar el depósito de ${Utils.formatMoney(mov.monto)}? También se saca del balance general.`
                : `¿Eliminar el gasto de ${Utils.formatMoney(mov.monto)}?`;
            if (!confirm(texto)) return;
        }
        try {
            const batch = db.batch();
            batch.delete(db.collection(this.COLLECTION).doc(id));
            if (!skipTx && mov.tipo === 'deposito') {
                Transactions.list.filter(t => t.superMovId === id)
                    .forEach(t => batch.delete(db.collection('transactions').doc(t.id)));
            }
            await batch.commit();
            App.toast('Eliminado', 'success');
            await Transactions.load();
            await this.load();
            this.render();
            Dashboard.refresh();
        } catch (e) {
            App.toast('Error al eliminar', 'error');
        }
    },

    /* ── Render ── */

    render() {
        this.paintPeriodSelect();
        this.renderStats();
        this.renderPorUsuario();
        this.renderHistorial();
    },

    renderHomeWidget(monthPrefix) {
        const el = document.getElementById('super-home-widget');
        if (!el) return;
        const mes = monthPrefix || Utils.currentYearMonth();
        const movs = this.movimientos.filter(m => typeof m.date === 'string' && m.date.startsWith(mes));
        const { ingresos, gastos } = this.getTotales(movs);
        const saldo = this.getSaldo();
        const clase = saldo < 0 ? 'neg' : 'pos';
        el.innerHTML = `
            <div class="super-home">
                <div class="super-home-info">
                    <div class="super-home-label">Saldo disponible</div>
                    <div class="super-home-amount ${clase}">${Utils.formatMoney(saldo)}</div>
                    <div class="super-home-meta muted">Este mes: ${Utils.formatMoney(ingresos)} ingresados · ${Utils.formatMoney(gastos)} gastados</div>
                </div>
                <button class="btn btn-sm btn-primary" data-go-super><i class="fas fa-arrow-right"></i></button>
            </div>`;
        el.querySelector('[data-go-super]')?.addEventListener('click', () => App.navigate('supermercado'));
    },

    paintPeriodSelect() {
        const sel = document.getElementById('super-period');
        if (!sel) return;
        const previo = sel.value;
        const meses = [...new Set(this.movimientos
            .map(m => (typeof m.date === 'string' ? m.date.slice(0, 7) : ''))
            .filter(p => p.length === 7))]
            .sort((a, b) => b.localeCompare(a));
        sel.innerHTML = '<option value="">Todo el historial</option>' +
            meses.map(p => {
                const label = new Date(p + '-15T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                return `<option value="${p}">${Utils.esc(label)}</option>`;
            }).join('');
        sel.value = meses.includes(previo) ? previo : '';
    },

    renderStats() {
        const el = document.getElementById('super-stats');
        if (!el) return;
        const movs = this.getPeriodo();
        const { ingresos, gastos } = this.getTotales(movs);
        const saldo = this.getSaldo();
        const saldoClass = saldo < 0 ? 'neg' : 'pos';
        el.innerHTML = `
            <div class="stat-card super-saldo-card">
                <div class="label">Saldo en el súper</div>
                <div class="value super-amt ${saldoClass}">${Utils.formatMoney(saldo)}</div>
            </div>
            <div class="stat-card"><div class="label">Ingresado</div><div class="value" style="color:var(--success)">${Utils.formatMoney(ingresos)}</div></div>
            <div class="stat-card"><div class="label">Gastado</div><div class="value" style="color:var(--error)">${Utils.formatMoney(gastos)}</div></div>`;
    },

    renderPorUsuario() {
        const el = document.getElementById('super-users');
        if (!el) return;
        const movs = this.getPeriodo();
        const datos = this.getPorUsuario(movs);
        const totalIngresos = datos.reduce((s, u) => s + u.ingresos, 0) || 1;

        el.innerHTML = datos.map(u => {
            const pct = (u.ingresos / totalIngresos * 100).toFixed(1);
            const balanceClass = u.balance < 0 ? 'neg' : 'pos';
            return `
            <div class="user-bar-group">
                <div class="user-bar-header">
                    <span class="fw600" style="color:${u.color}">${u.name}</span>
                    <span class="fw700">${Utils.formatMoney(u.ingresos)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${u.color}"></div></div>
                <div class="super-user-meta">
                    <span class="muted">${pct}% de lo ingresado</span>
                    <span class="muted">Gastó ${Utils.formatMoney(u.gastos)} · <span class="super-amt ${balanceClass}">${Utils.formatMoney(u.balance)}</span></span>
                </div>
            </div>`;
        }).join('');
    },

    renderHistorial() {
        const el = document.getElementById('super-historial');
        if (!el) return;
        const movs = this.getPeriodo();
        if (movs.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-cart-shopping"></i><p>Sin movimientos</p></div>';
            return;
        }

        const groups = {};
        movs.forEach(m => {
            const k = m.date || 'sin-fecha';
            (groups[k] = groups[k] || []).push(m);
        });
        const hoy = Utils.todayStr();
        const ayer = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();

        el.innerHTML = Object.keys(groups).map(dateKey => {
            const items = groups[dateKey];
            const label = dateKey === hoy ? 'Hoy'
                : dateKey === ayer ? 'Ayer'
                : new Date(dateKey + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
            return `
            <div class="tx-day-group">
                <div class="tx-day-header"><span>${Utils.esc(label)}</span></div>
                ${items.map(m => this._row(m)).join('')}
            </div>`;
        }).join('');

        el.querySelectorAll('[data-del-mov]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMovimiento(btn.dataset.delMov);
            });
        });
    },

    _row(m) {
        const esGasto = m.tipo === 'gasto';
        const sub = esGasto ? Categories.getSubcategory(m.categoryId, m.subcategoryId) : null;
        const cat = esGasto ? Categories.getById(m.categoryId) : null;
        const user = this.USERS.find(u => u.id === m.userId);
        const nombre = user ? user.name : '';
        const signo = esGasto ? '-' : '+';
        const clase = esGasto ? 'expense' : 'income';
        const saldoResultante = this.getSaldoHasta(m) + (esGasto ? -m.monto : m.monto);
        const quien = `<span class="user-dot" style="background:${user ? user.color : '#888'}"></span>`;
        const color = esGasto ? (cat ? cat.color : '#E67E22') : 'var(--success)';
        const icono = esGasto ? (sub && sub.icon ? sub.icon : 'fa-cart-shopping') : 'fa-plus';
        const etiqueta = esGasto ? (sub ? sub.name : 'Compra en el súper') : 'Aporte al súper';

        return `
        <div class="tx-item">
            <div class="tx-icon" style="background:${color}"><i class="fas ${icono}"></i></div>
            <div class="tx-info">
                <div class="tx-desc">${Utils.esc(m.descripcion || etiqueta)}</div>
                <div class="tx-meta">${quien} ${nombre}${esGasto && sub ? ` · ${Utils.esc(sub.name)}` : ''}</div>
            </div>
            <div class="tx-right">
                <div class="tx-value ${clase}">${signo}${Utils.formatMoney(m.monto)}</div>
                <div class="tx-date">Saldo ${Utils.formatMoney(saldoResultante)}</div>
            </div>
            <div class="tx-actions">
                <button class="icon-btn danger" data-del-mov="${m.id}"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }
};
