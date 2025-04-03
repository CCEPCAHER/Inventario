// Importa funciones de Firestore y Storage
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";

// Importa Chart.js
import Chart from "https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.esm.js";

class InventoryApp {
  constructor() {
    // Inicializa Firestore y Storage
    this.db = getFirestore();
    this.storage = getStorage();
    // Arreglos para almacenar productos y movimientos
    this.products = [];
    this.movements = [];
    // Variable para la gráfica
    this.chart = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.showTab('inventario');
    await this.loadProducts();
    await this.loadMovements();
    this.updateReports();
  }

  setupEventListeners() {
    document.querySelectorAll('.tabs button').forEach(button => {
      button.addEventListener('click', () => this.showTab(button.dataset.tab));
    });
  }

  async showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(button => button.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    if (tabId === 'movimientos') await this.loadMovements();
    if (tabId === 'reportes') this.updateChart();
  }

  // PRODUCTOS
  async saveProduct(e) {
    e.preventDefault();
    // Obtiene datos del formulario
    const product = {
      name: document.getElementById('productName').value,
      category: document.getElementById('productCategory').value,
      stock: parseInt(document.getElementById('productStock').value),
      minStock: parseInt(document.getElementById('productMinStock').value),
      price: parseFloat(document.getElementById('productPrice').value)
    };

    // Si se ha seleccionado una imagen, se sube a Storage
    const fileInput = document.getElementById('productImage');
    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const storageRef = ref(this.storage, 'productos/' + Date.now() + '_' + file.name);
      try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        product.imageUrl = downloadURL;
      } catch (error) {
        console.error("Error subiendo la imagen:", error);
      }
    }

    const productIdField = document.getElementById('productId').value;
    try {
      if (productIdField) {
        // Actualización del producto
        await updateDoc(doc(this.db, "productos", productIdField), product);
      } else {
        // Nuevo producto
        const docRef = await addDoc(collection(this.db, "productos"), product);
        product.id = docRef.id;
      }
      await this.loadProducts();
      closeModals();
    } catch (error) {
      console.error("Error guardando el producto:", error);
    }
  }

  async loadProducts() {
    try {
      const querySnapshot = await getDocs(collection(this.db, "productos"));
      this.products = [];
      querySnapshot.forEach(docSnap => {
        let product = docSnap.data();
        product.id = docSnap.id;
        this.products.push(product);
      });
      this.renderProducts();
      this.updateReports();
    } catch (error) {
      console.error("Error cargando productos:", error);
    }
  }

  renderProducts() {
    const list = document.getElementById('product-list');
    list.innerHTML = '';
    this.products.forEach(product => {
      const item = document.createElement('div');
      item.className = 'product-item';
      // Muestra la imagen si existe
      const imageHTML = product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" width="100">` : '';
      item.innerHTML = `
        ${imageHTML}
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

  // MOVIMIENTOS
  async saveMovement(e) {
    e.preventDefault();
    const movement = {
      productId: document.getElementById('movementProduct').value,
      type: document.getElementById('movementType').value,
      quantity: parseInt(document.getElementById('movementQuantity').value),
      date: document.getElementById('movementDate').value,
      notes: document.getElementById('movementNotes').value
    };
    try {
      await addDoc(collection(this.db, "movimientos"), movement);
      // Actualiza el stock del producto
      const productRef = doc(this.db, "productos", movement.productId);
      const product = this.products.find(p => p.id === movement.productId);
      if (!product) throw new Error("Producto no encontrado");
      const newStock = movement.type === 'entry'
        ? product.stock + movement.quantity
        : product.stock - movement.quantity;
      await updateDoc(productRef, { stock: newStock });
      await this.loadProducts();
      await this.loadMovements();
      closeModals();
    } catch (error) {
      console.error("Error guardando el movimiento:", error);
    }
  }

  async loadMovements() {
    try {
      const querySnapshot = await getDocs(collection(this.db, "movimientos"));
      this.movements = [];
      querySnapshot.forEach(docSnap => {
        let movement = docSnap.data();
        movement.id = docSnap.id;
        this.movements.push(movement);
      });
      this.renderMovements();
    } catch (error) {
      console.error("Error cargando movimientos:", error);
    }
  }

  renderMovements() {
    const list = document.getElementById('movement-list');
    list.innerHTML = '';
    this.movements.forEach(movement => {
      const product = this.products.find(p => p.id === movement.productId);
      const item = document.createElement('div');
      item.className = 'movement-item';
      item.innerHTML = `
        <p><strong>${product ? product.name : "Producto desconocido"}</strong></p>
        <p>Tipo: ${movement.type === 'entry' ? '📥 Entrada' : '📤 Salida'}</p>
        <p>Cantidad: ${movement.quantity}</p>
        <p>Fecha: ${new Date(movement.date).toLocaleDateString()}</p>
        ${movement.notes ? `<p>Notas: ${movement.notes}</p>` : ''}
      `;
      list.appendChild(item);
    });
  }

  // REPORTES Y GRÁFICAS
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

    // Destruye la gráfica anterior si existe
    if (this.chart) this.chart.destroy();

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Stock Actual',
          data: data,
          backgroundColor: '#4CAF50'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // Elimina producto
  async deleteProduct(id) {
    try {
      await deleteDoc(doc(this.db, "productos", id));
      await this.loadProducts();
    } catch (error) {
      console.error("Error eliminando el producto:", error);
    }
  }
}

// Instancia global de la app
let app = new InventoryApp();

// Funciones globales para el manejo de modales y edición
window.showProductModal = function() {
  document.getElementById('productModal').style.display = 'flex';
  document.getElementById('productId').value = '';
  document.getElementById('productForm').reset();
};

window.showMovementModal = function() {
  document.getElementById('movementModal').style.display = 'flex';
  const productSelect = document.getElementById('movementProduct');
  productSelect.innerHTML = '<option value="">Seleccionar Producto</option>' +
    app.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
};

window.closeModals = function() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
    modal.querySelector('form').reset();
  });
};

window.editProduct = function(id) {
  const product = app.products.find(p => p.id === id);
  if (product) {
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productMinStock').value = product.minStock;
    document.getElementById('productPrice').value = product.price;
    showProductModal();
  }
};

window.deleteProduct = async function(id) {
  if (confirm('¿Eliminar este producto?')) {
    await app.deleteProduct(id);
  }
};

window.handleProductSubmit = function(e) {
  app.saveProduct(e);
};

window.handleMovementSubmit = function(e) {
  app.saveMovement(e);
};

document.addEventListener('DOMContentLoaded', () => {
  console.log("Aplicación iniciada");
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log("Service Worker registrado"))
    .catch(err => console.log("Error en Service Worker:", err));
}