import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Edit, Trash2, Phone, MessageSquare, ShoppingBag, DollarSign, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Customers = () => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);

  // Formulario de cliente
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*, orders(total_points, total_price)')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) console.error('Error fetching customers:', error.message);
    setCustomers(data || []);
    setLoading(false);
  };

  const handleAddCustomerClick = () => {
    setCurrentCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setShowCustomerModal(true);
  };

  const handleEditCustomerClick = (customer) => {
    setCurrentCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone_number);
    setCustomerEmail(customer.email);
    setShowCustomerModal(true);
  };

  const handleSubmitCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para gestionar clientes.');
      setLoading(false);
      return;
    }
    const userId = user.id;

    const customerData = {
      name: customerName,
      phone_number: customerPhone,
      email: customerEmail,
      user_id: userId
    };

    if (currentCustomer) {
      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', currentCustomer.id)
        .eq('user_id', userId);
      if (error) console.error('Error updating customer:', error.message);
    } else {
      const { error } = await supabase
        .from('customers')
        .insert(customerData);
      if (error) console.error('Error adding customer:', error.message);
    }

    setShowCustomerModal(false);
    fetchCustomers();
  };

  const handleDeleteCustomer = async (customerId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente? Esto eliminará también sus pedidos asociados.')) {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión para eliminar clientes.');
        setLoading(false);
        return;
      }
      const userId = user.id;

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting customer:', error.message);
        alert('No se pudo eliminar el cliente. Asegúrate de que no tenga pedidos activos.');
      } else {
        fetchCustomers();
      }
      setLoading(false);
    }
  };

  const getWhatsAppLink = (phoneNumber, message) => {
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <motion.h1
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Gestión de Clientes
      </motion.h1>

      {/* Botón para Añadir Cliente */}
      <motion.button
        onClick={handleAddCustomerClick}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 mb-6"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Plus className="w-5 h-5" />
        Añadir Nuevo Cliente
      </motion.button>

      {/* Lista de Clientes */}
      <div className="space-y-3">
        {customers.length === 0 ? (
          <p className="text-gray-500 text-center py-3 bg-white/80 rounded-2xl shadow-sm">
            No hay clientes registrados. ¡Es hora de encontrar nuevos clientes!
          </p>
        ) : (
          <AnimatePresence>
            {customers.map((customer) => {
              const totalCustomerPoints = customer.orders.reduce((sum, order) => sum + (order.total_points || 0), 0);
              const totalCustomerPrice = customer.orders.reduce((sum, order) => sum + (order.total_price || 0), 0);

              return (
                <motion.div
                  key={customer.id}
                  className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-4 shadow-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{customer.name}</h3>
                      <p className="text-gray-600 text-sm">{customer.phone_number}</p>
                      <p className="text-gray-600 text-sm">{customer.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleEditCustomerClick(customer)}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <div>
                      <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-purple-500" /> Total Compras Puntos: {totalCustomerPoints}
                      </p>
                      <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-500" /> Total Compras Precio: S/. {totalCustomerPrice.toFixed(2)}
                      </p>
                    </div>
                    {customer.phone_number && (
                      <div className="flex gap-2">
                        <motion.a
                          href={`tel:${customer.phone_number}`}
                          className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-xl font-semibold hover:bg-blue-200 transition-colors flex items-center gap-1.5"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Phone className="w-4 h-4" /> Llamar
                        </motion.a>
                        <motion.a
                          href={getWhatsAppLink(customer.phone_number, `¡Hola ${customer.name}! ¿Cómo te va con tus productos Fuxion? ¡Tenemos novedades para ti!`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-green-100 text-green-600 rounded-xl font-semibold hover:bg-green-200 transition-colors flex items-center gap-1.5"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <MessageSquare className="w-4 h-4" /> WhatsApp
                        </motion.a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Modal de Añadir/Editar Cliente */}
      <AnimatePresence>
        {showCustomerModal && (
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
                {currentCustomer ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}
              </h3>
              <form onSubmit={handleSubmitCustomer} className="space-y-4">
                <div>
                  <label htmlFor="customerName" className="block text-gray-700 font-medium mb-1.5">Nombre del Cliente:</label>
                  <input
                    id="customerName"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="customerPhone" className="block text-gray-700 font-medium mb-1.5">Teléfono:</label>
                  <input
                    id="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label htmlFor="customerEmail" className="block text-gray-700 font-medium mb-1.5">Email:</label>
                  <input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <motion.button
                    type="button"
                    onClick={() => setShowCustomerModal(false)}
                    className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {currentCustomer ? 'Actualizar Cliente' : 'Guardar Cliente'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;
