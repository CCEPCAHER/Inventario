// app.js
// Importa las funciones necesarias de Firestore
import {
    getFirestore,
    collection,
    addDoc,
    setDoc,
    updateDoc,
    getDocs,
    doc,
    deleteDoc
  } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
  
  class InventoryApp {
      constructor() {
          // Inicializa Firestore
          this.db = getFirestore();
          // Inicializa arrays vacíos (los datos se cargarán desde Firestore)
          this.products = [];
          this.movements = [];
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
          document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.remove('active');
          });
          document.querySelectorAll('.tabs button').forEach(button => {
              button.classList.remove('active');
          });
          document.getElementById(tabId).classList.add('active');
          document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
          
          if(tabId === 'movimientos') await this.loadMovements();
          if(tabId === 'reportes') this.updateChart();
      }
  
      // PRODUCTOS
      async saveProduct(e) {
          e.preventDefault();
          // Obtiene los datos del formulario
          const product = {
              name: document.getElementById('productName').value,
              category: document.getElementById('productCategory').value,
              stock: parseInt(document.getElementById('productStock').value),
              minStock: parseInt(document.getElementById('productMinStock').value),
              price: parseFloat(document.getElementById('productPrice').value)
          };
  
          const productIdField = document.getElementById('productId').value;
          try {
              if (productIdField) {
                  // Actualización: usa updateDoc y mantiene el mismo ID
                  await updateDoc(doc(this.db, "productos", productIdField), product);
              } else {
                  // Nuevo producto: usa addDoc para que Firestore genere un ID único
                  const docRef = await addDoc(collection(this.db, "productos"), product);
                  // Opcional: asigna el ID generado al objeto para usarlo en la UI
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
              querySnapshot.forEach((docSnap) => {
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
  
      // MOVIMIENTOS
      async saveMovement(e) {
          e.preventDefault();
          // Obtiene los datos del formulario
          const movement = {
              productId: document.getElementById('movementProduct').value,
              type: document.getElementById('movementType').value,
              quantity: parseInt(document.getElementById('movementQuantity').value),
              date: document.getElementById('movementDate').value,
              notes: document.getElementById('movementNotes').value
          };
  
          try {
              // Agrega el movimiento (Firestore generará un ID único)
              await addDoc(collection(this.db, "movimientos"), movement);
              // Actualiza el stock del producto
              const productRef = doc(this.db, "productos", movement.productId);
              const product = this.products.find(p => p.id === movement.productId);
              if (!product) throw new Error("Producto no encontrado");
              const newStock = movement.type === 'entry'
                                ? product.stock + movement.quantity
                                : product.stock - movement.quantity;
              // Actualiza el producto en Firestore
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
              querySnapshot.forEach((docSnap) => {
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
  
      // Elimina el producto tanto en Firestore como en la UI
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
  
  // Funciones globales para manejar modales y edición
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
      if(product) {
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
      if(confirm('¿Eliminar este producto?')) {
          await app.deleteProduct(id);
      }
  };
  
  // Asocia los eventos de envío de formularios
  window.handleProductSubmit = function(e) {
      app.saveProduct(e);
  };
  
  window.handleMovementSubmit = function(e) {
      app.saveMovement(e);
  };
// Inicia la aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', initializeApp);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log("Service Worker registrado"))
    .catch(err => console.log("Error en Service Worker:", err));
}
  
