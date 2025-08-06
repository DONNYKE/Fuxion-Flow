import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Edit, Trash2, DollarSign, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Inventory = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);

  const [productName, setProductName] = useState('');
  const [productQuantity, setProductQuantity] = useState(0);
  const [productPrice, setProductPrice] = useState(0);
  const [productPoints, setProductPoints] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) console.error('Error fetching products:', error.message);
    setProducts(data || []);
    setLoading(false);
  };

  const handleAddProductClick = () => {
    setCurrentProduct(null);
    setProductName('');
    setProductQuantity(0);
    setProductPrice(0);
    setProductPoints(0);
    setShowProductModal(true);
  };

  const handleEditProductClick = (product) => {
    setCurrentProduct(product);
    setProductName(product.name);
    setProductQuantity(product.quantity);
    setProductPrice(product.price_per_unit);
    setProductPoints(product.points_per_unit);
    setShowProductModal(true);
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para gestionar el inventario.');
      setLoading(false);
      return;
    }
    const userId = user.id;

    const productData = {
      name: productName,
      quantity: productQuantity,
      price_per_unit: productPrice,
      points_per_unit: productPoints,
      user_id: userId
    };

    if (currentProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', currentProduct.id)
        .eq('user_id', userId);
      if (error) console.error('Error updating product:', error.message);
    } else {
      const { error } = await supabase
        .from('products')
        .insert(productData);
      if (error) console.error('Error adding product:', error.message);
    }

    setShowProductModal(false);
    fetchProducts();
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto? Esto no es reversible y podría afectar pedidos asociados.')) {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión para eliminar productos.');
        setLoading(false);
        return;
      }
      const userId = user.id;

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting product:', error.message);
        alert('No se pudo eliminar el producto. Asegúrate de que no esté asociado a pedidos o préstamos activos.');
      } else {
        fetchProducts();
      }
      setLoading(false);
    }
  };

  const totalInventoryValue = products.reduce((sum, product) => sum + (product.quantity * product.price_per_unit), 0);
  const totalInventoryPoints = products.reduce((sum, product) => sum + (product.quantity * product.points_per_unit), 0);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <motion.h1
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-teal-600"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Gestión de Inventario
      </motion.h1>

      {/* Botón para Añadir Producto */}
      <motion.button
        onClick={handleAddProductClick}
        className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 mb-6"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Plus className="w-5 h-5" />
        Añadir Nuevo Producto
      </motion.button>

      {/* Lista de Productos */}
      <div className="space-y-3">
        {products.length === 0 ? (
          <p className="text-gray-500 text-center py-3 bg-white/80 rounded-2xl shadow-sm">
            No hay productos en el inventario. ¡Es hora de abastecerse!
          </p>
        ) : (
          <AnimatePresence>
            {products.map((product) => (
              <motion.div
                key={product.id}
                className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-4 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{product.name}</h3>
                    <p className="text-gray-600 text-sm">Cantidad: {product.quantity}</p>
                    <p className="text-gray-600 text-sm">Precio por unidad: S/. {product.price_per_unit.toFixed(2)}</p>
                    <p className="text-gray-600 text-sm">Puntos por unidad: {product.points_per_unit}</p>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => handleEditProductClick(product)}
                      className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-500" /> Total Puntos: {product.quantity * product.points_per_unit}
                  </p>
                  <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-green-500" /> Valor Total: S/. {(product.quantity * product.price_per_unit).toFixed(2)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {products.length > 0 && (
          <motion.div
            className="mt-4 pt-3 border-t border-gray-200/50 flex justify-between items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div>
              <p className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
                <Star className="w-5 h-5 text-yellow-500" /> Total Puntos Inventario: {totalInventoryPoints.toFixed(2)}
              </p>
              <p className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
                <DollarSign className="w-5 h-5 text-green-500" /> Valor Total Inventario: S/. {totalInventoryValue.toFixed(2)}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal de Añadir/Editar Producto */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-5">
                {currentProduct ? 'Editar Producto' : 'Añadir Nuevo Producto'}
              </h3>
              <form onSubmit={handleSubmitProduct} className="space-y-4">
                <div>
                  <label htmlFor="productName" className="block text-gray-700 font-medium mb-1.5">Nombre del Producto:</label>
                  <input
                    id="productName"
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="productQuantity" className="block text-gray-700 font-medium mb-1.5">Cantidad:</label>
                  <input
                    id="productQuantity"
                    type="number"
                    value={productQuantity}
                    onChange={(e) => setProductQuantity(parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="productPrice" className="block text-gray-700 font-medium mb-1.5">Precio por Unidad (S/.):</label>
                  <input
                    id="productPrice"
                    type="number"
                    step="0.01"
                    value={productPrice}
                    onChange={(e) => setProductPrice(parseFloat(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="productPoints" className="block text-gray-700 font-medium mb-1.5">Puntos por Unidad:</label>
                  <input
                    id="productPoints"
                    type="number"
                    value={productPoints}
                    onChange={(e) => setProductPoints(parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <motion.button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {currentProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Inventory;
