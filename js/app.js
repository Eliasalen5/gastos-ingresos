const App = {
    currentPage: 'home',
    _bound: false,

    async init() {
        if (!this._bound) {
            this.bindNav();
            this.bindMenu();
            Auth.init();
            window.addEventListener('beforeunload', (e) => {
                if (this.currentPage === 'nuevo-gasto') {
                    const hasData = document.getElementById('tx-amount').value || document.getElementById('tx-description').value;
                    if (hasData) {
                        e.preventDefault();
                        e.returnValue = '';
                    }
                }
            });
            this._bound = true;
        }
        document.getElementById('tx-date').value = Utils.todayStr();
        document.getElementById('filter-date').value = Utils.currentYearMonth();
    },

    async onLogin() {
        await Categories.init();
        Categories.updateFilterSelect();
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
        const overlay = document.getElementById('sidebar-overlay');
        const closeSidebar = () => { sidebar.classList.remove('open'); overlay?.classList.remove('open'); };
        toggle?.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay?.classList.toggle('open');
        });
        overlay?.addEventListener('click', closeSidebar);
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
                closeSidebar();
            }
        });
        const sidebarUser = document.querySelector('.sidebar-user');
        if (sidebarUser) sidebarUser.addEventListener('click', () => this.navigate('home'));
    },

    navigate(page) {
        if (this.currentPage === 'nuevo-gasto' && page !== 'nuevo-gasto') {
            const form = document.getElementById('tx-form');
            const hasData = document.getElementById('tx-amount').value || document.getElementById('tx-description').value;
            if (hasData && !document.getElementById('tx-id').value) {
                if (!confirm('¿Salir sin guardar?')) return;
            }
        }
        this.currentPage = page;
        document.getElementById('notif-dropdown')?.classList.add('hidden');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
        document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));

        const titles = { home: 'Home', gastos: 'Gastos', ingresos: 'Ingresos', 'nuevo-gasto': 'Nuevo Gasto', pagos: 'Pagos', categorias: 'Categorías' };
        document.getElementById('page-title').textContent = titles[page] || page;
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('open');
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
            const receiptBtn = tx.receiptUrl
                ? `<button class="icon-btn receipt-btn" data-receipt="${Utils.esc(tx.receiptUrl)}" title="Ver comprobante"><i class="fas fa-image"></i></button>`
                : '';
            return `
                <div class="tx-item">
                    <div class="tx-icon" style="background:${cat ? cat.color : '#95A5A6'}"><i class="fas ${cat ? cat.icon : 'fa-tag'}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${Utils.esc(tx.description || (cat ? cat.name : ''))}</div>
                        <div class="tx-meta"><span class="user-dot" style="background:${userColor}"></span> ${userName} · ${Utils.formatDate(tx.date)}</div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-value income">+${Utils.formatMoney(tx.amount)}</div>
                    </div>
                    <div class="tx-actions">
                        ${receiptBtn}
                        <button class="icon-btn" data-edit="${tx.id}"><i class="fas fa-pen"></i></button>
                        <button class="icon-btn danger" data-del="${tx.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        }).join('');

        el.querySelectorAll('[data-receipt]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(btn.dataset.receipt, '_blank');
            });
        });

        el.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tx = Transactions.list.find(t => t.id === btn.dataset.edit);
                if (tx) Transactions.editTx(tx);
            });
        });
        el.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                Transactions.deleteTx(btn.dataset.del);
            });
        });
    },

    renderPagos() {
        const el = document.getElementById('pagos-list');
        const summaryEl = document.getElementById('pagos-summary');
        if (!el) return;

        const pending = Transactions.getUnpaidExpenses().filter(tx => tx.installments >= 1);
        const total = pending.reduce((s, tx) => s + tx.amount, 0);

        summaryEl.innerHTML = pending.length === 0
            ? '<p class="muted">Sin pagos pendientes</p>'
            : `<div class="pagos-total"><span>Total pendiente</span><span class="fw700" style="color:var(--warning)">${Utils.formatMoney(total)}</span></div>`;

        if (pending.length === 0) {
            el.innerHTML = '<div class="empty"><i class="fas fa-check-circle"></i><p>Todo pagado</p></div>';
            return;
        }

        const monthGroups = {};
        pending.forEach(tx => {
            const monthKey = tx.date ? tx.date.substring(0, 7) : 'unknown';
            const key = `${tx.userId}_${monthKey}`;
            if (!monthGroups[key]) monthGroups[key] = { userId: tx.userId, month: monthKey, txs: [] };
            monthGroups[key].txs.push(tx);
        });

        const sortedGroups = Object.values(monthGroups).sort((a, b) => a.month.localeCompare(b.month));

        el.innerHTML = sortedGroups.map(group => {
            const userName = group.userId === 'nadia' ? 'Nadia' : 'Elias';
            const userColor = group.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const monthDate = new Date(group.month + '-15T12:00:00');
            const monthLabel = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const groupTotal = group.txs.reduce((s, tx) => s + tx.amount, 0);

            const items = group.txs.map(tx => {
                const cat = Categories.getById(tx.categoryId);
                const catColor = cat ? cat.color : '#95A5A6';
                const catIcon = cat ? cat.icon : 'fa-tag';
                const num = tx.installmentNum || 1;
                const instOf = tx.installments || 1;
                const receiptBtn = tx.receiptUrl
                    ? `<button class="icon-btn receipt-btn" data-receipt="${Utils.esc(tx.receiptUrl)}" title="Ver comprobante"><i class="fas fa-image"></i></button>`
                    : '';
                return `<div class="inst-row">
                    <div class="tx-icon" style="background:${catColor}"><i class="fas ${catIcon}"></i></div>
                    <div class="inst-info">
                        <div class="tx-desc">${Utils.esc(tx.description || (cat ? cat.name : ''))}</div>
                        <div class="inst-month">Cuota ${num}/${instOf} · ${Utils.formatDate(tx.date)}</div>
                    </div>
                    <div class="inst-amount fw700 expense">-${Utils.formatMoney(tx.amount)}</div>
                    ${receiptBtn}
                    <button class="btn btn-sm btn-primary pago-btn" data-pay="${tx.id}"><i class="fas fa-check"></i></button>
                </div>`;
            }).join('');

            return `
                <div class="pago-item-group">
                    <div class="pago-header">
                        <div class="pago-month-label">
                            <span class="user-dot" style="background:${userColor}"></span>
                            <span class="fw700">${userName}</span>
                            <span class="pago-month-name">${Utils.esc(monthLabel)}</span>
                        </div>
                        <div class="pago-month-total">-${Utils.formatMoney(groupTotal)}</div>
                    </div>
                    <div class="inst-list">${items}</div>
                    <div class="pago-footer">
                        <button class="btn btn-sm btn-primary" data-pay-all="" data-user="${group.userId}" data-month="${group.month}">
                            <i class="fas fa-check-double"></i> Pagar todo ${Utils.esc(monthLabel)}
                        </button>
                    </div>
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

        el.querySelectorAll('[data-pay-all]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await Transactions.markAllGroupPaid(btn.dataset.user, btn.dataset.month);
            });
        });

        el.querySelectorAll('[data-receipt]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(btn.dataset.receipt, '_blank');
            });
        });
    },

    toast(msg, type = 'info') {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
        t.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${Utils.esc(msg)}</span>`;
        c.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; setTimeout(() => t.remove(), 300); }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());