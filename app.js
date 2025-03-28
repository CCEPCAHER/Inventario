// app.js
class InventoryApp {
    constructor() {
        this.products = JSON.parse(localStorage.getItem('products')) || [];
        this.movements = JSON.parse(localStorage.getItem('movements')) || [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showTab('inventario');
        this.loadProducts();
        this.updateReports();
    }

    setupEventListeners() {
        document.querySelectorAll('.tabs button').forEach(button => {
            button.addEventListener('click', () => this.showTab(button.dataset.tab));
        });
    }

    showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelectorAll('.tabs button').forEach(button => {
            button.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        
        if(tabId === 'movimientos') this.loadMovements();
        if(tabId === 'reportes') this.updateChart();
    }

    // Productos
    saveProduct(e) {
        e.preventDefault();
        const product = {
            id: document.getElementById('productId').value || Date.now().toString(),
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            stock: parseInt(document.getElementById('productStock').value),
            minStock: parseInt(document.getElementById('productMinStock').value),
            price: parseFloat(document.getElementById('productPrice').value)
        };

        const index = this.products.findIndex(p => p.id === product.id);
        if(index > -1) {
            this.products[index] = product;
        } else {
            this.products.push(product);
        }

        this.saveData();
        this.loadProducts();
        closeModals();
    }

    loadProducts() {
        const list = document.getElementById('product-list');
        list.innerHTML = '';
        
        this.products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <h3>${product.name}</h3>
                <p>Categoría: ${product.category}</p>
                <p>Stock: <span class="${product.stock <= product.minStock ? 'critical' : ''}">${product.stock}</span></p>
                <p>Mínimo: ${product.minStock}</p>
                <p>Precio: $${product.price.toFixed(2)}</p>
                <div class="actions">
                    <button onclick="editProduct('${product.id}')">✏️</button>
                    <button onclick="deleteProduct('${product.id}')">🗑️</button>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // Movimientos
    saveMovement(e) {
        e.preventDefault();
        const movement = {
            id: Date.now(),
            productId: document.getElementById('movementProduct').value,
            type: document.getElementById('movementType').value,
            quantity: parseInt(document.getElementById('movementQuantity').value),
            date: document.getElementById('movementDate').value,
            notes: document.getElementById('movementNotes').value
        };

        const product = this.products.find(p => p.id === movement.productId);
        if(movement.type === 'entry') {
            product.stock += movement.quantity;
        } else {
            product.stock -= movement.quantity;
        }

        this.movements.push(movement);
        this.saveData();
        this.loadMovements();
        closeModals();
    }

    loadMovements() {
        const list = document.getElementById('movement-list');
        list.innerHTML = '';
        
        this.movements.forEach(movement => {
            const product = this.products.find(p => p.id === movement.productId);
            const item = document.createElement('div');
            item.className = 'movement-item';
            item.innerHTML = `
                <p><strong>${product.name}</strong></p>
                <p>Tipo: ${movement.type === 'entry' ? '📥 Entrada' : '📤 Salida'}</p>
                <p>Cantidad: ${movement.quantity}</p>
                <p>Fecha: ${new Date(movement.date).toLocaleDateString()}</p>
                ${movement.notes ? `<p>Notas: ${movement.notes}</p>` : ''}
            `;
            list.appendChild(item);
        });
    }

    // Reportes
    updateReports() {
        const criticalProducts = this.products.filter(p => p.stock <= p.minStock);
        document.getElementById('critical-count').textContent = criticalProducts.length;

        const totalValue = this.products.reduce((sum, p) => sum + (p.stock * p.price), 0);
        document.getElementById('total-value').textContent = totalValue.toFixed(2);
    }

    updateChart() {
        const ctx = document.getElementById('stockChart').getContext('2d');
        const labels = this.products.map(p => p.name);
        const data = this.products.map(p => p.stock);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Stock Actual',
                    data: data,
                    backgroundColor: '#4CAF50'
                }]
            }
        });
    }

    saveData() {
        localStorage.setItem('products', JSON.stringify(this.products));
        localStorage.setItem('movements', JSON.stringify(this.movements));
        this.updateReports();
    }
}

// Funciones globales
let app = new InventoryApp();

function showProductModal() {
    document.getElementById('productModal').style.display = 'flex';
    // Limpiar formulario
    document.getElementById('productId').value = '';
    document.getElementById('productForm').reset();
}
function showMovementModal() {
    document.getElementById('movementModal').style.display = 'flex';
    const productSelect = document.getElementById('movementProduct');
    productSelect.innerHTML = '<option value="">Seleccionar Producto</option>' + 
        app.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
        modal.querySelector('form').reset();
    });
}

function editProduct(id) {
    const product = app.products.find(p => p.id === id);
    if(product) {
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productMinStock').value = product.minStock;
        document.getElementById('productPrice').value = product.price;
        showProductModal();
    }
}

function deleteProduct(id) {
    if(confirm('¿Eliminar este producto?')) {
        app.products = app.products.filter(p => p.id !== id);
        app.saveData();
        app.loadProducts();
    }
}
// Agregar después de deleteProduct
function handleProductSubmit(e) {
    app.saveProduct(e);
}

function handleMovementSubmit(e) {
    app.saveMovement(e);
}
