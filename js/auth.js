const Auth = {
    currentUser: null,

    init() {
        document.querySelectorAll('.user-btn').forEach(btn => {
            btn.addEventListener('click', () => this.login(btn.dataset.user));
        });
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    },

    login(userId) {
        this.currentUser = userId;
        const name = userId === 'nadia' ? 'Nadia' : 'Elias';
        const color = userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';

        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('sidebar-username').textContent = name;
        document.getElementById('sidebar-avatar').textContent = name[0];
        document.getElementById('sidebar-avatar').style.background = color;
        document.getElementById('topbar-avatar').textContent = name[0];
        document.getElementById('topbar-avatar').style.background = color;

        App.onLogin();
    },

    logout() {
        this.currentUser = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.add('active');
    }
};