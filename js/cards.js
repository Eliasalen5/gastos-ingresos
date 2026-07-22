const Cards = {
    list: [],

    async init() {
        document.getElementById('card-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
        document.querySelectorAll('#card-modal .modal-close').forEach(b => b.addEventListener('click', () => this.closeModal()));
        document.querySelector('#card-modal .modal-overlay')?.addEventListener('click', () => this.closeModal());
        await this.load();
    },

    async load() {
        try {
            const snap = await db.collection('creditCards').get();
            this.list = [];
            snap.forEach(doc => this.list.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading cards:', e);
            this.list = [];
        }
    },

    async save() {
        const id = document.getElementById('cc-id').value;
        const name = document.getElementById('cc-name').value.trim();
        const type = document.getElementById('cc-type').value;
        const userId = document.getElementById('cc-user').value;
        const color = document.getElementById('cc-color').value;
        if (!name) return;

        const data = { name, type, userId, color, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (id) await db.collection('creditCards').doc(id).update(data);
            else await db.collection('creditCards').add(data);
            App.toast('Tarjeta guardada', 'success');
            this.closeModal();
            await this.load();
        } catch (e) {
            App.toast('Error al guardar', 'error');
        }
    },

    async deleteCard(id) {
        if (!confirm('¿Eliminar tarjeta?')) return;
        try {
            await db.collection('creditCards').doc(id).delete();
            App.toast('Tarjeta eliminada', 'success');
            await this.load();
        } catch (e) {
            App.toast('Error al eliminar', 'error');
        }
    },

    openModal(card = null) {
        document.getElementById('card-modal').classList.remove('hidden');
        document.getElementById('card-modal-title').textContent = card ? 'Editar Tarjeta' : 'Nueva Tarjeta';
        if (card) {
            document.getElementById('cc-id').value = card.id;
            document.getElementById('cc-name').value = card.name;
            document.getElementById('cc-type').value = card.type;
            document.getElementById('cc-user').value = card.userId;
            document.getElementById('cc-color').value = card.color || '#FF6B00';
        } else {
            document.getElementById('card-form').reset();
            document.getElementById('cc-id').value = '';
            document.getElementById('cc-color').value = '#FF6B00';
        }
    },

    closeModal() {
        document.getElementById('card-modal').classList.add('hidden');
    },

    getById(id) {
        return this.list.find(c => c.id === id);
    },

    getCreditCards(userId) {
        return this.list.filter(c => c.type === 'credito' && (!userId || c.userId === userId));
    },

    getDebitCards(userId) {
        return this.list.filter(c => c.type === 'debito' && (!userId || c.userId === userId));
    },

    renderGrid() {
        const container = document.getElementById('cards-list');
        if (!container) return;
        if (this.list.length === 0) {
            container.innerHTML = '<div class="empty"><i class="fas fa-credit-card"></i><p>Sin tarjetas</p></div>';
            return;
        }
        container.innerHTML = this.list.map(c => {
            const userName = c.userId === 'nadia' ? 'Nadia' : 'Elias';
            const typeLabel = c.type === 'debito' ? 'Débito' : 'Crédito';
            return `
                <div class="cc-card" style="background:${c.color}">
                    <div class="cc-actions">
                        <button class="cc-action-btn" data-edit='${JSON.stringify(c).replace(/'/g, "&#39;")}'><i class="fas fa-pen"></i></button>
                        <button class="cc-action-btn" data-del="${c.id}"><i class="fas fa-trash"></i></button>
                    </div>
                    <span class="cc-type"><i class="fas ${c.type === 'debito' ? 'fa-money-check-alt' : 'fa-credit-card'}"></i> ${typeLabel}</span>
                    <h3>${c.name}</h3>
                    <span class="cc-owner">${userName}</span>
                </div>`;
        }).join('');

        container.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = JSON.parse(btn.dataset.edit.replace(/&#39;/g, "'"));
                this.openModal(card);
            });
        });
        container.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteCard(btn.dataset.del);
            });
        });
    }
};