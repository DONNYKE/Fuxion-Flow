import React from 'react'; import { motion } from 'framer-motion'; import { Loader } from 'lucide-react';

const LoadingSpinner = () => { return ( <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center p-6 bg-white rounded-xl shadow-lg" > <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} > </motion.div> Cargando... </motion.div> ); };

export default LoadingSpinner;