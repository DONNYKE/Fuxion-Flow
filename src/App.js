import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; // Importa supabase
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Partners from './pages/Partners';
import History from './pages/History';
import Reports from './pages/Reports';
import Auth from './pages/Auth';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner'; // Asegúrate de que este componente exista

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    // Forzar el cierre de sesión al iniciar la aplicación
    const forceLogoutOnStart = async () => {
      await supabase.auth.signOut();
      // Después de cerrar sesión, la lógica de onAuthStateChange se encargará de actualizar el estado
    };
    forceLogoutOnStart();

    // Escucha los cambios de estado de autenticación de Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    // Obtener la sesión inicial (después de intentar cerrar sesión)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []); // El array vacío asegura que este useEffect se ejecute solo una vez al montar

  if (loadingAuth) {
    return <LoadingSpinner />; // Muestra un spinner mientras se verifica la sesión
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <main className="flex-grow pb-16">
          <Routes>
            {/* Ruta de autenticación */}
            <Route path="/auth" element={<Auth />} />

            {/* Rutas protegidas */}
            {session ? (
              <>
                <Route path="/" element={<Home />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/partners" element={<Partners />} />
                <Route path="/history" element={<History />} />
                <Route path="/reports" element={<Reports />} />
                {/* Redirigir cualquier otra ruta a Home si está autenticado */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              // Redirigir a la página de autenticación si no está autenticado
              <Route path="*" element={<Navigate to="/auth" replace />} />
            )}
          </Routes>
        </main>
        {session && <Navbar />} {/* Solo muestra la Navbar si el usuario está autenticado */}
      </div>
    </Router>
  );
}