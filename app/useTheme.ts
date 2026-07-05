'use client';

import { useState, useEffect } from 'react';

export const useTheme = () => {
  const [lightTheme, setLightTheme] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Inicializar tema do localStorage e aplicar ao document
  useEffect(() => {
    const saved = localStorage.getItem('lle_light_theme');
    const isLight = saved ? JSON.parse(saved) : false;
    setLightTheme(isLight);
    
    // Aplicar classe ao HTML elemento
    const html = document.documentElement;
    if (isLight) {
      html.classList.add('light-theme');
    } else {
      html.classList.remove('light-theme');
    }
    
    setMounted(true);
  }, []);

  // Sincronizar mudanças de tema com localStorage e document
  useEffect(() => {
    if (!mounted) return;
    
    const html = document.documentElement;
    if (lightTheme) {
      html.classList.add('light-theme');
    } else {
      html.classList.remove('light-theme');
    }
    localStorage.setItem('lle_light_theme', JSON.stringify(lightTheme));
  }, [lightTheme, mounted]);

  return { lightTheme, setLightTheme, mounted };
};
