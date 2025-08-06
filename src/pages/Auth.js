import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // true = login, false = signup
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    let error = null;
    if (isLogin) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      error = loginError;
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });
      error = signUpError;
    }

    if (error) {
      alert(error.message);
    } else {
      alert(
        isLogin
          ? '¡Sesión iniciada con éxito!'
          : '¡Registro exitoso! Ya puedes iniciar sesión.'
      );
      setEmail('');
      setPassword('');
      navigate('/');
    }
    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <motion.div
      className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-8 shadow-xl max-w-md w-full"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
    >
      {isLogin ? 'Iniciar Sesión' : 'Registrarse'}

      <form onSubmit={handleAuth} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-gray-700 font-medium mb-2"
          >
            Email:
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="tu@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-gray-700 font-medium mb-2"
          >
            Contraseña:
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder=""
              required
            />
          </div>
        </div>

        <motion.button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
        </motion.button>
      </form>

      <motion.button
        onClick={() => setIsLogin(!isLogin)}
        className="w-full text-blue-600 font-medium mt-4 hover:underline transition-colors duration-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLogin
          ? '¿No tienes cuenta? Regístrate aquí.'
          : '¿Ya tienes cuenta? Inicia sesión.'}
      </motion.button>
    </motion.div>
  );
};

export default Auth;
