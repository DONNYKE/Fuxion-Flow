import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Package, Handshake, BarChart2, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO, isValid, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState(''); // 'inventory', 'loans', 'monthly_sales'
  const [reportData, setReportData] = useState([]);
  const [products, setProducts] = useState([]); // Para cálculos de ventas
  const [customers, setCustomers] = useState([]); // Para cálculos de ventas
  const [partners, setPartners] = useState([]); // Para préstamos

  // Estados para el filtro de ventas mensuales
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  const reportRef = useRef(); // Referencia para el contenido a exportar

  useEffect(() => {
    // Precargar productos, clientes y socios para todos los reportes
    const preloadData = async () => {
      const user = supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const userId = (await user).data.user.id;

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId); // Filtrar por user_id
      if (productsError) console.error('Error preloading products:', productsError.message);
      setProducts(productsData || []);

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId); // Filtrar por user_id
      if (customersError) console.error('Error preloading customers:', customersError.message);
      setCustomers(customersData || []);

      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', userId); // Filtrar por user_id
      if (partnersError) console.error('Error preloading partners:', partnersError.message);
      setPartners(partnersData || []);
    };
    preloadData();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setReportData([]); // Limpiar datos anteriores

    const user = supabase.auth.getUser();
    if (!user) {
      alert('Debes iniciar sesión para generar reportes.');
      setLoading(false);
      return;
    }
    const userId = (await user).data.user.id;

    let data = [];
    let error = null;

    switch (reportType) {
      case 'inventory':
        ({ data, error } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', userId) // Filtrar por user_id
          .order('name', { ascending: true }));
        break;
      case 'loans':
        ({ data, error } = await supabase
          .from('loans')
          .select('*, partners(name), products(name, points_per_unit, price_per_unit)')
          .eq('user_id', userId) // Filtrar por user_id
          .order('loan_date', { ascending: false }));
        break;
      case 'monthly_sales':
        // Obtener todas las órdenes entregadas para procesar
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('status', 'delivered')
          .eq('user_id', userId); // Filtrar por user_id
        if (ordersError) {
          error = ordersError;
          break;
        }

        const monthlySales = {};
        ordersData.forEach(order => {
          if (order.completed_at) {
            const completedDate = parseISO(order.completed_at);
            if (isValid(completedDate)) {
              const monthYearKey = format(completedDate, 'yyyy-MM');
              const monthYearLabel = format(completedDate, 'MMM yyyy');

              // Filtrar por rango de meses si está seleccionado
              let includeInReport = true;
              if (startMonth && endMonth) {
                const start = startOfMonth(parseISO(startMonth));
                const end = endOfMonth(parseISO(endMonth));
                includeInReport = isWithinInterval(completedDate, { start, end });
              }

              if (includeInReport) {
                const { totalPrice } = calculateOrderTotals(order.order_items);
                if (!monthlySales[monthYearKey]) {
                  monthlySales[monthYearKey] = { name: monthYearLabel, totalSales: 0 };
                }
                monthlySales[monthYearKey].totalSales += totalPrice;
              }
            }
          }
        });
        data = Object.keys(monthlySales).sort().map(key => monthlySales[key]);
        break;
      default:
        break;
    }

    if (error) {
      console.error('Error generating report:', error.message);
      alert('Error al generar el reporte: ' + error.message);
    } else {
      setReportData(data || []);
    }
    setLoading(false);
  };

  // Función para calcular los totales de una orden completa (copiada de Home/History)
  const calculateOrderTotals = (orderItems) => {
    let totalPrice = 0;
    orderItems.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      const pricePerUnit = item.price_at_sale || (product ? product.price_per_unit : 0);
      totalPrice += pricePerUnit * item.quantity;
    });
    return { totalPrice };
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    const input = reportRef.current;
    if (!input) {
      alert('No hay contenido para exportar.');
      setLoading(false);
      return;
    }

    // Ajustar el escalado para mejor calidad en PDF
    const scale = 2; 
    const canvas = await html2canvas(input, {
      scale: scale,
      useCORS: true,
      logging: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${reportType}_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    setLoading(false);
  };

  // Generar opciones de meses/años para los selectores
  const getMonthYearOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      for (let m = 0; m < 12; m++) {
        const date = new Date(y, m, 1);
        options.push({
          value: format(date, 'yyyy-MM'),
          label: format(date, 'MMM yyyy')
        });
      }
    }
    return options;
  };

  const monthYearOptions = getMonthYearOptions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 pb-16">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <motion.h1
          className="text-4xl font-extrabold text-gray-900 mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-gray-600 to-zinc-600"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Generar Reportes
        </motion.h1>

        {/* Selector de Tipo de Reporte */}
        <motion.div
          className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-5 mb-6 shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <label htmlFor="reportType" className="block text-gray-700 font-medium mb-1.5">Selecciona el tipo de reporte:</label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setReportData([]); // Limpiar datos al cambiar tipo de reporte
              setStartMonth(''); // Resetear filtros de fecha
              setEndMonth('');
            }}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">-- Selecciona --</option>
            <option value="inventory">Inventario Actual</option>
            <option value="loans">Préstamos Activos</option>
            <option value="monthly_sales">Ventas Mensuales</option>
          </select>

          {reportType === 'monthly_sales' && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="flex-1">
                <label htmlFor="startMonth" className="block text-gray-700 font-medium mb-1.5">Desde:</label>
                <select
                  id="startMonth"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Selecciona un mes</option>
                  {monthYearOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="endMonth" className="block text-gray-700 font-medium mb-1.5">Hasta:</label>
                <select
                  id="endMonth"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Selecciona un mes</option>
                  {monthYearOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <motion.button
            onClick={generateReport}
            disabled={!reportType || (reportType === 'monthly_sales' && (!startMonth || !endMonth))}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 mt-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FileText className="w-5 h-5" />
            Generar Reporte
          </motion.button>
        </motion.div>

        {loading && <LoadingSpinner />}

        {reportData.length > 0 && (
          <motion.div
            className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-5 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Reporte de {reportType === 'inventory' ? 'Inventario' : reportType === 'loans' ? 'Préstamos' : 'Ventas Mensuales'}
              </h2>
              <motion.button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-red-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-5 h-5" /> Descargar PDF
              </motion.button>
            </div>

            <div ref={reportRef} className="p-4 bg-white rounded-lg">
              {reportType === 'inventory' && (
                <div className="space-y-2">
                  <h3 className="text-xl font-bold mb-2">Inventario Actual</h3>
                  {reportData.map(product => (
                    <div key={product.id} className="border-b pb-2">
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm">Cantidad: {product.quantity}</p>
                      <p className="text-sm">Puntos/Unidad: {product.points_per_unit}</p>
                      <p className="text-sm">Precio/Unidad: S/. {product.price_per_unit.toFixed(2)}</p>
                      <p className="text-sm">Tipo: {product.is_own ? 'Propio' : 'Prestado'}</p>
                    </div>
                  ))}
                </div>
              )}

              {reportType === 'loans' && (
                <div className="space-y-2">
                  <h3 className="text-xl font-bold mb-2">Préstamos Activos</h3>
                  {reportData.map(loan => (
                    <div key={loan.id} className="border-b pb-2">
                      <p className="font-semibold">Socio: {loan.partners?.name || 'N/A'}</p>
                      <p className="text-sm">Producto: {loan.products?.name || 'N/A'} x {loan.quantity}</p>
                      <p className="text-sm">Fecha Préstamo: {new Date(loan.loan_date).toLocaleDateString()}</p>
                      <p className="text-sm">Puntos: {loan.quantity * (loan.products?.points_per_unit || 0)}</p>
                      <p className="text-sm">Precio: S/. {(loan.quantity * (loan.products?.price_per_unit || 0)).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {reportType === 'monthly_sales' && (
                <div className="space-y-2">
                  <h3 className="text-xl font-bold mb-2">Ventas Mensuales</h3>
                  {reportData.length === 0 ? (
                    <p className="text-gray-500 text-center py-2">No hay datos de ventas para el rango seleccionado.</p>
                  ) : (
                    reportData.map(sale => (
                      <div key={sale.name} className="border-b pb-2">
                        <p className="font-semibold">Mes: {sale.name}</p>
                        <p className="text-sm">Ventas Totales: S/. {sale.totalSales.toFixed(2)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Reports;