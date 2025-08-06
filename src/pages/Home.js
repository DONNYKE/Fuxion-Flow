import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CheckCircle, XCircle, Truck, History, Phone, MessageSquare, DollarSign, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseISO, isBefore, subDays, isValid } from 'date-fns';

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  // Formulario de nuevo pedido
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([{ productId: '', quantity: 1 }]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [isPaidNewOrder, setIsPaidNewOrder] = useState(true); // Nuevo estado para el checkbox de pago

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser(); // Obtener el usuario actual
    if (!user) {
      setLoading(false);
      // Si no hay usuario, no se pueden cargar datos específicos del usuario
      // Puedes mostrar un mensaje o redirigir si es necesario
      return; 
    }

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id); // Filtrar por user_id
    if (productsError) console.error('Error fetching products:', productsError.message);
    setProducts(productsData || []);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*), customers(id, name, phone_number)')
      .eq('user_id', user.id) // Filtrar por user_id
      .order('delivery_date', { ascending: true });

    if (ordersError) console.error('Error fetching orders:', ordersError.message);
    setOrders(ordersData || []);

    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id); // Filtrar por user_id

    if (customersError) console.error('Error fetching customers:', customersError.message);
    setCustomers(customersData || []);
    setLoading(false);
  };

  const calculateOrderTotals = (orderItems) => {
    let totalPoints = 0;
    let totalPrice = 0;
    orderItems.forEach(item => {
      const product = products.find(p => p.id === (item.productId || item.product_id));
      if (product) {
        totalPoints += product.points_per_unit * item.quantity;
        totalPrice += product.price_per_unit * item.quantity;
      }
    });
    return { totalPoints, totalPrice };
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    setLoading(true);
    const completedAt = status === 'delivered' ? new Date().toISOString() : null;
    const { data: { user } } = await supabase.auth.getUser();

    // Si se marca como entregado, por defecto se marca como pagado
    const updateData = { status: status, completed_at: completedAt };
    if (status === 'delivered') {
      updateData.is_paid = true; // Por defecto, pagado al entregar
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('user_id', user.id); // Asegurar que solo se actualiza la propia orden

    if (orderUpdateError) {
      console.error('Error updating order status:', orderUpdateError.message);
      setLoading(false);
      return;
    }

    if (status === 'delivered') {
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (orderToUpdate && orderToUpdate.order_items) {
        for (const item of orderToUpdate.order_items) {
          const { data: currentProductData, error: fetchProductError } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .eq('user_id', user.id) // Asegurar que solo se actualiza el propio producto
            .single();

          if (fetchProductError) {
            console.error('Error fetching current product quantity:', fetchProductError.message);
            continue;
          }

          if (currentProductData) {
            const newQuantity = currentProductData.quantity - item.quantity;
            const { error: productUpdateError } = await supabase
              .from('products')
              .update({ quantity: newQuantity })
              .eq('id', item.product_id)
              .eq('user_id', user.id); // Asegurar que solo se actualiza el propio producto
            if (productUpdateError) console.error('Error updating product quantity:', productUpdateError.message);
          }
        }
      }
    }
    await fetchData();
    setLoading(false);
  };

  const handleTogglePaidStatus = async (orderId, currentPaidStatus) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('orders')
      .update({ is_paid: !currentPaidStatus })
      .eq('id', orderId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating paid status:', error.message);
    }
    await fetchData();
    setLoading(false);
  };

  const handleAddProductToOrder = () => {
    setSelectedProducts([...selectedProducts, { productId: '', quantity: 1 }]);
  };

  const handleProductChange = (index, field, value) => {
    const newSelectedProducts = [...selectedProducts];
    newSelectedProducts[index][field] = value;
    setSelectedProducts(newSelectedProducts);
  };

  const handleRemoveProductFromOrder = (index) => {
    const newSelectedProducts = selectedProducts.filter((_, i) => i !== index);
    setSelectedProducts(newSelectedProducts);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para crear un pedido.');
      setLoading(false);
      return;
    }
    const userId = user.id;

    const { totalPoints, totalPrice } = calculateOrderTotals(selectedProducts);

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: selectedCustomer,
        delivery_date: deliveryDate,
        total_points: totalPoints,
        total_price: totalPrice,
        status: 'pending',
        is_paid: isPaidNewOrder, // Usar el estado del checkbox
        user_id: userId // Asignar el user_id
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError.message);
      setLoading(false);
      return;
    }

    const orderItemsToInsert = selectedProducts.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        order_id: newOrder.id,
        product_id: item.productId,
        quantity: item.quantity,
        points_at_sale: product ? product.points_per_unit : 0,
        price_at_sale: product ? product.price_per_unit : 0
      };
    });

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (orderItemsError) {
      console.error('Error creating order items:', orderItemsError.message);
      await supabase.from('orders').delete().eq('id', newOrder.id);
    } else {
      setShowNewOrderModal(false);
      setSelectedCustomer('');
      setSelectedProducts([{ productId: '', quantity: 1 }]);
      setDeliveryDate('');
      setIsPaidNewOrder(true); // Resetear a pagado por defecto
      await fetchData();
    }
    setLoading(false);
  };

  const getWhatsAppLink = (phoneNumber, message) => {
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  const pendingOrders = orders.filter(order => order.status === 'pending');
  const deliveredOrdersLast60Days = orders.filter(order => {
    if (order.status !== 'delivered' || !order.completed_at) {
      return false;
    }
    const completedDate = parseISO(order.completed_at);
    const sixtyDaysAgo = subDays(new Date(), 60);
    return isValid(completedDate) && isBefore(sixtyDaysAgo, completedDate);
  });

  // Calcular totales para pedidos pendientes
  const totalPendingPoints = pendingOrders.reduce((sum, order) => sum + (order.total_points || 0), 0);
  const totalPendingPrice = pendingOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);

  // Calcular totales para pedidos entregados en los últimos 60 días
  const totalDelivered60DaysPoints = deliveredOrdersLast60Days.reduce((sum, order) => sum + (order.total_points || 0), 0);
  const totalDelivered60DaysPrice = deliveredOrdersLast60Days.reduce((sum, order) => sum + (order.total_price || 0), 0);


  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pb-4"> {/* Reducido pb */}
      <div className="container mx-auto px-2 py-4 max-w-4xl"> {/* Reducido px y py */}
        <motion.h1
          className="text-3xl font-extrabold text-gray-900 mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600" // Reducido text-4xl a text-3xl, mb-6 a mb-4
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          FuxionFlow
        </motion.h1>

        {/* Sección de Nuevo Pedido */}
        <motion.div
          className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 mb-4 shadow-md" // Reducido padding, mb, shadow, rounded
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-1.5"> {/* Reducido text-2xl a text-xl, mb-3 a mb-2 */}
            <Plus className="w-5 h-5 text-blue-500" /> Nuevo Pedido
          </h2>
          <motion.button
            onClick={() => setShowNewOrderModal(true)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg font-semibold shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 flex items-center justify-center gap-1.5" // Reducido py, rounded, shadow
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" /> {/* Reducido w, h */}
            Crear Nuevo Pedido
          </motion.button>
        </motion.div>

        {/* Modal de Nuevo Pedido */}
        <AnimatePresence>
          {showNewOrderModal && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50" // Reducido padding
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-2xl p-5 shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto" // Reducido padding, rounded, max-h
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              >
                <h3 className="text-xl font-bold text-gray-800 mb-4">Detalles del Nuevo Pedido</h3> {/* Reducido text-2xl a text-xl, mb-5 a mb-4 */}
                <form onSubmit={handleCreateOrder} className="space-y-3"> {/* Reducido space-y-4 a space-y-3 */}
                  <div>
                    <label htmlFor="customer" className="block text-gray-700 font-medium mb-1">Cliente:</label> {/* Reducido mb-1.5 a mb-1 */}
                    <select
                      id="customer"
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" // Reducido py, rounded
                      required
                    >
                      <option value="">Selecciona un cliente</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2"> {/* Reducido space-y-3 a space-y-2 */}
                    <label className="block text-gray-700 font-medium mb-1">Productos:</label> {/* Reducido mb-1.5 a mb-1 */}
                    {selectedProducts.map((item, index) => (
                      <div key={index} className="flex items-end gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200"> {/* Reducido padding, rounded */}
                        <div className="flex-1">
                          <label htmlFor={`product-${index}`} className="block text-gray-600 text-xs mb-0.5">Producto:</label> {/* Reducido text-sm a text-xs */}
                          <select
                            id={`product-${index}`}
                            value={item.productId}
                            onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/30" // Reducido py, rounded
                            required
                          >
                            <option value="">Selecciona un producto</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`quantity-${index}`} className="block text-gray-600 text-xs mb-0.5">Cant:</label> {/* Reducido text-sm a text-xs */}
                          <input
                            id={`quantity-${index}`}
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-14 px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/30" // Reducido w, py, rounded
                            required
                          />
                        </div>
                        <motion.button
                          type="button"
                          onClick={() => handleRemoveProductFromOrder(index)}
                          className="p-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors" // Reducido padding, rounded
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <XCircle className="w-3 h-3" /> {/* Reducido w, h */}
                        </motion.button>
                      </div>
                    ))}
                    <motion.button
                      type="button"
                      onClick={handleAddProductToOrder}
                      className="w-full bg-blue-100 text-blue-600 py-1.5 rounded-lg font-semibold text-sm hover:bg-blue-200 transition-colors flex items-center justify-center gap-1.5" // Reducido py, rounded, text-sm
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="w-3 h-3" /> {/* Reducido w, h */}
                      Agregar Otro Producto
                    </motion.button>
                  </div>

                  <div>
                    <label htmlFor="deliveryDate" className="block text-gray-700 font-medium mb-1">Fecha de Entrega:</label> {/* Reducido mb-1.5 a mb-1 */}
                    <input
                      id="deliveryDate"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" // Reducido py, rounded
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="isPaidNewOrder"
                      type="checkbox"
                      checked={isPaidNewOrder}
                      onChange={(e) => setIsPaidNewOrder(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPaidNewOrder" className="text-gray-700 font-medium text-sm">Pedido Pagado</label>
                  </div>

                  <div className="flex justify-end gap-2 mt-4"> {/* Reducido gap, mt */}
                    <motion.button
                      type="button"
                      onClick={() => setShowNewOrderModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-colors" // Reducido px, py, rounded, text-sm
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold text-sm shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300" // Reducido px, py, rounded, text-sm, shadow
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Guardar Pedido
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sección de Pedidos Pendientes */}
        <motion.div
          className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 mb-4 shadow-md" // Reducido padding, mb, shadow, rounded
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-1.5"> {/* Reducido text-2xl a text-xl, mb-3 a mb-2 */}
            <Truck className="w-5 h-5 text-orange-500" /> Pedidos Pendientes
          </h2>
          {pendingOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-2 text-sm">¡No hay pedidos pendientes! Eres un campeón.</p> // Reducido py, text-sm
          ) : (
            <div className="space-y-2"> {/* Reducido space-y-3 a space-y-2 */}
              <AnimatePresence>
                {pendingOrders.map((order) => {
                  // Usar los totales guardados en la orden, o recalcular si no existen (para compatibilidad)
                  const currentTotalPoints = order.total_points || calculateOrderTotals(order.order_items).totalPoints;
                  const currentTotalPrice = order.total_price || calculateOrderTotals(order.order_items).totalPrice;
                  return (
                    <motion.div
                      key={order.id}
                      className="bg-orange-50 border border-orange-200 rounded-lg p-3 shadow-sm" // Reducido padding, rounded, shadow
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex justify-between items-center mb-1"> {/* Reducido mb */}
                        <p className="text-base font-semibold"> {/* Reducido text-lg a text-base */}
                          Cliente: <span className="font-extrabold text-orange-700">{order.customers?.name || 'N/A'}</span>
                        </p>
                        <p className="text-sm text-gray-700"> {/* Reducido text-md a text-sm */}
                          Fecha: <span className="font-extrabold text-orange-700">{new Date(order.delivery_date).toLocaleDateString()}</span>
                        </p>
                      </div>
                      <div className="text-xs text-gray-600 mb-1"> {/* Reducido text-sm a text-xs, mb-2 a mb-1 */}
                        <p>Productos:</p>
                        <ul className="list-disc list-inside ml-4"> {/* Reducido ml-2 a ml-4 */}
                          {order.order_items.map(item => {
                            const product = products.find(p => p.id === item.product_id);
                            return (
                              <li key={item.id}>
                                {product?.name || 'Producto Desconocido'} x {item.quantity}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="flex justify-between items-center text-sm"> {/* Añadido text-sm */}
                        <p className="text-gray-700">Puntos: {currentTotalPoints}</p>
                        <p className="text-gray-700">Precio: S/. {currentTotalPrice.toFixed(2)}</p>
                      </div>
                      {/* Mostrar botones solo si el estado es 'pending' */}
                      {order.status === 'pending' && (
                        <div className="flex gap-2 mt-2"> {/* Reducido mt */}
                          <motion.button
                            onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                            className="flex-1 bg-green-500 text-white py-1.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1 hover:bg-green-600 transition-colors" // Reducido py, rounded, text-sm, gap
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <CheckCircle className="w-4 h-4" /> Entregado
                          </motion.button>
                          <motion.button
                            onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                            className="flex-1 bg-red-500 text-white py-1.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1 hover:bg-red-600 transition-colors" // Reducido py, rounded, text-sm, gap
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <XCircle className="w-4 h-4" /> Cancelado
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          {pendingOrders.length > 0 && (
            <motion.div
              className="mt-3 pt-2 border-t border-gray-200/50 flex justify-between items-center text-sm" // Reducido mt, pt, text-sm
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div>
                <p className="font-bold text-gray-800 flex items-center gap-1"> {/* Reducido text-lg a normal, gap */}
                  <Star className="w-4 h-4 text-yellow-500" /> Puntos Pendientes: {totalPendingPoints.toFixed(2)}
                </p>
                <p className="font-bold text-gray-800 flex items-center gap-1"> {/* Reducido text-lg a normal, gap */}
                  <DollarSign className="w-4 h-4 text-green-500" /> Precio Pendientes: S/. {totalPendingPrice.toFixed(2)}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Sección de Pedidos Entregados (Últimos 60 días) */}
        <motion.div
          className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 mb-4 shadow-md" // Reducido padding, mb, shadow, rounded
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-1.5"> {/* Reducido text-2xl a text-xl, mb-3 a mb-2 */}
            <History className="w-5 h-5 text-blue-500" /> Entregados (Últimos 60 días)
          </h2>
          {deliveredOrdersLast60Days.length === 0 ? (
            <p className="text-gray-500 text-center py-2 text-sm">Nadie ha comprado nada en los últimos 60 días. ¡A vender!</p> // Reducido py, text-sm
          ) : (
            <div className="space-y-2"> {/* Reducido space-y-3 a space-y-2 */}
              <AnimatePresence>
                {deliveredOrdersLast60Days.map((order) => {
                  // Usar los totales guardados en la orden, o recalcular si no existen
                  const currentTotalPoints = order.total_points || calculateOrderTotals(order.order_items).totalPoints;
                  const currentTotalPrice = order.total_price || calculateOrderTotals(order.order_items).totalPrice;
                  return (
                    <motion.div
                      key={order.id}
                      className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm" // Reducido padding, rounded, shadow
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex justify-between items-center mb-1"> {/* Reducido mb */}
                        <p className="text-base font-semibold"> {/* Reducido text-lg a text-base */}
                          Cliente: <span className="font-extrabold text-blue-700">{order.customers?.name || 'N/A'}</span>
                        </p>
                        <p className="text-sm text-gray-700"> {/* Reducido text-md a text-sm */}
                          Fecha: <span className="font-extrabold text-blue-700">{new Date(order.completed_at).toLocaleDateString()}</span>
                        </p>
                      </div>
                      <div className="text-xs text-gray-600 mb-1"> {/* Reducido text-sm a text-xs, mb-2 a mb-1 */}
                        <p>Productos Comprados:</p>
                        <ul className="list-disc list-inside ml-4"> {/* Reducido ml-2 a ml-4 */}
                          {order.order_items.map(item => {
                            const product = products.find(p => p.id === item.product_id);
                            return (
                              <li key={item.id}>
                                {product?.name || 'Producto Desconocido'} x {item.quantity}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="flex justify-between items-center text-sm"> {/* Añadido text-sm */}
                        <p className="text-gray-700">Puntos: {currentTotalPoints}</p>
                        <p className="text-gray-700">Precio: S/. {currentTotalPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          id={`paid-${order.id}`}
                          type="checkbox"
                          checked={order.is_paid}
                          onChange={() => handleTogglePaidStatus(order.id, order.is_paid)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`paid-${order.id}`} className="text-gray-700 font-medium text-sm">
                          {order.is_paid ? 'Pagado' : 'Pendiente de Pago'}
                        </label>
                      </div>
                      {order.customers?.phone_number && (
                        <div className="flex gap-2 mt-3">
                          <motion.a
                            href={`tel:${order.customers.phone_number}`}
                            className="flex-1 bg-blue-500 text-white py-1.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1 hover:bg-blue-600 transition-colors" // Reducido py, rounded, text-sm, gap
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Phone className="w-4 h-4" /> Llamar
                          </motion.a>
                          <motion.a
                            href={getWhatsAppLink(order.customers.phone_number, `¡Hola ${order.customers.name}! ¿Cómo te va con tus productos Fuxion? ¡Tenemos novedades para ti!`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-green-500 text-white py-1.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-1 hover:bg-green-600 transition-colors" // Reducido py, rounded, text-sm, gap
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <MessageSquare className="w-4 h-4" /> WhatsApp
                          </motion.a>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          {deliveredOrdersLast60Days.length > 0 && (
            <motion.div
              className="mt-3 pt-2 border-t border-gray-200/50 flex justify-between items-center text-sm" // Reducido mt, pt, text-sm
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div>
                <p className="font-bold text-gray-800 flex items-center gap-1"> {/* Reducido text-lg a normal, gap */}
                  <Star className="w-4 h-4 text-yellow-500" /> Puntos Entregados (60 días): {totalDelivered60DaysPoints.toFixed(2)}
                </p>
                <p className="font-bold text-gray-800 flex items-center gap-1"> {/* Reducido text-lg a normal, gap */}
                  <DollarSign className="w-4 h-4 text-green-500" /> Precio Entregados (60 días): S/. {totalDelivered60DaysPrice.toFixed(2)}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Home;