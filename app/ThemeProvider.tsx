'use client';

import { useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Restaurar tema ao carregar (roda apenas no cliente)
    const saved = localStorage.getItem('lle_light_theme');
    const isLight = saved ? JSON.parse(saved) : false;
    
    const html = document.documentElement;
    if (isLight) {
      html.classList.add('light-theme');
    } else {
      html.classList.remove('light-theme');
    }
    
    setMounted(true);
  }, []);

  // Evitar flashe de tema incorreto - não renderizar até estar mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
