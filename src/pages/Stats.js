import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { TrendingUp, Users } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Stats = () => {
  const [loading, setLoading] = useState(true);
  const [monthlySalesData, setMonthlySalesData] = useState({ soles: [], points: [] });
  const [partnerLoanData, setPartnerLoanData] = useState([]);

  useEffect(() => {
    fetchStatsData();
  }, []);

  const fetchStatsData = async () => {
    setLoading(true);

    // Fetch sales data for the last year
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('completed_at, order_items(*, products(points_per_unit, price_per_unit))')
      .eq('status', 'delivered')
      .gte('completed_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()); // Last 365 days

    if (ordersError) {
      console.error('Error fetching sales data:', ordersError.message);
    } else {
      processSalesData(ordersData);
    }

    // Fetch partner loan data
    const { data: loansData, error: loansError } = await supabase
      .from('loans')
      .select('quantity, partners(name), products(points_per_unit, price_per_unit)');

    if (loansError) {
      console.error('Error fetching loan data:', loansError.message);
    } else {
      processPartnerLoanData(loansData);
    }

    setLoading(false);
  };

  const processSalesData = (orders) => {
    const monthlySales = {};
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthYear = `${date.toLocaleString('es-ES', { month: 'short' })} ${date.getFullYear()}`;
      monthlySales[monthYear] = { soles: 0, points: 0 };
    }

    orders.forEach(order => {
      const orderDate = new Date(order.completed_at);
      const monthYear = `${orderDate.toLocaleString('es-ES', { month: 'short' })} ${orderDate.getFullYear()}`;

      if (monthlySales[monthYear]) {
        order.order_items.forEach(item => {
          if (item.products) {
            monthlySales[monthYear].soles += item.quantity * item.products.price_per_unit;
            monthlySales[monthYear].points += item.quantity * item.products.points_per_unit;
          }
        });
      }
    });

    const sortedMonths = Object.keys(monthlySales).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(`${monthA} 1, ${yearA}`);
      const dateB = new Date(`${monthB} 1, ${yearB}`);
      return dateA - dateB;
    });

    setMonthlySalesData({
      labels: sortedMonths,
      soles: sortedMonths.map(month => monthlySales[month].soles),
      points: sortedMonths.map(month => monthlySales[month].points)
    });
  };

  const processPartnerLoanData = (loans) => {
    const partnerLoans = {};
    loans.forEach(loan => {
      if (loan.partners && loan.products) {
        const partnerName = loan.partners.name;
        if (!partnerLoans[partnerName]) {
          partnerLoans[partnerName] = { quantity: 0, points: 0, price: 0 };
        }
        partnerLoans[partnerName].quantity += loan.quantity;
        partnerLoans[partnerName].points += loan.quantity * loan.products.points_per_unit;
        partnerLoans[partnerName].price += loan.quantity * loan.products.price_per_unit;
      }
    });

    // Sort partners by total quantity loaned (descending)
    const sortedPartners = Object.entries(partnerLoans)
      .sort(([, a], [, b]) => b.quantity - a.quantity)
      .map(([name, data]) => ({ name, ...data }));

    setPartnerLoanData(sortedPartners);
  };

  const salesChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Ventas Mensuales (Último Año)',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Mes',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Monto / Puntos',
        },
      },
    },
  };

  const partnerLoanChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Productos Prestados por Socio',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Socio',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cantidad de Productos',
        },
      },
    },
  };

  const salesChartData = {
    labels: monthlySalesData.labels,
    datasets: [
      {
        label: 'Ventas en Soles (S/.)',
        data: monthlySalesData.soles,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: 'Ventas en Puntos',
        data: monthlySalesData.points,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  const partnerLoanChartData = {
    labels: partnerLoanData.map(p => p.name),
    datasets: [
      {
        label: 'Cantidad de Productos Prestados',
        data: partnerLoanData.map(p => p.quantity),
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
      },
    ],
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 pb-24">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.h1
          className="text-4xl font-extrabold text-gray-900 mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Estadísticas de Negocio
        </motion.h1>

        {/* Gráfico de Ventas Mensuales */}
        <motion.div
          className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-6 mb-8 shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-500" /> Ventas Mensuales
          </h2>
          <div className="h-80"> {/* Altura fija para el gráfico */}
            <Bar data={salesChartData} options={salesChartOptions} />
          </div>
        </motion.div>

        {/* Gráfico de Préstamos por Socio */}
        <motion.div
          className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-6 mb-8 shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" /> Préstamos por Socio
          </h2>
          {partnerLoanData.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay datos de préstamos para mostrar.</p>
          ) : (
            <div className="h-80"> {/* Altura fija para el gráfico */}
              <Bar data={partnerLoanChartData} options={partnerLoanChartOptions} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Stats;