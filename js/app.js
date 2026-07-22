const App = {
    currentPage: 'home',

    async init() {
        this.bindNav();
        this.bindMenu();
        Auth.init();
        document.getElementById('tx-date').value = Utils.todayStr();
        document.getElementById('filter-date').value = Utils.currentYearMonth();
    },

    async onLogin() {
        await Categories.init();
        await Transactions.init();
        Dashboard.init();
        Notifications.init();
        this.navigate('home');
    },

    bindNav() {
        document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', () => this.navigate(i.dataset.page)));
        document.querySelectorAll('.bottom-nav-item').forEach(i => i.addEventListener('click', () => this.navigate(i.dataset.page)));
    },

    bindMenu() {
        const toggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        toggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    },

    navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
        document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));

        const titles = { home: 'Home', gastos: 'Gastos', ingresos: 'Ingresos', 'nuevo-gasto': 'Nuevo Gasto', pagos: 'Pagos', categorias: 'Categorías' };
        document.getElementById('page-title').textContent = titles[page] || page;
        document.getElementById('sidebar')?.classList.remove('open');
        this.refreshPage(page);
    },

    refreshPage(page) {
        switch (page) {
            case 'home': Dashboard.refresh(); break;
            case 'gastos': Transactions.renderList(); break;
            case 'ingresos': this.renderIngresos(); break;
            case 'nuevo-gasto':
                if (!document.getElementById('tx-id').value) Transactions.resetForm();
                break;
            case 'pagos': this.renderPagos(); break;
            case 'categorias': Categories.renderGrid(); break;
        }
    },

    renderIngresos() {
        const el = document.getElementById('ingresos-list');
        if (!el) return;
        const txs = Transactions.list.filter(tx => tx.type === 'income');
        if (txs.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-arrow-down"></i><p>Sin ingresos</p></div>';
            return;
        }
        el.innerHTML = txs.map(tx => {
            const cat = Categories.getById(tx.categoryId);
            const userName = tx.userId === 'nadia' ? 'Nadia' : 'Elias';
            const userColor = tx.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            return `
                <div class="tx-item">
                    <div class="tx-icon" style="background:${cat ? cat.color : '#95A5A6'}"><i class="fas ${cat ? cat.icon : 'fa-tag'}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${tx.description || (cat ? cat.name : '')}</div>
                        <div class="tx-meta"><span class="user-dot" style="background:${userColor}"></span> ${userName} · ${Utils.formatDate(tx.date)}</div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-value income">+${Utils.formatMoney(tx.amount)}</div>
                    </div>
                </div>`;
        }).join('');
    },

    renderPagos() {
        const el = document.getElementById('pagos-list');
        const summaryEl = document.getElementById('pagos-summary');
        if (!el) return;

        const pending = Transactions.getUnpaidExpenses();
        const total = pending.reduce((s, tx) => s + tx.amount, 0);

        summaryEl.innerHTML = pending.length === 0
            ? '<p class="muted">Sin pagos pendientes</p>'
            : `<div class="pagos-total"><span>Total pendiente</span><span class="fw700" style="color:var(--warning)">${Utils.formatMoney(total)}</span></div>`;

        if (pending.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-check-circle"></i><p>Todo pagado</p></div>';
            return;
        }

        el.innerHTML = pending.map(tx => {
            const cat = Categories.getById(tx.categoryId);
            const catColor = cat ? cat.color : '#95A5A6';
            const catIcon = cat ? cat.icon : 'fa-tag';
            const userName = tx.userId === 'nadia' ? 'Nadia' : 'Elias';
            const userColor = tx.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';

            return `
                <div class="pago-item">
                    <div class="tx-icon" style="background:${catColor}"><i class="fas ${catIcon}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${tx.description || (cat ? cat.name : '')}</div>
                        <div class="tx-meta"><span class="user-dot" style="background:${userColor}"></span> ${userName} · ${Utils.formatDate(tx.date)}</div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-value expense">-${Utils.formatMoney(tx.amount)}</div>
                    </div>
                    <button class="btn btn-sm btn-primary pago-btn" data-pay="${tx.id}"><i class="fas fa-check"></i> Pagar</button>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-pay]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('¿Marcar como pagado?')) {
                    await Transactions.markPaid(btn.dataset.pay);
                }
            });
        });
    },

    toast(msg, type = 'info') {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
        t.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${msg}</span>`;
        c.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; setTimeout(() => t.remove(), 300); }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());