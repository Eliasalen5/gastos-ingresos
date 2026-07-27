const Utils = {
    HOLIDAYS: [
        '01-01', '02-16', '02-17', '03-24', '04-02', '04-03',
        '05-01', '05-25', '06-15', '06-20', '07-09', '08-17',
        '10-12', '11-20', '12-08', '12-25'
    ],

    esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

    isBusinessDay(date) {
        const day = date.getDay();
        if (day === 0 || day === 6) return false;
        const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return !this.HOLIDAYS.includes(key);
    },

    getLastBusinessDay(year, month) {
        const d = new Date(year, month, 0);
        while (!this.isBusinessDay(d)) d.setDate(d.getDate() - 1);
        return d;
    },

    getNthBusinessDay(year, month, startDay, n) {
        const d = new Date(year, month - 1, startDay);
        let count = this.isBusinessDay(d) ? 1 : 0;
        if (count >= n) return d;
        let safety = 0;
        while (count < n && safety < 60) {
            d.setDate(d.getDate() + 1);
            if (this.isBusinessDay(d)) count++;
            safety++;
        }
        return d;
    },

    formatMoney(amount) {
        return `$${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    formatDate(dateStr) {
        return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    },

    formatMonth(year, month) {
        return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    },

    todayStr() {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    },

    currentYearMonth() {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    },

    daysUntil(date) {
        const today = new Date();
        const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return Math.ceil((target - t) / 86400000);
    }
};