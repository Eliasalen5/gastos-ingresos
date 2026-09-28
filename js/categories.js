const Categories = {
    list: [],
    selectedIcon: 'fa-tag',
    selectedSubIcon: 'fa-tag',
    selectedKind: 'variable',
    gridFilter: 'all',
    expanded: {},
    _bound: false,
    _subBound: false,

    ICONS: [
        'fa-utensils', 'fa-shopping-cart', 'fa-car', 'fa-gamepad', 'fa-heartbeat',
        'fa-graduation-cap', 'fa-tshirt', 'fa-home', 'fa-bolt', 'fa-bus',
        'fa-plane', 'fa-coffee', 'fa-paw', 'fa-baby', 'fa-gift',
        'fa-music', 'fa-film', 'fa-dumbbell', 'fa-pills', 'fa-mobile-alt',
        'fa-laptop', 'fa-wifi', 'fa-hand-holding-usd', 'fa-piggy-bank',
        'fa-chart-line', 'fa-briefcase', 'fa-coins', 'fa-receipt',
        'fa-concierge-bell', 'fa-hotel', 'fa-camera', 'fa-book', 'fa-toolbox',
        'fa-cut', 'fa-dog', 'fa-seedling', 'fa-donate', 'fa-tag',
        'fa-gas-pump', 'fa-square-parking', 'fa-wrench', 'fa-broom',
        'fa-basket-shopping', 'fa-stethoscope', 'fa-user-nurse', 'fa-martini-glass',
        'fa-tv', 'fa-repeat', 'fa-lightbulb', 'fa-fire', 'fa-droplet',
        'fa-shirt', 'fa-shoe-prints', 'fa-book-open', 'fa-soap', 'fa-couch',
        'fa-palette', 'fa-utensil-crossfork', 'fa-money-bill-wave', 'fa-sim-card'
    ],

    MAX_SUBS: 20,
    MAX_SUBS_NAME: 40,

    DEFAULTS: [
        {
            id: 'cat_comida', name: 'Comida', icon: 'fa-utensils', color: '#E74C3C', type: 'expense', kind: 'variable',
            subcategories: [
                { id: 'sub_cat_comida_super', name: 'Supermercado', icon: 'fa-basket-shopping' },
                { id: 'sub_cat_comida_rest', name: 'Restaurante', icon: 'fa-utensils' },
                { id: 'sub_cat_comida_delivery', name: 'Delivery', icon: 'fa-concierge-bell' },
                { id: 'sub_cat_comida_cafeteria', name: 'Cafetería', icon: 'fa-coffee' },
                { id: 'sub_cat_comida_almuerzo', name: 'Almuerzo', icon: 'fa-utensil-crossfork' }
            ]
        },
        {
            id: 'cat_super', name: 'Supermercado', icon: 'fa-shopping-cart', color: '#E67E22', type: 'expense', kind: 'variable',
            subcategories: [
                { id: 'sub_cat_super_almacen', name: 'Almacén', icon: 'fa-shopping-cart' },
                { id: 'sub_cat_super_verduleria', name: 'Verdulería', icon: 'fa-seedling' },
                { id: 'sub_cat_super_carniceria', name: 'Carnicería', icon: 'fa-cut' },
                { id: 'sub_cat_super_limpieza', name: 'Limpieza', icon: 'fa-broom' }
            ]
        },
        {
            id: 'cat_transporte', name: 'Transporte', icon: 'fa-car', color: '#3498DB', type: 'expense', kind: 'variable',
            subcategories: [
                { id: 'sub_cat_transporte_nafta', name: 'Nafta', icon: 'fa-gas-pump' },
                { id: 'sub_cat_transporte_service', name: 'Service', icon: 'fa-wrench', kind: 'fixed' },
                { id: 'sub_cat_transporte_garage', name: 'Garage', icon: 'fa-toolbox', kind: 'fixed' },
                { id: 'sub_cat_transporte_estacionamiento', name: 'Estacionamiento', icon: 'fa-square-parking' },
                { id: 'sub_cat_transporte_sube', name: 'SUBE / Peaje', icon: 'fa-bus' }
            ]
        },
        {
            id: 'cat_entret', name: 'Entretenimiento', icon: 'fa-gamepad', color: '#9B59B6', type: 'expense', kind: 'variable',
            subcategories: [
                { id: 'sub_cat_entret_cine', name: 'Cine', icon: 'fa-film' },
                { id: 'sub_cat_entret_streaming', name: 'Streaming', icon: 'fa-tv' },
                { id: 'sub_cat_entret_salidas', name: 'Salidas', icon: 'fa-martini-glass' },
                { id: 'sub_cat_entret_viajes', name: 'Viajes', icon: 'fa-plane' },
                { id: 'sub_cat_entret_suscripciones', name: 'Suscripciones', icon: 'fa-repeat' }
            ]
        },
        {
            id: 'cat_salud', name: 'Salud', icon: 'fa-heartbeat', color: '#1ABC9C', type: 'expense', kind: 'variable',
            subcategories: [
                { id: 'sub_cat_salud_farmacia', name: 'Farmacia', icon: 'fa-pills' },
                { id: 'sub_cat_salud_prepaga', name: 'Prepaga', icon: 'fa-user-nurse', kind: 'fixed' },
                { id: 'sub_cat_salud_turnos', name: 'Turnos', icon: 'fa-stethoscope' },
                { id: 'sub_cat_salud_gimnasio', name: 'Gimnasio', icon: 'fa-dumbbell', kind: 'fixed' }
            ]
        },
        {
            id: 'cat_educ', name: 'Educación', icon: 'fa-graduation-cap', color: '#2C3E50', type: 'expense', kind: 'fixed',
            subcategories: [
                { id: 'sub_cat_educ_cursos', name: 'Cursos', icon: 'fa-laptop' },
                { id: 'sub_cat_educ_universidad', name: 'Universidad', icon: 'fa-graduation-cap' },
                { id: 'sub_cat_educ_libros', name: 'Libros', icon: 'fa-book-open', kind: 'variable' }
            ]
        },
        {
            id: 'cat_servicios', name: 'Servicios', icon: 'fa-bolt', color: '#F1C40F', type: 'expense', kind: 'fixed',
            subcategories: [
                { id: 'sub_cat_servicios_luz', name: 'Luz', icon: 'fa-lightbulb' },
                { id: 'sub_cat_servicios_gas', name: 'Gas', icon: 'fa-fire' },
                { id: 'sub_cat_servicios_agua', name: 'Agua', icon: 'fa-droplet' },
                { id: 'sub_cat_servicios_internet', name: 'Internet', icon: 'fa-wifi' },
                { id: 'sub_cat_servicios_celular', name: 'Celular', icon: 'fa-mobile-alt' }
            ]
        },
        {
            id: 'cat_rapa', name: 'Ropa', icon: 'fa-tshirt', color: '#E91E63', type: 'expense', kind: 'variable',
            subcategories: [
                { id: 'sub_cat_ropa_ropa', name: 'Ropa', icon: 'fa-shirt' },
                { id: 'sub_cat_ropa_calzado', name: 'Calzado', icon: 'fa-shoe-prints' },
                { id: 'sub_cat_ropa_accesorios', name: 'Accesorios', icon: 'fa-gift' }
            ]
        },
        {
            id: 'cat_hogar', name: 'Hogar', icon: 'fa-home', color: '#795548', type: 'expense', kind: 'fixed',
            subcategories: [
                { id: 'sub_cat_hogar_limpieza', name: 'Limpieza', icon: 'fa-soap' },
                { id: 'sub_cat_hogar_cocina', name: 'Cocina', icon: 'fa-utensils' },
                { id: 'sub_cat_hogar_muebles', name: 'Muebles', icon: 'fa-couch' },
                { id: 'sub_cat_hogar_decoracion', name: 'Decoración', icon: 'fa-palette' }
            ]
        },
        { id: 'cat_otros_g', name: 'Otros gastos', icon: 'fa-tag', color: '#95A5A6', type: 'expense', kind: 'variable', subcategories: [] },
        { id: 'cat_salario', name: 'Salario', icon: 'fa-briefcase', color: '#2ECC71', type: 'income', subcategories: [] },
        { id: 'cat_freelance', name: 'Freelance', icon: 'fa-coins', color: '#27AE60', type: 'income', subcategories: [] },
        { id: 'cat_inversiones', name: 'Inversiones', icon: 'fa-chart-line', color: '#16A085', type: 'income', subcategories: [] },
        { id: 'cat_otros_i', name: 'Otros ingresos', icon: 'fa-hand-holding-usd', color: '#1ABC9C', type: 'income', subcategories: [] }
    ],

    async init() {
        if (!this._bound) {
            document.getElementById('add-category-btn')?.addEventListener('click', () => this.openModal());
            document.getElementById('category-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
            document.querySelectorAll('#category-modal .modal-close').forEach(b => b.addEventListener('click', () => this.closeModal()));
            document.querySelector('#category-modal .modal-overlay')?.addEventListener('click', () => this.closeModal());
            document.getElementById('cat-type')?.addEventListener('change', () => this.toggleKindGroup());
            document.querySelectorAll('#cat-kind-toggle .seg-opt').forEach(btn => {
                btn.addEventListener('click', () => { this.selectedKind = btn.dataset.kind; this._paintKindToggle('cat-kind-toggle', this.selectedKind); });
            });
            document.getElementById('filter-cat-kind')?.addEventListener('change', (e) => { this.gridFilter = e.target.value; this.renderGrid(); });
            this.renderIconPicker('icon-picker', this.selectedIcon, (i) => { this.selectedIcon = i; });
            this._bound = true;
        }
        if (!this._subBound) {
            document.getElementById('subcategory-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.saveSub(); });
            document.querySelectorAll('#subcategory-modal .modal-close').forEach(b => b.addEventListener('click', () => this.closeSubModal()));
            document.querySelector('#subcategory-modal .modal-overlay')?.addEventListener('click', () => this.closeSubModal());
            document.querySelectorAll('#sub-kind-toggle .seg-opt').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._subKind = btn.dataset.kind;
                    this._paintSubKindToggle(this._subKind);
                    const cat = this.getById(document.getElementById('sub-parent-id').value);
                    if (cat) this._subKindHint(cat, this._subKind);
                });
            });
            const grid = document.getElementById('categories-list');
            if (grid) { grid.addEventListener('click', (e) => this._onGridClick(e)); }
            const delModal = document.getElementById('delete-category-modal');
            if (delModal) {
                delModal.querySelectorAll('[data-delete-choice]').forEach(b => b.addEventListener('click', () => this._onDeleteChoice(b.dataset.deleteChoice)));
                delModal.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeDeleteModal());
                delModal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => this.closeDeleteModal()));
            }
            this._subBound = true;
        }
        await this.load();
    },

    _onGridClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const catId = btn.dataset.catId;
        if (action === 'edit') {
            const cat = this.getById(catId);
            if (cat) this.openModal(cat);
        } else if (action === 'delete') {
            this.delete(catId);
        } else if (action === 'toggle') {
            this.expanded[catId] = !this.expanded[catId];
            this.renderGrid();
        } else if (action === 'add-sub') {
            this.openSubModal(catId);
        } else if (action === 'edit-sub') {
            const cat = this.getById(catId);
            const sub = cat && (cat.subcategories || []).find(s => s.id === btn.dataset.subId);
            if (sub) this.openSubModal(catId, sub);
        } else if (action === 'del-sub') {
            this.deleteSub(catId, btn.dataset.subId);
        }
    },

    _paintKindToggle(containerId, value) {
        document.querySelectorAll(`#${containerId} .seg-opt`).forEach(b => b.classList.toggle('active', b.dataset.kind === value));
    },

    _paintSubKindToggle(value) {
        document.querySelectorAll('#sub-kind-toggle .seg-opt').forEach(b => b.classList.toggle('active', b.dataset.kind === value));
    },

    renderIconPicker(pickerId, current, onPick) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;
        picker.innerHTML = this.ICONS.map(i =>
            `<button type="button" class="icon-option ${i === current ? 'selected' : ''}" data-icon="${i}"><i class="fas ${i}"></i></button>`
        ).join('');
        picker.querySelectorAll('.icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                picker.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                onPick(btn.dataset.icon);
            });
        });
    },

    toggleKindGroup() {
        const isExpense = (document.getElementById('cat-type')?.value || 'expense') === 'expense';
        document.getElementById('cat-kind-group')?.classList.toggle('hidden', !isExpense);
    },

    async load() {
        try {
            const snap = await db.collection('categories').get();
            this.list = [];
            snap.forEach(doc => this.list.push({ id: doc.id, ...doc.data() }));
            if (this.list.length === 0) {
                for (const cat of this.DEFAULTS) {
                    await db.collection('categories').doc(cat.id).set({
                        name: cat.name, icon: cat.icon, color: cat.color, type: cat.type,
                        kind: cat.kind || null, subcategories: (cat.subcategories || []).map(s => ({ ...s }))
                    });
                }
                this.list = [...this.DEFAULTS];
            } else {
                await this._backfill();
            }
        } catch (e) {
            console.error('Error loading categories:', e);
            this.list = [...this.DEFAULTS];
        }
    },

    async _backfill() {
        const writes = [];
        for (const cat of this.list) {
            const patch = {};
            if (!Array.isArray(cat.subcategories)) {
                const seed = this.DEFAULTS.find(d => d.id === cat.id);
                patch.subcategories = seed && seed.subcategories
                    ? seed.subcategories.map(s => ({ ...s }))
                    : [];
            }
            if (cat.type === 'expense' && !cat.kind) {
                const seed = this.DEFAULTS.find(d => d.id === cat.id);
                patch.kind = seed && seed.kind ? seed.kind : 'variable';
            }
            if (Object.keys(patch).length === 0) continue;
            Object.assign(cat, patch);
            try {
                writes.push(db.collection('categories').doc(cat.id).update(patch).catch(e => {
                    console.error(`Backfill ${cat.id}:`, e);
                }));
            } catch (e) {
                console.error(`Backfill ${cat.id}:`, e);
            }
        }
        if (writes.length) await Promise.all(writes);
    },

    async save() {
        const id = document.getElementById('cat-id').value;
        const name = document.getElementById('cat-name').value.trim();
        const type = document.getElementById('cat-type').value;
        const color = document.getElementById('cat-color').value;
        if (!name) {
            App.toast('Poné un nombre para la categoría', 'error');
            return;
        }

        const data = { name, icon: this.selectedIcon, type, color };
        if (type === 'expense') {
            data.kind = this.selectedKind;
        } else if (firebase.firestore.FieldValue.delete) {
            data.kind = firebase.firestore.FieldValue.delete();
        }
        try {
            if (id) {
                await db.collection('categories').doc(id).update(data);
            } else {
                data.subcategories = [];
                await db.collection('categories').add(data);
            }
            App.toast('Categoría guardada', 'success');
            this.closeModal();
            await this.load();
            this.updateFilterSelect();
        } catch (e) {
            App.toast('Error al guardar', 'error');
        }
    },

    _fallbackCategoryId(cat) {
        const id = cat.type === 'income' ? 'cat_otros_i' : 'cat_otros_g';
        if (id === cat.id) return null;
        return this.getById(id) ? id : null;
    },

    async delete(id) {
        const cat = this.getById(id);
        if (!cat) return;
        try {
            const snap = await db.collection('transactions').where('categoryId', '==', id).get();
            if (snap.empty) {
                if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
                await this._commitDelete(id, [], null);
                return;
            }
            this._openDeleteModal(cat, snap.size);
        } catch (e) {
            console.error('Error al eliminar la categoría:', e);
            App.toast('Error al eliminar', 'error');
        }
    },

    _openDeleteModal(cat, count) {
        const modal = document.getElementById('delete-category-modal');
        if (!modal) return;
        this._pendingDelete = { cat, count };
        const n = count;
        const fallback = this._fallbackCategoryId(cat) ? this.getById(this._fallbackCategoryId(cat)) : null;
        document.getElementById('delete-cat-text').innerHTML =
            `<strong>${Utils.esc(cat.name)}</strong> tiene ${n} gasto${n === 1 ? '' : 's'} asociado${n === 1 ? '' : 's'}.`;
        const reassignBtn = document.getElementById('delete-cat-reassign');
        if (fallback) {
            document.getElementById('delete-cat-note').innerHTML =
                `Podés mover esos gastos a <strong>${Utils.esc(fallback.name)}</strong>, o borrar la categoría sola y dejarlos sin categoría (van a figurar como “Otros”).`;
            reassignBtn.textContent = `Mover a ${fallback.name} y eliminar`;
            reassignBtn.classList.remove('hidden');
        } else {
            document.getElementById('delete-cat-note').textContent =
                'No hay una categoría de reserva para reasignar: al eliminarla, esos gastos van a figurar como “Otros”.';
            reassignBtn.classList.add('hidden');
        }
        modal.classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('delete-category-modal')?.classList.add('hidden');
        this._pendingDelete = null;
    },

    async _onDeleteChoice(choice) {
        const pending = this._pendingDelete;
        if (!pending || choice === 'cancel') { this.closeDeleteModal(); return; }
        const cat = pending.cat;
        const catId = cat.id;
        const hadTxs = pending.count > 0;
        this.closeDeleteModal();
        try {
            let txDocs = [];
            let fallbackId = null;
            if (hadTxs) {
                const snap = await db.collection('transactions').where('categoryId', '==', catId).get();
                txDocs = snap.docs;
                if (choice === 'reassign') {
                    fallbackId = this._fallbackCategoryId(cat);
                    if (!fallbackId) {
                        App.toast('No hay categoría de reserva', 'error');
                        return;
                    }
                }
            }
            await this._commitDelete(catId, txDocs, fallbackId);
        } catch (e) {
            console.error('Error al eliminar la categoría:', e);
            App.toast('Error al eliminar', 'error');
        }
    },

    async _commitDelete(id, txDocs, fallbackId) {
        const CHUNK = 400;
        try {
            if (fallbackId && txDocs.length) {
                for (let i = 0; i < txDocs.length; i += CHUNK) {
                    const batch = db.batch();
                    txDocs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { categoryId: fallbackId, subcategoryId: '' }));
                    await batch.commit();
                }
            }
            await db.collection('categories').doc(id).delete();
            delete this.expanded[id];
            App.toast(fallbackId ? 'Categoría eliminada · gastos reasignados' : 'Categoría eliminada', 'success');
            this.closeDeleteModal();
            await this.load();
            this.updateFilterSelect();
            if (typeof Transactions !== 'undefined' && Transactions.load) await Transactions.load();
            if (typeof Dashboard !== 'undefined' && Dashboard.refresh) Dashboard.refresh();
            this.renderGrid();
        } catch (e) {
            console.error('Error al eliminar la categoría:', e);
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
            this.selectedKind = cat.type === 'expense' ? (cat.kind || 'variable') : 'variable';
        } else {
            document.getElementById('category-form').reset();
            document.getElementById('cat-id').value = '';
            document.getElementById('cat-color').value = '#6C63FF';
            this.selectedIcon = 'fa-tag';
            this.selectedKind = 'variable';
        }
        this._paintKindToggle('cat-kind-toggle', this.selectedKind);
        this.toggleKindGroup();
        this.renderIconPicker('icon-picker', this.selectedIcon, (i) => { this.selectedIcon = i; });
    },

    closeModal() {
        document.getElementById('category-modal').classList.add('hidden');
    },

    getById(id) {
        return this.list.find(c => c.id === id);
    },

    getSubcategory(categoryId, subId) {
        const cat = this.getById(categoryId);
        if (!cat || !subId) return null;
        return (cat.subcategories || []).find(s => s.id === subId) || null;
    },

    resolveKind(categoryId, subcategoryId) {
        const cat = this.getById(categoryId);
        if (!cat || cat.type !== 'expense') return null;
        const sub = this.getSubcategory(categoryId, subcategoryId);
        if (sub && sub.kind) return sub.kind;
        return cat.kind === 'fixed' ? 'fixed' : 'variable';
    },

    kindLabel(kind) {
        return kind === 'fixed' ? 'Fijo' : 'Variable';
    },

    async countSubUsage(subId) {
        const snap = await db.collection('transactions').where('subcategoryId', '==', subId).limit(1).get();
        return snap.size;
    },

    newSubId(catId, name) {
        const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
        return `sub_${catId}_${slug || Math.random().toString(36).slice(2, 8)}`;
    },

    openSubModal(catId, sub = null) {
        const cat = this.getById(catId);
        if (!cat) return;
        document.getElementById('subcategory-modal').classList.remove('hidden');
        document.getElementById('subcategory-modal-title').textContent = sub ? 'Editar Subcategoría' : `Nueva Subcategoría · ${cat.name}`;
        document.getElementById('sub-parent-id').value = catId;
        document.getElementById('sub-id').value = sub ? sub.id : '';
        document.getElementById('sub-name').value = sub ? sub.name : '';
        document.getElementById('sub-color').value = (sub && sub.color) || cat.color || '#6C63FF';
        this.selectedSubIcon = (sub && sub.icon) || cat.icon || 'fa-tag';
        const isExpense = cat.type === 'expense';
        const inheritValue = !isExpense ? 'inherit' : ((sub && sub.kind) || 'inherit');
        document.getElementById('sub-kind-group').classList.toggle('hidden', !isExpense);
        this._subKind = inheritValue;
        this._paintSubKindToggle(inheritValue);
        this._subKindHint(cat, inheritValue);
        document.getElementById('sub-inherit-hint').textContent = isExpense
            ? `Heredará "${this.kindLabel(cat.kind || 'variable')}" de ${cat.name}`
            : 'Los ingresos no se clasifican';
        this.renderIconPicker('sub-icon-picker', this.selectedSubIcon, (i) => { this.selectedSubIcon = i; });
    },

    _subKindHint(cat, value) {
        const hint = document.getElementById('sub-inherit-hint');
        if (!hint) return;
        hint.textContent = value === 'inherit'
            ? `Heredará "${this.kindLabel(cat.kind || 'variable')}" de ${cat.name}`
            : `Esta subcategoría será "${this.kindLabel(value)}"`;
    },

    closeSubModal() {
        document.getElementById('subcategory-modal').classList.add('hidden');
    },

    async saveSub() {
        const catId = document.getElementById('sub-parent-id').value;
        const subId = document.getElementById('sub-id').value;
        const cat = this.getById(catId);
        if (!cat) return;
        const name = document.getElementById('sub-name').value.trim();
        if (!name) {
            App.toast('Poné un nombre para la subcategoría', 'error');
            return;
        }
        if (name.length > this.MAX_SUBS_NAME) {
            App.toast(`Máximo ${this.MAX_SUBS_NAME} caracteres`, 'error');
            return;
        }
        const subs = (cat.subcategories || []).slice();
        const normalized = name.toLowerCase();
        if (subs.some(s => s.id !== subId && s.name.trim().toLowerCase() === normalized)) {
            App.toast('Ya existe una subcategoría con ese nombre', 'error');
            return;
        }
        if (!subId && subs.length >= this.MAX_SUBS) {
            App.toast(`Máximo ${this.MAX_SUBS} subcategorías por categoría`, 'error');
            return;
        }

        const kind = cat.type === 'expense' ? (this._subKind || 'inherit') : 'inherit';
        const entry = {
            id: subId || this.newSubId(catId, name),
            name,
            icon: this.selectedSubIcon,
            color: document.getElementById('sub-color').value
        };
        if (kind !== 'inherit') entry.kind = kind;

        const next = subId
            ? subs.map(s => (s.id === subId ? entry : s))
            : subs.concat([entry]);

        try {
            await db.collection('categories').doc(catId).update({ subcategories: next });
            App.toast('Subcategoría guardada', 'success');
            this.expanded[catId] = true;
            this.closeSubModal();
            await this.load();
            this.renderGrid();
        } catch (e) {
            console.error('Error al guardar la subcategoría:', e);
            App.toast('Error al guardar la subcategoría', 'error');
        }
    },

    async deleteSub(catId, subId) {
        const cat = this.getById(catId);
        const sub = this.getSubcategory(catId, subId);
        if (!cat || !sub) return;
        if (!confirm(`¿Eliminar la subcategoría "${sub.name}"?`)) return;
        try {
            const usage = await this.countSubUsage(subId);
            if (usage > 0) {
                App.toast('No se puede eliminar: hay gastos usando esta subcategoría', 'error');
                return;
            }
            const next = (cat.subcategories || []).filter(s => s.id !== subId);
            await db.collection('categories').doc(catId).update({ subcategories: next });
            App.toast('Subcategoría eliminada', 'success');
            await this.load();
            this.renderGrid();
        } catch (e) {
            console.error('Error al eliminar la subcategoría:', e);
            App.toast('Error al eliminar', 'error');
        }
    },

    updateFilterSelect() {
        const sel = document.getElementById('filter-category');
        if (!sel) return;
        const val = sel.value;
        sel.innerHTML = '<option value="all">Todas</option>' + this.renderSelects();
        sel.value = val;
        if (sel.value !== val) sel.value = 'all';
    },

    renderSelects(filterType) {
        const filtered = filterType
            ? this.list.filter(c => c.type === filterType || c.type === 'both')
            : this.list;
        return filtered.map(c => `<option value="${c.id}">${Utils.esc(c.name)}</option>`).join('');
    },

    _matchesGridFilter(cat) {
        if (this.gridFilter === 'all') return true;
        if (this.gridFilter === 'income') return cat.type === 'income';
        return cat.type === 'expense' && (cat.kind || 'variable') === this.gridFilter;
    },

    _kindBadge(cat) {
        if (cat.type === 'income') return `<span class="cat-badge">Ingreso</span>`;
        const kind = cat.kind || 'variable';
        return `<span class="cat-badge kind-${kind}"><i class="fas ${kind === 'fixed' ? 'fa-lock' : 'fa-wave-square'}"></i> ${this.kindLabel(kind)}</span>`;
    },

    _subItemHtml(cat, sub) {
        const kind = sub.kind || cat.kind || 'variable';
        const override = sub.kind ? '' : ' · heredada';
        return `
            <div class="sub-item" style="--sub-color:${sub.color || cat.color}">
                <i class="fas ${sub.icon || 'fa-tag'} sub-icon"></i>
                <span class="sub-name">${Utils.esc(sub.name)}</span>
                <span class="kind-pill kind-${kind}">${this.kindLabel(kind)}${override}</span>
                <span class="sub-actions">
                    <button class="icon-btn" data-action="edit-sub" data-cat-id="${cat.id}" data-sub-id="${sub.id}" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn danger" data-action="del-sub" data-cat-id="${cat.id}" data-sub-id="${sub.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </span>
            </div>`;
    },

    renderGrid() {
        const container = document.getElementById('categories-list');
        if (!container) return;
        const filterSel = document.getElementById('filter-cat-kind');
        if (filterSel && filterSel.value !== this.gridFilter) filterSel.value = this.gridFilter;

        const visible = this.list.filter(c => this._matchesGridFilter(c));
        if (visible.length === 0) {
            container.innerHTML = this.list.length === 0
                ? '<div class="empty"><i class="fas fa-tags"></i><p>Sin categorías</p></div>'
                : '<div class="empty"><i class="fas fa-filter"></i><p>Ninguna categoría en este filtro</p></div>';
            return;
        }

        container.innerHTML = visible.map(c => {
            const subs = c.subcategories || [];
            const isOpen = !!this.expanded[c.id];
            const isExpense = c.type === 'expense';
            return `
            <div class="cat-card${isOpen ? ' expanded' : ''}" style="border-top:3px solid ${c.color}">
                <div class="cat-actions">
                    <button class="icon-btn" data-action="edit" data-cat-id="${c.id}" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn danger" data-action="delete" data-cat-id="${c.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
                <div class="cat-icon" style="color:${c.color}"><i class="fas ${c.icon}"></i></div>
                <div class="cat-name">${Utils.esc(c.name)}</div>
                ${this._kindBadge(c)}
                <button class="subs-toggle${isOpen ? ' open' : ''}" data-action="toggle" data-cat-id="${c.id}">
                    <i class="fas fa-chevron-down"></i>
                    ${subs.length} sub${subs.length === 1 ? '' : 's'}
                </button>
                <div class="cat-subs${isOpen ? '' : ' hidden'}">
                    <div class="subs-head">
                        <span class="muted">Subcategorías</span>
                        ${isExpense ? `<button class="btn btn-ghost btn-sm" data-action="add-sub" data-cat-id="${c.id}"><i class="fas fa-plus"></i> Agregar</button>` : '<span class="muted">No aplican a ingresos</span>'}
                    </div>
                    ${subs.length === 0
                        ? '<p class="subs-empty">Sin subcategorías</p>'
                        : subs.map(s => this._subItemHtml(c, s)).join('')}
                </div>
            </div>`;
        }).join('');
    }
};
