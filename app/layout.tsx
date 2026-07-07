'use client';

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { useEffect, useState } from "react";

// Nota: metadata não pode ser usado com 'use client', mas Next.js trata isso automaticamente

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Restaurar tema ao carregar
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

  return (
    <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.2s' }}>
      {children}
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeInitializer>{children}</ThemeInitializer>
      </body>
    </html>
  );
}