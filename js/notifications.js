const Notifications = {
    list: [],
    PAYDAY_KEY: 'app_payday_notified',
    MAX_ITEMS: 10,

    getStorageKey(user) {
        return `app_notifications_${user || Auth.currentUser}`;
    },

    init() {
        this.load();
        this.requestPermission();
        this.checkPayday();
        setInterval(() => this.checkPayday(), 60 * 60 * 1000);
        this.renderBadge();
        this.bindDropdown();
        setInterval(() => {
            this.load();
            this.renderBadge();
        }, 5000);
    },

    load() {
        try {
            this.list = JSON.parse(localStorage.getItem(this.getStorageKey())) || [];
        } catch (e) {
            this.list = [];
        }
    },

    save() {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.list));
    },

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    add(type, title, body, targetUser) {
        const notif = {
            id: Date.now() + Math.random(),
            type,
            title,
            body,
            date: new Date().toISOString(),
            read: false
        };
        const key = this.getStorageKey(targetUser);
        let list;
        try {
            list = JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            list = [];
        }
        list.unshift(notif);
        if (list.length > this.MAX_ITEMS) list = list.slice(0, this.MAX_ITEMS);
        localStorage.setItem(key, JSON.stringify(list));

        if (targetUser === Auth.currentUser || !targetUser) {
            this.list = list;
            this.renderBadge();
            this.renderDropdown();
        }

        if (type === 'transaction' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💰</text></svg>'
            });
        }
    },

    getNextPayDate(userId) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (userId === 'nadia') {
            const lastDay = Utils.getLastBusinessDay(now.getFullYear(), now.getMonth() + 1);
            return today <= lastDay ? lastDay : Utils.getLastBusinessDay(now.getFullYear(), now.getMonth() + 2);
        }

        if (userId === 'elias') {
            const early = Utils.getNthBusinessDay(now.getFullYear(), now.getMonth() + 1, 1, 3);
            const late = Utils.getNthBusinessDay(now.getFullYear(), now.getMonth() + 1, 16, 3);
            const nextEarly = Utils.getNthBusinessDay(now.getFullYear(), now.getMonth() + 2, 1, 3);
            const candidates = [early, late, nextEarly].filter(d => d >= today);
            return candidates[0] || nextEarly;
        }
        return null;
    },

    checkPayday() {
        const today = Utils.todayStr();
        let notified;
        try {
            notified = JSON.parse(localStorage.getItem(this.PAYDAY_KEY)) || {};
        } catch (e) {
            notified = {};
        }

        ['nadia', 'elias'].forEach(userId => {
            const date = this.getNextPayDate(userId);
            if (!date) return;
            const days = Utils.daysUntil(date);
            if (days <= 1 && days >= 0) {
                const key = `${userId}_${today}`;
                if (!notified[key]) {
                    const name = userId === 'nadia' ? 'Nadia' : 'Elias';
                    const msg = days === 0 ? '¡Hoy es tu día de cobro!' : '¡Mañana es tu día de cobro!';
                    this.add('payday', name, msg, userId);
                    this.sendPush(`${name}, ${msg}`, 'Toca para registrar tu ingreso');
                    notified[key] = true;
                    localStorage.setItem(this.PAYDAY_KEY, JSON.stringify(notified));
                }
            }
        });
        this.renderBadge();
        this.renderWidget();
    },

    sendPush(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💰</text></svg>'
            });
        }
    },

    getUnreadCount() {
        return this.list.filter(n => !n.read).length;
    },

    renderBadge() {
        const badge = document.getElementById('notif-badge');
        const count = this.getUnreadCount();
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    },

    bindDropdown() {
        const btn = document.getElementById('notif-btn');
        const dropdown = document.getElementById('notif-dropdown');
        if (!btn || !dropdown) return;

        let isOpen = false;

        const openDropdown = () => {
            this.load();
            this.markAllRead();
            this.renderDropdown();
            dropdown.classList.remove('hidden');
            isOpen = true;
        };

        const closeDropdown = () => {
            dropdown.classList.add('hidden');
            isOpen = false;
        };

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });

        document.addEventListener('click', (e) => {
            if (isOpen && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                closeDropdown();
            }
        });
    },

    markAllRead() {
        this.list.forEach(n => n.read = true);
        this.save();
        this.renderBadge();
    },

    renderDropdown() {
        const dropdown = document.getElementById('notif-dropdown');
        if (!dropdown) return;

        this.load();

        if (this.list.length === 0) {
            dropdown.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Sin notificaciones</p></div>';
            return;
        }

        dropdown.innerHTML = this.list.map(n => {
            const icons = { transaction: 'fa-exchange-alt', payday: 'fa-money-bill-wave' };
            const colors = { transaction: 'var(--primary)', payday: 'var(--success)' };
            const icon = icons[n.type] || 'fa-bell';
            const color = colors[n.type] || 'var(--primary)';
            const date = new Date(n.date);
            const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            const unread = !n.read ? ' unread' : '';
            const page = n.type === 'transaction' ? 'gastos' : 'home';

            return `
                <div class="notif-item${unread}" data-page="${page}">
                    <div class="notif-icon" style="background:${color}"><i class="fas ${icon}"></i></div>
                    <div class="notif-content">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-body">${n.body}</div>
                        <div class="notif-time">${dateStr} ${timeStr}</div>
                    </div>
                </div>`;
        }).join('');

        dropdown.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', () => {
                dropdown.classList.add('hidden');
                App.navigate(item.dataset.page);
            });
        });
    },

    renderWidget() {
        const container = document.getElementById('next-payroll');
        if (!container) return;
        container.innerHTML = ['nadia', 'elias'].map(userId => {
            const date = this.getNextPayDate(userId);
            if (!date) return '';
            const name = userId === 'nadia' ? 'Nadia' : 'Elias';
            const color = userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const days = Utils.daysUntil(date);
            const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            const daysText = days === 0 ? '¡Hoy!' : days === 1 ? '¡Mañana!' : `En ${days} días`;
            return `
                <div class="payroll-row">
                    <div class="payroll-avatar" style="background:${color}">${name[0]}</div>
                    <div class="payroll-info">
                        <div class="payroll-name">${name}</div>
                        <div class="payroll-date">${dateStr} · ${daysText}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="Notifications.openIncomeForm('${userId}')">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>`;
        }).join('');
    },

    openIncomeForm(userId) {
        const date = this.getNextPayDate(userId);
        if (date) {
            App.navigate('nuevo-gasto');
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.type-btn[data-type="income"]').classList.add('active');
            Transactions.updateCategorySelect();
            document.getElementById('tx-date').value = date.toISOString().split('T')[0];
            document.getElementById('tx-description').value = `Cobro ${userId === 'nadia' ? 'Nadia' : 'Elias'}`;
        }
    }
};