const Transactions = {
    list: [],

    async init() {
        this.bindEvents();
        await this.load();
    },

    bindEvents() {
        document.getElementById('tx-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
        document.getElementById('tx-cancel').addEventListener('click', () => { this.resetForm(); App.navigate('gastos'); });

        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateCategorySelect();
            });
        });

        document.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const m = btn.dataset.method;
                document.getElementById('installment-fields').classList.toggle('hidden', m !== 'credito');
                this.updatePreview();
            });
        });

        document.getElementById('tx-installments')?.addEventListener('change', () => this.updatePreview());
        document.getElementById('tx-amount')?.addEventListener('input', () => this.updatePreview());

        document.getElementById('tx-receipt')?.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (f) {
                const p = document.getElementById('receipt-preview');
                p.src = URL.createObjectURL(f);
                p.classList.remove('hidden');
            }
        });

        ['filter-type', 'filter-category', 'filter-user', 'filter-date'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.renderList());
        });
    },

    updateCategorySelect() {
        const type = document.querySelector('.type-btn.active')?.dataset.type;
        const sel = document.getElementById('tx-category');
        sel.innerHTML = Categories.renderSelects(type === 'income' ? 'income' : 'expense');
    },

    updatePreview() {
        const amt = parseFloat(document.getElementById('tx-amount').value) || 0;
        const inst = parseInt(document.getElementById('tx-installments').value) || 1;
        const el = document.getElementById('installment-preview');
        el.textContent = (amt > 0 && inst > 1)
            ? `${inst} cuotas de ${Utils.formatMoney(amt / inst)}`
            : '';
    },

    async load() {
        try {
            const snap = await db.collection('transactions').orderBy('date', 'desc').limit(500).get();
            this.list = [];
            snap.forEach(doc => this.list.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('Error loading transactions:', e);
            this.list = [];
        }
        this.renderList();
    },

    async save() {
        const id = document.getElementById('tx-id').value;
        const type = document.querySelector('.type-btn.active').dataset.type;
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const categoryId = document.getElementById('tx-category').value;
        const description = document.getElementById('tx-description').value.trim();
        const date = document.getElementById('tx-date').value;
        const paymentMethod = document.querySelector('.pay-btn.active').dataset.method;
        const installments = paymentMethod === 'credito' ? (parseInt(document.getElementById('tx-installments').value) || 1) : 1;

        if (!amount || !categoryId || !date) {
            App.toast('Completá todos los campos', 'error');
            return;
        }

        try {
            if (id) {
                const paid = paymentMethod === 'debito';
                const data = { type, amount, categoryId, description, date, paymentMethod, paid, userId: Auth.currentUser, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
                await db.collection('transactions').doc(id).update(data);
            } else if (installments > 1 && paymentMethod === 'credito') {
                const installmentAmount = amount / installments;
                for (let i = 1; i <= installments; i++) {
                    await db.collection('transactions').add({
                        type, amount: installmentAmount, categoryId, description, date,
                        paymentMethod, paid: false,
                        installments, installmentNum: i,
                        userId: Auth.currentUser,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else {
                const paid = paymentMethod === 'debito';
                const data = { type, amount, categoryId, description, date, paymentMethod, paid, userId: Auth.currentUser, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
                const ref = await db.collection('transactions').add(data);
                const receiptFile = document.getElementById('tx-receipt').files[0];
                if (receiptFile) {
                    const receiptUrl = await StorageManager.upload(receiptFile, ref.id);
                    await db.collection('transactions').doc(ref.id).update({ receiptUrl });
                }
            }

            App.toast('Guardado', 'success');
            const userName = Auth.currentUser === 'nadia' ? 'Nadia' : 'Elias';
            const typeLabel = type === 'expense' ? 'Gasto' : 'Ingreso';
            const cat = Categories.getById(categoryId);
            const detail = installments > 1 ? `${description || (cat ? cat.name : '')} · ${installments} cuotas de ${Utils.formatMoney(amount / installments)}` : `${description || (cat ? cat.name : '')} · ${Utils.formatMoney(amount)}`;
            Notifications.add('transaction', `${userName} - ${typeLabel}`, detail);
            this.resetForm();
            await this.load();
            App.navigate('gastos');
        } catch (e) {
            App.toast('Error al guardar', 'error');
        }
    },

    async deleteTx(id) {
        if (!confirm('¿Eliminar transacción?')) return;
        try {
            await db.collection('transactions').doc(id).delete();
            App.toast('Eliminada', 'success');
            await this.load();
        } catch (e) {
            App.toast('Error al eliminar', 'error');
        }
    },

    async markPaid(id) {
        try {
            await db.collection('transactions').doc(id).update({ paid: true });
            App.toast('Marcado como pagado', 'success');
            await this.load();
            App.refreshPage(App.currentPage);
        } catch (e) {
            App.toast('Error al pagar', 'error');
        }
    },

    async markAllGroupPaid(description, userId) {
        const pending = this.list.filter(tx =>
            tx.description === description && tx.userId === userId && tx.paid === false && tx.installments > 1
        );
        if (pending.length === 0) return;
        if (!confirm(`¿Pagar las ${pending.length} cuotas pendientes?`)) return;
        try {
            for (const tx of pending) {
                await db.collection('transactions').doc(tx.id).update({ paid: true });
            }
            App.toast(`${pending.length} cuota(s) pagada(s)`, 'success');
            await this.load();
            App.refreshPage(App.currentPage);
        } catch (e) {
            App.toast('Error al pagar', 'error');
        }
    },

    editTx(tx) {
        App.navigate('nuevo-gasto');
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-form-title').textContent = 'Editar Transacción';

        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.type-btn[data-type="${tx.type}"]`).classList.add('active');
        this.updateCategorySelect();

        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-description').value = tx.description || '';
        document.getElementById('tx-date').value = tx.date;

        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        const method = tx.paymentMethod || (tx.paid !== false ? 'debito' : 'credito');
        document.querySelector(`.pay-btn[data-method="${method}"]`)?.classList.add('active');
        document.getElementById('installment-fields').classList.toggle('hidden', method !== 'credito');

        if (tx.installments > 1) {
            document.getElementById('tx-installments').value = tx.installments;
            document.getElementById('tx-amount').value = tx.amount * tx.installments;
            this.updatePreview();
        }

        setTimeout(() => {
            document.getElementById('tx-category').value = tx.categoryId;
        }, 100);

        if (tx.receiptUrl) {
            const p = document.getElementById('receipt-preview');
            p.src = tx.receiptUrl;
            p.classList.remove('hidden');
        }
    },

    resetForm() {
        document.getElementById('tx-form').reset();
        document.getElementById('tx-id').value = '';
        document.getElementById('tx-form-title').textContent = 'Nuevo Gasto';
        document.getElementById('receipt-preview').classList.add('hidden');
        document.getElementById('installment-fields').classList.add('hidden');
        document.getElementById('installment-preview').textContent = '';
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.type-btn[data-type="expense"]').classList.add('active');
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.pay-btn[data-method="debito"]').classList.add('active');
        this.updateCategorySelect();
    },

    getFiltered() {
        const type = document.getElementById('filter-type')?.value || 'all';
        const cat = document.getElementById('filter-category')?.value || 'all';
        const user = document.getElementById('filter-user')?.value || 'all';
        const date = document.getElementById('filter-date')?.value || '';
        return this.list.filter(tx => {
            if (type !== 'all' && tx.type !== type) return false;
            if (cat !== 'all' && tx.categoryId !== cat) return false;
            if (user !== 'all' && tx.userId !== user) return false;
            if (date && !tx.date.startsWith(date)) return false;
            return true;
        });
    },

    getMonthTxs(year, month) {
        const p = `${year}-${String(month).padStart(2, '0')}`;
        return this.list.filter(tx => tx.date.startsWith(p));
    },

    getCurrentMonthTxs() {
        const n = new Date();
        return this.getMonthTxs(n.getFullYear(), n.getMonth() + 1);
    },

    getUnpaidExpenses() {
        return this.list.filter(tx => tx.type === 'expense' && tx.paid === false);
    },

    renderList() {
        const container = document.getElementById('transactions-list');
        if (!container) return;
        const filtered = this.getFiltered();
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty"><i class="fas fa-exchange-alt"></i><p>Sin transacciones</p></div>';
            return;
        }
        container.innerHTML = filtered.map(tx => {
            const cat = Categories.getById(tx.categoryId);
            const catColor = cat ? cat.color : '#95A5A6';
            const catIcon = cat ? cat.icon : 'fa-tag';
            const userName = tx.userId === 'nadia' ? 'Nadia' : 'Elias';
            const userColor = tx.userId === 'nadia' ? 'var(--nadia)' : 'var(--elias)';
            const paidBadge = tx.paid === false ? '<span class="pending-badge">Pendiente</span>' : '';
            const instBadge = tx.installments > 1 ? ` <span class="inst-badge">Cuota ${tx.installmentNum}/${tx.installments}</span>` : '';

            return `
                <div class="tx-item">
                    <div class="tx-icon" style="background:${catColor}"><i class="fas ${catIcon}"></i></div>
                    <div class="tx-info">
                        <div class="tx-desc">${tx.description || (cat ? cat.name : '')} ${paidBadge}${instBadge}</div>
                        <div class="tx-meta">
                            <span class="user-dot" style="background:${userColor}"></span> ${userName}
                            · ${cat ? cat.name : ''}
                        </div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-value ${tx.type}">${tx.type === 'income' ? '+' : '-'}${Utils.formatMoney(tx.amount)}</div>
                        <div class="tx-date">${Utils.formatDate(tx.date)}</div>
                    </div>
                    <div class="tx-actions">
                        <button class="icon-btn" data-edit="${tx.id}"><i class="fas fa-pen"></i></button>
                        <button class="icon-btn danger" data-del="${tx.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tx = this.list.find(t => t.id === btn.dataset.edit);
                if (tx) this.editTx(tx);
            });
        });
        container.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTx(btn.dataset.del);
            });
        });
    }
};