import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Edit, Trash2, Handshake, Package, DollarSign, Star, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const Partners = () => {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [currentPartner, setCurrentPartner] = useState(null);
  const [selectedPartnerForLoan, setSelectedPartnerForLoan] = useState(null);

  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');

  const [loanProductId, setLoanProductId] = useState('');
  const [loanQuantity, setLoanQuantity] = useState(1);
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const userId = user.id;

    const { data: partnersData, error: partnersError } = await supabase
      .from('partners')
      .select('*, loans(*, products(id, name, points_per_unit, price_per_unit))')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId);

    if (partnersError) console.error('Error fetching partners:', partnersError.message);
    if (productsError) console.error('Error fetching products:', productsError.message);

    setPartners(partnersData || []);
    setProducts(productsData || []);
    setLoading(false);
  };

  const calculateLoanTotals = (loans) => {
    let totalPoints = 0;
    let totalPrice = 0;
    loans.forEach(loan => {
      if (loan.products) {
        totalPoints += loan.quantity * loan.products.points_per_unit;
        totalPrice += loan.quantity * loan.products.price_per_unit;
      }
    });
    return { totalPoints, totalPrice };
  };

  const handleAddPartnerClick = () => {
    setCurrentPartner(null);
    setPartnerName('');
    setPartnerPhone('');
    setPartnerEmail('');
    setShowPartnerModal(true);
  };

  const handleEditPartnerClick = (partner) => {
    setCurrentPartner(partner);
    setPartnerName(partner.name);
    setPartnerPhone(partner.phone_number);
    setPartnerEmail(partner.email);
    setShowPartnerModal(true);
  };

  const handleSubmitPartner = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para gestionar socios.');
      setLoading(false);
      return;
    }
    const userId = user.id;

    const partnerData = {
      name: partnerName,
      phone_number: partnerPhone,
      email: partnerEmail,
      user_id: userId
    };

    if (currentPartner) {
      const { error } = await supabase
        .from('partners')
        .update(partnerData)
        .eq('id', currentPartner.id)
        .eq('user_id', userId);
      if (error) console.error('Error updating partner:', error.message);
    } else {
      const { error } = await supabase
        .from('partners')
        .insert(partnerData);
      if (error) console.error('Error adding partner:', error.message);
    }

    setShowPartnerModal(false);
    fetchData();
  };

  const handleDeletePartner = async (partnerId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este socio y todos sus préstamos asociados?')) {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión para eliminar socios.');
        setLoading(false);
        return;
      }
      const userId = user.id;

      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', partnerId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting partner:', error.message);
      } else {
        fetchData();
      }
      setLoading(false);
    }
  };

  const handleAddLoanClick = (partner) => {
    setSelectedPartnerForLoan(partner);
    setLoanProductId('');
    setLoanQuantity(1);
    setLoanDate(new Date().toISOString().split('T')[0]);
    setShowLoanModal(true);
  };

  const handleSubmitLoan = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para registrar préstamos.');
      setLoading(false);
      return;
    }
    const userId = user.id;

    const selectedProduct = products.find(p => p.id === loanProductId);
    if (!selectedProduct) {
      console.error('Producto no encontrado para el préstamo.');
      setLoading(false);
      return;
    }
    if (loanQuantity > selectedProduct.quantity) {
      alert('No puedes prestar más productos de los que tienes en inventario.');
      setLoading(false);
      return;
    }

    const loanData = {
      partner_id: selectedPartnerForLoan.id,
      product_id: loanProductId,
      quantity: loanQuantity,
      points_at_loan: selectedProduct.points_per_unit,
      price_at_loan: selectedProduct.price_per_unit,
      loan_date: loanDate,
      user_id: userId
    };

    const { error: loanError } = await supabase
      .from('loans')
      .insert(loanData);

    if (!loanError) {
      await supabase
        .from('products')
        .update({ quantity: (selectedProduct.quantity || 0) - loanQuantity })
        .eq('id', selectedProduct.id)
        .eq('user_id', userId);
    } else {
      console.error('Error adding loan:', loanError.message);
    }

    setShowLoanModal(false);
    fetchData();
  };

  const handleDeleteLoan = async (loanId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este préstamo?')) {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión para eliminar préstamos.');
        setLoading(false);
        return;
      }
      const userId = user.id;

      await supabase
        .from('loans')
        .delete()
        .eq('id', loanId)
        .eq('user_id', userId);

      fetchData();
      setLoading(false);
    }
  };

  const totalActiveLoansPoints = partners.reduce((sum, partner) => sum + calculateLoanTotals(partner.loans).totalPoints, 0);
  const totalActiveLoansPrice = partners.reduce((sum, partner) => sum + calculateLoanTotals(partner.loans).totalPrice, 0);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <motion.h1
        className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Gestión de Socios
      </motion.h1>

      {/* Botón para añadir socio */}
      <motion.button
        onClick={handleAddPartnerClick}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 mb-6"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Plus className="w-5 h-5" />
        Añadir Nuevo Socio
      </motion.button>

      {/* Lista de socios */}
      <div className="space-y-3">
        {partners.length === 0 ? (
          <p className="text-gray-500 text-center py-3 bg-white/80 rounded-2xl shadow-sm">
            No hay socios registrados. ¡Es hora de expandir tu red!
          </p>
        ) : (
          <AnimatePresence>
            {partners.map((partner) => {
              const { totalPoints, totalPrice } = calculateLoanTotals(partner.loans);
              return (
                <motion.div
                  key={partner.id}
                  className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-4 shadow-xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Info del socio */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{partner.name}</h3>
                      <p className="text-gray-600 text-sm">{partner.phone_number}</p>
                      <p className="text-gray-600 text-sm">{partner.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleEditPartnerClick(partner)}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDeletePartner(partner.id)}
                        className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Lista de préstamos */}
                  <h4 className="text-base font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-purple-500" /> Préstamos Activos:
                  </h4>
                  {partner.loans.length === 0 ? (
                    <p className="text-gray-500 text-xs ml-6">Este socio no tiene préstamos activos.</p>
                  ) : (
                    <div className="space-y-2 ml-6">
                      {partner.loans.map((loan) => (
                        <motion.div
                          key={loan.id}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {loan.products?.name || 'Producto Desconocido'} x {loan.quantity}
                            </p>
                            <p className="text-xs text-gray-600">Fecha: {new Date(loan.loan_date).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-600">
                              Puntos: {loan.quantity * (loan.products?.points_per_unit || 0)} | Precio: S/. {(loan.quantity * (loan.products?.price_per_unit || 0)).toFixed(2)}
                            </p>
                          </div>
                          <motion.button
                            onClick={() => handleDeleteLoan(loan.id)}
                            className="p-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Totales y botón de añadir préstamo */}
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <div>
                      <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-yellow-500" /> Total Préstamos Puntos: {totalPoints}
                      </p>
                      <p className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-500" /> Total Préstamos Precio: S/. {totalPrice.toFixed(2)}
                      </p>
                    </div>
                    <motion.button
                      onClick={() => handleAddLoanClick(partner)}
                      className="px-3 py-1.5 bg-purple-100 text-purple-600 rounded-xl font-semibold hover:bg-purple-200 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" /> Añadir Préstamo
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Totales generales */}
      {partners.length > 0 && (
        <motion.div className="mt-4 pt-3 border-t border-gray-200/50 flex justify-between items-center">
          <div>
            <p className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <Star className="w-5 h-5 text-yellow-500" /> Total Puntos Préstamos Activos: {totalActiveLoansPoints.toFixed(2)}
            </p>
            <p className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-green-500" /> Total Precio Préstamos Activos: S/. {totalActiveLoansPrice.toFixed(2)}
            </p>
          </div>
        </motion.div>
      )}
    </>
  );
};

export default Partners;
