const Dashboard = {
    charts: {},
    _bound: false,

    init() {
        if (this._bound) return;
        this._bound = true;
        document.querySelectorAll('.dash-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const v = tab.dataset.view;
                document.getElementById('dash-individual').classList.toggle('hidden', v !== 'individual');
                document.getElementById('dash-grupal').classList.toggle('hidden', v !== 'grupal');
                v === 'grupal' ? this.renderGrupal() : this.renderIndividual();
            });
        });
    },

    refresh() {
        const isGrupal = !document.getElementById('dash-grupal').classList.contains('hidden');
        isGrupal ? this.renderGrupal() : this.renderIndividual();
    },

    destroyChart(key) {
        if (this.charts[key]) { this.charts[key].destroy(); this.charts[key] = null; }
    },

    renderIndividual() {
        const userId = Auth.currentUser;
        const txs = Transactions.getCurrentMonthTxs().filter(t => t.userId === userId);
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        document.getElementById('balance-amount').textContent = Utils.formatMoney(income - expense);
        document.getElementById('income-amount').textContent = Utils.formatMoney(income);
        document.getElementById('expense-amount').textContent = Utils.formatMoney(expense);

        this.renderCategoryChart(userId);
        this.renderRecent(userId);
        this.renderPendingWidget();
        Notifications.renderWidget();
    },

    renderCategoryChart(userId) {
        const txs = Transactions.getCurrentMonthTxs().filter(t => t.type === 'expense' && t.userId === userId);
        const map = {};
        txs.forEach(tx => {
            const cat = Categories.getById(tx.categoryId);
            const k = cat ? cat.name : 'Otros';
            const c = cat ? cat.color : '#95A5A6';
            map[k] = map[k] || { total: 0, color: c };
            map[k].total += tx.amount;
        });
        const labels = Object.keys(map);
        const data = labels.map(l => map[l].total);
        const colors = labels.map(l => map[l].color);
        const canvas = document.getElementById('category-chart');
        if (!canvas) return;
        this.destroyChart('cat');
        if (data.length === 0) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        this.charts.cat = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } } }
        });
    },

    renderRecent(userId) {
        const el = document.getElementById('recent-transactions');
        if (!el) return;
        const recent = Transactions.getCurrentMonthTxs().filter(tx => tx.userId === userId).slice(0, 5);
        if (recent.length === 0) {
            el.innerHTML = '<p class="muted">Sin transacciones</p>';
            return;
        }
        el.innerHTML = recent.map(tx => {
            const cat = Categories.getById(tx.categoryId);
            const color = cat ? cat.color : '#95A5A6';
            const icon = cat ? cat.icon : 'fa-tag';
            return `
                <div class="mini-row">
                    <div class="mini-icon" style="background:${color}"><i class="fas ${icon}"></i></div>
                    <div class="mini-info">
                        <span class="fw500">${Utils.esc(tx.description || (cat ? cat.name : ''))}</span>
                        <span class="muted"> ${Utils.formatDate(tx.date)}</span>
                    </div>
                    <span class="fw700 ${tx.type}">${tx.type === 'income' ? '+' : '-'}${Utils.formatMoney(tx.amount)}</span>
                </div>`;
        }).join('');
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
        const txs = Transactions.getCurrentMonthTxs();
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        document.getElementById('grupal-balance').textContent = Utils.formatMoney(income - expense);
        document.getElementById('grupal-income').textContent = Utils.formatMoney(income);
        document.getElementById('grupal-expense').textContent = Utils.formatMoney(expense);

        this.renderComparison(txs);
        this.renderUserBars(txs);
    },

    renderComparison(txs) {
        const nIncome = txs.filter(t => t.type === 'income' && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const nExpense = txs.filter(t => t.type === 'expense' && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const eIncome = txs.filter(t => t.type === 'income' && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);
        const eExpense = txs.filter(t => t.type === 'expense' && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);

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

    renderUserBars(txs) {
        const el = document.getElementById('grupal-user-bars');
        if (!el) return;
        const nIncome = txs.filter(t => t.type === 'income' && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const eIncome = txs.filter(t => t.type === 'income' && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);
        const nExpense = txs.filter(t => t.type === 'expense' && t.userId === 'nadia').reduce((s, t) => s + t.amount, 0);
        const eExpense = txs.filter(t => t.type === 'expense' && t.userId === 'elias').reduce((s, t) => s + t.amount, 0);
        const total = nIncome + eIncome || 1;
        const nPct = (nIncome / total * 100).toFixed(1);
        const ePct = (eIncome / total * 100).toFixed(1);
        const nExpPct = nIncome > 0 ? (nExpense / nIncome * 100).toFixed(1) : '0.0';
        const eExpPct = eIncome > 0 ? (eExpense / eIncome * 100).toFixed(1) : '0.0';

        el.innerHTML = `
            <div class="card-title">Ingresos del mes por usuario</div>
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