const Categories = {
    list: [],
    selectedIcon: 'fa-tag',

    ICONS: [
        'fa-utensils', 'fa-shopping-cart', 'fa-car', 'fa-gamepad', 'fa-heartbeat',
        'fa-graduation-cap', 'fa-tshirt', 'fa-home', 'fa-bolt', 'fa-bus',
        'fa-plane', 'fa-coffee', 'fa-paw', 'fa-baby', 'fa-gift',
        'fa-music', 'fa-film', 'fa-dumbbell', 'fa-pills', 'fa-mobile-alt',
        'fa-laptop', 'fa-wifi', 'fa-hand-holding-usd', 'fa-piggy-bank',
        'fa-chart-line', 'fa-briefcase', 'fa-coins', 'fa-receipt',
        'fa-concierge-bell', 'fa-hotel', 'fa-camera', 'fa-book', 'fa-toolbox',
        'fa-cut', 'fa-dog', 'fa-seedling', 'fa-donate', 'fa-tag'
    ],

    DEFAULTS: [
        { id: 'cat_comida', name: 'Comida', icon: 'fa-utensils', color: '#E74C3C', type: 'expense' },
        { id: 'cat_super', name: 'Supermercado', icon: 'fa-shopping-cart', color: '#E67E22', type: 'expense' },
        { id: 'cat_transporte', name: 'Transporte', icon: 'fa-car', color: '#3498DB', type: 'expense' },
        { id: 'cat_entret', name: 'Entretenimiento', icon: 'fa-gamepad', color: '#9B59B6', type: 'expense' },
        { id: 'cat_salud', name: 'Salud', icon: 'fa-heartbeat', color: '#1ABC9C', type: 'expense' },
        { id: 'cat_educ', name: 'Educación', icon: 'fa-graduation-cap', color: '#2C3E50', type: 'expense' },
        { id: 'cat_servicios', name: 'Servicios', icon: 'fa-bolt', color: '#F1C40F', type: 'expense' },
        { id: 'cat_ropa', name: 'Ropa', icon: 'fa-tshirt', color: '#E91E63', type: 'expense' },
        { id: 'cat_hogar', name: 'Hogar', icon: 'fa-home', color: '#795548', type: 'expense' },
        { id: 'cat_otros_g', name: 'Otros gastos', icon: 'fa-tag', color: '#95A5A6', type: 'expense' },
        { id: 'cat_salario', name: 'Salario', icon: 'fa-briefcase', color: '#2ECC71', type: 'income' },
        { id: 'cat_freelance', name: 'Freelance', icon: 'fa-coins', color: '#27AE60', type: 'income' },
        { id: 'cat_inversiones', name: 'Inversiones', icon: 'fa-chart-line', color: '#16A085', type: 'income' },
        { id: 'cat_otros_i', name: 'Otros ingresos', icon: 'fa-hand-holding-usd', color: '#1ABC9C', type: 'income' }
    ],

    async init() {
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('category-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
        document.querySelectorAll('#category-modal .modal-close').forEach(b => b.addEventListener('click', () => this.closeModal()));
        document.querySelector('#category-modal .modal-overlay')?.addEventListener('click', () => this.closeModal());
        this.renderIconPicker();
        await this.load();
    },

    renderIconPicker() {
        const picker = document.getElementById('icon-picker');
        picker.innerHTML = this.ICONS.map(i =>
            `<button type="button" class="icon-option ${i === this.selectedIcon ? 'selected' : ''}" data-icon="${i}"><i class="fas ${i}"></i></button>`
        ).join('');
        picker.querySelectorAll('.icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                picker.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedIcon = btn.dataset.icon;
            });
        });
    },

    async load() {
        try {
            const snap = await db.collection('categories').get();
            this.list = [];
            snap.forEach(doc => this.list.push({ id: doc.id, ...doc.data() }));
            if (this.list.length === 0) {
                for (const cat of this.DEFAULTS) {
                    await db.collection('categories').doc(cat.id).set({
                        name: cat.name, icon: cat.icon, color: cat.color, type: cat.type
                    });
                }
                this.list = [...this.DEFAULTS];
            }
        } catch (e) {
            console.error('Error loading categories:', e);
            this.list = [...this.DEFAULTS];
        }
    },

    async save() {
        const id = document.getElementById('cat-id').value;
        const name = document.getElementById('cat-name').value.trim();
        const type = document.getElementById('cat-type').value;
        const color = document.getElementById('cat-color').value;
        if (!name) return;

        const data = { name, icon: this.selectedIcon, type, color };
        try {
            if (id) {
                await db.collection('categories').doc(id).update(data);
            } else {
                await db.collection('categories').add(data);
            }
            App.toast('Categoría guardada', 'success');
            this.closeModal();
            await this.load();
        } catch (e) {
            App.toast('Error al guardar', 'error');
        }
    },

    async delete(id) {
        if (!confirm('¿Eliminar categoría?')) return;
        try {
            await db.collection('categories').doc(id).delete();
            App.toast('Categoría eliminada', 'success');
            await this.load();
        } catch (e) {
            App.toast('Error al eliminar', 'error');
        }
    },

    openModal(cat = null) {
        document.getElementById('category-modal').classList.remove('hidden');
        document.getElementById('category-modal-title').textContent = cat ? 'Editar Categoría' : 'Nueva Categoría';
        if (cat) {
            document.getElementById('cat-id').value = cat.id;
            document.getElementById('cat-name').value = cat.name;
            document.getElementById('cat-type').value = cat.type;
            document.getElementById('cat-color').value = cat.color || '#6C63FF';
            this.selectedIcon = cat.icon || 'fa-tag';
        } else {
            document.getElementById('category-form').reset();
            document.getElementById('cat-id').value = '';
            document.getElementById('cat-color').value = '#6C63FF';
            this.selectedIcon = 'fa-tag';
        }
        this.renderIconPicker();
    },

    closeModal() {
        document.getElementById('category-modal').classList.add('hidden');
    },

    getById(id) {
        return this.list.find(c => c.id === id);
    },

    renderSelects(filterType) {
        const filtered = filterType
            ? this.list.filter(c => c.type === filterType || c.type === 'both')
            : this.list;
        return filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    },

    renderGrid() {
        const container = document.getElementById('categories-list');
        if (!container) return;
        if (this.list.length === 0) {
            container.innerHTML = '<div class="empty"><i class="fas fa-tags"></i><p>Sin categorías</p></div>';
            return;
        }
        container.innerHTML = this.list.map(c => `
            <div class="cat-card" style="border-top:3px solid ${c.color}">
                <div class="cat-actions">
                    <button class="icon-btn" data-edit='${JSON.stringify(c).replace(/'/g, "&#39;")}'><i class="fas fa-pen"></i></button>
                    <button class="icon-btn danger" data-del="${c.id}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="cat-icon" style="color:${c.color}"><i class="fas ${c.icon}"></i></div>
                <div class="cat-name">${c.name}</div>
                <span class="cat-badge">${c.type === 'expense' ? 'Gasto' : c.type === 'income' ? 'Ingreso' : 'Ambos'}</span>
            </div>
        `).join('');

        container.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = JSON.parse(btn.dataset.edit.replace(/&#39;/g, "'"));
                this.openModal(cat);
            });
        });
        container.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => this.delete(btn.dataset.del));
        });
    }
};