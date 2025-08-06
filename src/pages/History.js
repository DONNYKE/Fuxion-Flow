import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History as HistoryIcon,
  CheckCircle,
  XCircle,
  Truck,
  Calendar,
  DollarSign,
  Star
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseISO, isValid } from 'date-fns';

const History = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, [filterStatus, filterDateRange]);

  const fetchHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const userId = user.id;

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, points_per_unit, price_per_unit')
      .eq('user_id', userId);

    if (productsError) console.error('Error fetching products:', productsError.message);
    setProducts(productsData || []);

    let query = supabase
      .from('orders')
      .select('*, order_items(*), customers(id, name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const now = new Date();
    if (filterDateRange === 'last30') {
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString();
      query = query.gte('created_at', thirtyDaysAgo);
    } else if (filterDateRange === 'last90') {
      const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90)).toISOString();
      query = query.gte('created_at', ninetyDaysAgo);
    }

    const { data: ordersData, error: ordersError } = await query;
    if (ordersError) console.error('Error fetching orders history:', ordersError.message);
    setOrders(ordersData || []);
    setLoading(false);
  };

  const getProductDetails = (productId) => {
    return products.find(p => p.id === productId);
  };

  const calculateOrderTotals = (orderItems) => {
    let totalPoints = 0;
    let totalPrice = 0;
    orderItems.forEach(item => {
      const product = getProductDetails(item.product_id);
      if (product) {
        totalPoints += item.quantity * (item.points_at_sale || product.points_per_unit);
        totalPrice += item.quantity * (item.price_at_sale || product.price_per_unit);
      }
    });
    return { totalPoints, totalPrice };
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <motion.h1
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Historial de Pedidos
      </motion.h1>

      {/* Filtros */}
      <motion.div
        className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 mb-6 shadow-md flex flex-col sm:flex-row justify-around items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex flex-col items-center">
          <label htmlFor="statusFilter" className="text-gray-700 font-medium mb-1">
            Estado:
          </label>
          <select
            id="statusFilter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="delivered">Entregados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        <div className="flex flex-col items-center">
          <label htmlFor="dateRangeFilter" className="text-gray-700 font-medium mb-1">
            Rango de Fecha:
          </label>
          <select
            id="dateRangeFilter"
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="all">Todo el historial</option>
            <option value="last30">Últimos 30 días</option>
            <option value="last90">Últimos 90 días</option>
          </select>
        </div>
      </motion.div>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <p className="text-gray-500 text-center py-3 bg-white/80 rounded-2xl shadow-sm">
            No hay pedidos en el historial con los filtros seleccionados.
          </p>
        ) : (
          <AnimatePresence>
            {orders.map((order) => {
              const { totalPoints, totalPrice } = calculateOrderTotals(order.order_items);
              const orderDate = isValid(parseISO(order.created_at))
                ? new Date(order.created_at).toLocaleDateString()
                : 'Fecha Desconocida';
              const deliveryDate = isValid(parseISO(order.delivery_date))
                ? new Date(order.delivery_date).toLocaleDateString()
                : 'Fecha Desconocida';

              let statusColor = '';
              let statusIcon = null;
              switch (order.status) {
                case 'pending':
                  statusColor = 'text-orange-500';
                  statusIcon = <Truck className="w-4 h-4" />;
                  break;
                case 'delivered':
                  statusColor = 'text-green-500';
                  statusIcon = <CheckCircle className="w-4 h-4" />;
                  break;
                case 'cancelled':
                  statusColor = 'text-red-500';
                  statusIcon = <XCircle className="w-4 h-4" />;
                  break;
                default:
                  statusColor = 'text-gray-500';
                  statusIcon = null;
              }

              return (
                <motion.div
                  key={order.id}
                  className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-4 shadow-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        Cliente: {order.customers?.name || 'N/A'}
                      </h3>
                      <p className="text-gray-600 text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Pedido: {orderDate}
                      </p>
                      <p className="text-gray-600 text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Entrega: {deliveryDate}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 font-semibold ${statusColor}`}>
                      {statusIcon}
                      <span className="capitalize">{order.status}</span>
                    </div>
                  </div>

                  <h4 className="text-base font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <HistoryIcon className="w-4 h-4 text-indigo-500" /> Productos del Pedido:
                  </h4>
                  <ul className="list-disc list-inside ml-6 text-sm text-gray-700 space-y-1">
                    {order.order_items.map(item => {
                      const product = getProductDetails(item.product_id);
                      return (
                        <li key={item.id}>
                          {product?.name || 'Producto Desconocido'} x {item.quantity}
                          <span className="ml-2 text-gray-500">
                            (Puntos: {item.quantity * (item.points_at_sale || product?.points_per_unit || 0)},
                            Precio: S/. {(item.quantity * (item.price_at_sale || product?.price_per_unit || 0)).toFixed(2)})
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-yellow-500" /> Total Puntos: {totalPoints.toFixed(2)}
                    </p>
                    <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-green-500" /> Total Precio: S/. {totalPrice.toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </>
  );
};

export default History;
