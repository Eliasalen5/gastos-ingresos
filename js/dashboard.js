const Dashboard = {
    charts: {},
    chartMode: 'category',
    _bound: false,

    KIND_COLORS: { fixed: '#F1C40F', variable: '#6C63FF' },

    init() {
        if (this._bound) return;
        this._bound = true;
        const monthInput = document.getElementById('grupal-month');
        if (monthInput) {
            monthInput.value = Utils.currentYearMonth();
            monthInput.addEventListener('change', () => this.renderGrupal());
        }
        const indMonth = document.getElementById('individual-month');
        if (indMonth) {
            indMonth.value = Utils.currentYearMonth();
            indMonth.addEventListener('change', () => this.renderIndividual());
        }
        const modeToggle = document.getElementById('chart-mode-toggle');
        if (modeToggle) {
            modeToggle.querySelectorAll('.seg-opt').forEach(btn => {
                btn.addEventListener('click', () => {
                    modeToggle.querySelectorAll('.seg-opt').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.chartMode = btn.dataset.mode;
                    this._paintChartTitle();
                    this.renderCategoryChart(Auth.currentUser, this._individualMonth());
                });
            });
            this._paintChartTitle();
        }
        const catDetailModal = document.getElementById('cat-detail-modal');
        if (catDetailModal) {
            catDetailModal.querySelector('.modal-overlay')?.addEventListener('click', () => catDetailModal.classList.add('hidden'));
            catDetailModal.querySelector('.modal-close')?.addEventListener('click', () => catDetailModal.classList.add('hidden'));
        }
    },

    _paintChartTitle() {
        const el = document.getElementById('chart-title');
        if (!el) return;
        const titles = { category: 'Gastos por categoría', subcategory: 'Gastos por subcategoría', kind: 'Gastos fijos vs variables' };
        el.textContent = titles[this.chartMode] || titles.category;
    },

    refresh() {
        this.renderIndividual();
    },

    destroyChart(key) {
        if (this.charts[key]) { this.charts[key].destroy(); this.charts[key] = null; }
    },

    destroyCharts() {
        Object.keys(this.charts).forEach(k => this.destroyChart(k));
    },

    _individualMonth() {
        const el = document.getElementById('individual-month');
        return el ? el.value : Utils.currentYearMonth();
    },

    renderIndividual() {
        const userId = Auth.currentUser;
        const prefix = this._individualMonth();
        const txs = Transactions.list.filter(tx => tx.userId === userId && typeof tx.date === 'string' && tx.date.startsWith(prefix));
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense' && t.paid !== false).reduce((s, t) => s + t.amount, 0);

        document.getElementById('balance-amount').textContent = Utils.formatMoney(income - expense);
        document.getElementById('income-amount').textContent = Utils.formatMoney(income);
        document.getElementById('expense-amount').textContent = Utils.formatMoney(expense);

        this.renderFixedVariable(txs.filter(t => t.type === 'expense' && t.paid !== false));
        this.renderCategoryChart(userId, prefix);
        this.renderRecent(userId, prefix);
        this.renderPendingWidget();
        Notifications.renderWidget();
    },

    renderFixedVariable(paidExpenses) {
        const el = document.getElementById('fixed-variable-widget');
        if (!el) return;
        const total = paidExpenses.reduce((s, t) => s + (t.amount || 0), 0);
        if (total === 0) {
            el.innerHTML = '<p class="muted">Sin gastos en el mes</p>';
            return;
        }
        const buckets = { fixed: 0, variable: 0 };
        paidExpenses.forEach(tx => {
            const kind = Categories.resolveKind(tx.categoryId, tx.subcategoryId) || 'variable';
            buckets[kind] = (buckets[kind] || 0) + (tx.amount || 0);
        });
        const row = (kind, label) => {
            const pct = (buckets[kind] / total * 100).toFixed(1);
            return `
            <div class="kv-row">
                <div class="kv-header">
                    <span class="kv-label"><span class="kv-dot ${kind}"></span> ${label}</span>
                    <span class="fw700">${Utils.formatMoney(buckets[kind])} <span class="muted">(${pct}%)</span></span>
                </div>
                <div class="kv-bar"><div class="kv-fill ${kind}" style="width:${pct}%"></div></div>
            </div>`;
        };
        el.innerHTML = `
            <div class="kv-total">
                <span>Gasto total del mes</span>
                <strong>${Utils.formatMoney(total)}</strong>
            </div>
            ${row('fixed', 'Fijos')}
            ${row('variable', 'Variables')}`;
    },

    _groupBy(mode, txs) {
        const map = {};
        const put = (k, entry) => {
            map[k] = map[k] || { ...entry, key: k, total: 0 };
            map[k].total += entry.amount || 0;
        };
        txs.forEach(tx => {
            const cat = Categories.getById(tx.categoryId);
            if (mode === 'subcategory') {
                const sub = Categories.getSubcategory(tx.categoryId, tx.subcategoryId);
                const key = sub ? `sub_${sub.id}` : `none_${cat ? cat.id : 'otros'}`;
                put(key, {
                    id: cat ? cat.id : null,
                    subId: sub ? sub.id : '',
                    noSub: !sub,
                    name: sub ? sub.name : (cat ? `${cat.name} · sin sub` : 'Otros'),
                    color: sub ? (sub.color || cat.color) : (cat ? cat.color : '#95A5A6'),
                    amount: tx.amount
                });
            } else if (mode === 'kind') {
                const kind = Categories.resolveKind(tx.categoryId, tx.subcategoryId) || 'variable';
                put(kind, {
                    id: null,
                    kind,
                    name: kind === 'fixed' ? 'Fijos' : 'Variables',
                    color: this.KIND_COLORS[kind],
                    amount: tx.amount
                });
            } else {
                const key = cat ? cat.id : 'otros';
                put(key, {
                    id: cat ? cat.id : null,
                    subId: '',
                    name: cat ? cat.name : 'Otros',
                    color: cat ? cat.color : '#95A5A6',
                    amount: tx.amount
                });
            }
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    },

    _inBucket(tx, c) {
        if (c.kind) return (Categories.resolveKind(tx.categoryId, tx.subcategoryId) || 'variable') === c.kind;
        const matchesCat = c.id ? tx.categoryId === c.id : !Categories.getById(tx.categoryId);
        if (!matchesCat) return false;
        if (c.subId) return tx.subcategoryId === c.subId;
        if (c.noSub) return !tx.subcategoryId;
        return true;
    },

    renderCategoryChart(userId, prefix) {
        const txs = Transactions.list.filter(tx => tx.type === 'expense' && tx.paid !== false && tx.userId === userId && typeof tx.date === 'string' && tx.date.startsWith(prefix));
        const entries = this._groupBy(this.chartMode, txs);
        const labels = entries.map(c => c.name);
        const data = entries.map(c => c.total);
        const colors = entries.map(c => c.color);
        const catCtx = { data: entries, txs, prefix };
        const canvas = document.getElementById('category-chart');
        if (!canvas) return;
        this.destroyChart('cat');
        if (data.length === 0 || typeof Chart === 'undefined') { canvas.style.display = data.length === 0 ? 'none' : 'block'; return; }
        canvas.style.display = 'block';
        try {
            this.charts.cat = new Chart(canvas, {
                type: 'doughnut',
                data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (e, el) => {
                        if (el.length > 0) this.showCatDetail(el[0].index, catCtx);
                    },
                    plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } }
                }
            });
        } catch (e) {
            console.error('Chart error:', e);
        }
    },

    showCatDetail(index, ctx = {}) {
        const modal = document.getElementById('cat-detail-modal');
        const body = document.getElementById('cat-detail-body');
        const title = document.getElementById('cat-detail-title');
        const data = ctx.data || this._catData;
        if (!modal || !body || !data || !data[index]) return;
        const c = data[index];
        const list = (ctx.txs || [])
            .filter(tx => this._inBucket(tx, c))
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (title) {
            const p = ctx.prefix;
            const monthLabel = p && p.length >= 7 ? Utils.formatMonth(Number(p.slice(0, 4)), Number(p.slice(5, 7))) : '';
            title.textContent = monthLabel ? `${c.name} · ${monthLabel}` : c.name;
        }
        if (list.length === 0) {
            body.innerHTML = '<p class="muted">Sin transacciones</p>';
        } else {
            body.innerHTML = list.map(tx => {
                const pmLabel = tx.paymentMethod === 'credito'
                    ? `Crédito${tx.installments ? ` · Cuota ${tx.installmentNum}/${tx.installments}` : ''}`
                    : 'Débito';
                return `
                <div class="cat-detail-row">
                    <div class="cat-tx-info">
                        <span class="fw500">${Utils.esc(tx.description || c.name)}</span>
                        <span class="cat-tx-meta">${Utils.formatDate(tx.date)} · ${pmLabel}</span>
                    </div>
                    <span class="cat-detail-amount expense">-${Utils.formatMoney(tx.amount)}</span>
                </div>`;
            }).join('') + `
            <div class="cat-detail-total">
                <span>Total</span>
                <span>-${Utils.formatMoney(c.total)}</span>
            </div>`;
        }
        modal.classList.remove('hidden');
    },

    renderRecent(userId, prefix) {
        const el = document.getElementById('recent-transactions');
        if (!el) return;
        const recent = Transactions.list.filter(tx => tx.userId === userId && typeof tx.date === 'string' && tx.date.startsWith(prefix)).slice(0, 5);
        if (recent.length === 0) {
            el.innerHTML = '<p class="muted">Sin transacciones</p>';
            return;
        }
        el.innerHTML = recent.map(tx => {
            const cat = Categories.getById(tx.categoryId);
            const color = cat ? cat.color : '#95A5A6';
            const icon = cat ? cat.icon : 'fa-tag';
            const receiptIcon = tx.receiptUrl
                ? `<i class="fas fa-image receipt-mini" data-receipt="${Utils.esc(tx.receiptUrl)}" title="Ver comprobante"></i>`
                : '';
            return `
                <div class="mini-row">
                    <div class="mini-icon" style="background:${color}"><i class="fas ${icon}"></i></div>
                    <div class="mini-info">
                        <span class="fw500">${Utils.esc(tx.description || (cat ? cat.name : ''))} ${receiptIcon}</span>
                        <span class="muted"> ${Utils.formatDate(tx.date)}</span>
                    </div>
                    <span class="fw700 ${tx.type}">${tx.type === 'income' ? '+' : '-'}${Utils.formatMoney(tx.amount)}</span>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-receipt]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(btn.dataset.receipt, '_blank');
            });
        });
    },

    renderPendingWidget() {
        const el = document.getElementById('pending-count');
        if (!el) return;
        const pending = Transactions.getUnpaidExpenses().filter(tx => tx.userId === Auth.currentUser);
        if (pending.length === 0) {
            el.innerHTML = '<p class="muted">Sin pagos pendientes</p>';
            return;
        }
        const total = pending.reduce((s, tx) => s + tx.amount, 0);
        el.innerHTML = `
            <div class="pending-summary">
                <span class="muted">${pending.length} pago${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''}</span>
                <span class="fw700" style="color:var(--warning)">${Utils.formatMoney(total)}</span>
            </div>`;
    },

    renderGrupal() {
        const monthInput = document.getElementById('grupal-month');
        const prefix = monthInput ? monthInput.value : Utils.currentYearMonth();
        const txs = Transactions.list.filter(tx => typeof tx.date === 'string' && tx.date.startsWith(prefix));
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense' && t.paid !== false).reduce((s, t) => s + t.amount, 0);

        document.getElementById('grupal-balance').textContent = Utils.formatMoney(income - expense);
        document.getElementById('grupal-income').textContent = Utils.formatMoney(income);
        document.getElementById('grupal-expense').textContent = Utils.formatMoney(expense);

        this.renderComparison(txs);
        this.renderCategoryPerUser(txs);
        this.renderUserBars(txs, prefix);
    },

    renderComparison(txs) {
        const nIncome = txs.filter(t => t.type === 'income' && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const nExpense = txs.filter(t => t.type === 'expense' && t.paid !== false && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const eIncome = txs.filter(t => t.type === 'income' && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);
        const eExpense = txs.filter(t => t.type === 'expense' && t.paid !== false && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);

        const canvas = document.getElementById('grupal-comparison-chart');
        if (!canvas) return;
        this.destroyChart('grupalComp');
        this.charts.grupalComp = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Ingresos', 'Gastos'],
                datasets: [
                    { label: 'Nadia', data: [nIncome, nExpense], backgroundColor: 'rgba(255,107,157,0.7)', borderColor: '#FF6B9D', borderWidth: 1 },
                    { label: 'Elias', data: [eIncome, eExpense], backgroundColor: 'rgba(78,205,196,0.7)', borderColor: '#4ECDC4', borderWidth: 1 }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    },

    renderCategoryPerUser(txs) {
        const users = ['nadia', 'elias'];
        users.forEach(userId => {
            const canvas = document.getElementById(`grupal-category-${userId}`);
            if (!canvas) return;
            const key = `grupalCat_${userId}`;
            this.destroyChart(key);

            const paid = txs.filter(tx => tx.type === 'expense' && tx.paid !== false && tx.userId === userId);
            const entries = this._groupBy('category', paid);
            const labels = entries.map(c => c.name);
            const data = entries.map(c => c.total);
            const colors = entries.map(c => c.color);
            const gMonth = document.getElementById('grupal-month');
            const gPrefix = gMonth && gMonth.value ? gMonth.value : Utils.currentYearMonth();
            const catCtx = { data: entries, txs: paid, prefix: gPrefix };

            if (data.length === 0 || typeof Chart === 'undefined') {
                canvas.style.display = data.length === 0 ? 'none' : 'block';
                return;
            }
            canvas.style.display = 'block';
            try {
                this.charts[key] = new Chart(canvas, {
                    type: 'doughnut',
                    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (e, el) => {
                            if (el.length > 0) this.showCatDetail(el[0].index, catCtx);
                        },
                        plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } }
                    }
                });
            } catch (e) {
                console.error('Chart error:', e);
            }
        });
    },

    renderUserBars(txs, prefix) {
        const el = document.getElementById('grupal-user-bars');
        if (!el) return;
        const nIncome = txs.filter(t => t.type === 'income' && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const eIncome = txs.filter(t => t.type === 'income' && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);
        const nExpense = txs.filter(t => t.type === 'expense' && t.paid !== false && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const eExpense = txs.filter(t => t.type === 'expense' && t.paid !== false && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);
        const total = nIncome + eIncome || 1;
        const nPct = (nIncome / total * 100).toFixed(1);
        const ePct = (eIncome / total * 100).toFixed(1);
        const nExpPct = nIncome > 0 ? (nExpense / nIncome * 100).toFixed(1) : '0.0';
        const eExpPct = eIncome > 0 ? (eExpense / eIncome * 100).toFixed(1) : '0.0';
        const monthLabel = prefix
            ? new Date(prefix + '-15T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
            : '';

        el.innerHTML = `
            <div class="card-title">Ingresos${monthLabel ? ' de ' + monthLabel : ''} por usuario</div>
            <div class="user-bar-group">
                <div class="user-bar-header">
                    <span class="fw600 nadia-color">Nadia</span>
                    <span class="fw700">${Utils.formatMoney(nIncome)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${nPct}%;background:var(--nadia)"></div></div>
                <div style="display:flex;justify-content:space-between">
                    <span class="muted">${nPct}% del total ingresos</span>
                    <span class="muted">Gastos: ${Utils.formatMoney(nExpense)} (${nExpPct}% ingresos)</span>
                </div>
            </div>
            <div class="user-bar-group">
                <div class="user-bar-header">
                    <span class="fw600 elias-color">Elias</span>
                    <span class="fw700">${Utils.formatMoney(eIncome)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${ePct}%;background:var(--elias)"></div></div>
                <div style="display:flex;justify-content:space-between">
                    <span class="muted">${ePct}% del total ingresos</span>
                    <span class="muted">Gastos: ${Utils.formatMoney(eExpense)} (${eExpPct}% ingresos)</span>
                </div>
            </div>`;
    }
};