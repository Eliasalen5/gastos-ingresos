const Notifications = {
    init() {
        this.requestPermission();
        setInterval(() => this.check(), 60 * 60 * 1000);
        this.check();
    },

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
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

    check() {
        let count = 0;
        ['nadia', 'elias'].forEach(userId => {
            const date = this.getNextPayDate(userId);
            if (!date) return;
            const days = Utils.daysUntil(date);
            if (days <= 1 && days >= 0) {
                count++;
                const name = userId === 'nadia' ? 'Nadia' : 'Elias';
                this.send(`Hola ${name}, ¡${days === 0 ? 'hoy es' : 'mañana es'} tu día de cobro!`, 'Toca para registrar tu ingreso');
            }
        });
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
        this.renderWidget();
    },

    send(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💰</text></svg>' });
        }
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