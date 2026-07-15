"use client";

import { useState, type ReactNode } from "react";

type MobTabBarProps = {
  active: string;
  role: string;
  lightTheme: boolean;
};

type Tab = {
  href: string;
  label: string;
  id: string;
  icon: ReactNode;
};

const icons = {
  agenda: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  faturacao: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  ),
  colaboradores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M17 20c0-2 1.3-3.5 3-3.5" />
    </svg>
  ),
  materiais: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  ),
  clientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <line x1="16" y1="11" x2="22" y2="11" />
      <line x1="19" y1="8" x2="19" y2="14" />
    </svg>
  ),
  pagamentos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="7" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  valores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l3-3 3 2 5-7" />
    </svg>
  ),
  residencias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  mais: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  fechar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  ),
};

const mainTabs: Tab[] = [
  { href: "/agenda", label: "Agenda", id: "agenda", icon: icons.agenda },
  { href: "/leads", label: "Leads", id: "leads", icon: icons.leads },
  { href: "/faturacao", label: "Faturação", id: "faturacao", icon: icons.faturacao },
  { href: "/colaboradores", label: "Equipa", id: "colaboradores", icon: icons.colaboradores },
];

const adminTabs: Tab[] = [
  // Materiais fica primeiro para aparecer sempre logo ao abrir o painel.
  { href: "/materiais", label: "Materiais", id: "materiais", icon: icons.materiais },
  { href: "/clientes", label: "Clientes", id: "clientes", icon: icons.clientes },
  { href: "/pagamentos", label: "Pagamentos", id: "pagamentos", icon: icons.pagamentos },
  { href: "/dashboard", label: "Dashboard", id: "dashboard", icon: icons.dashboard },
  { href: "/valores", label: "Valores", id: "valores", icon: icons.valores },
  { href: "/residencias", label: "Residências", id: "residencias", icon: icons.residencias },
];

export default function MobTabBar({ active, role, lightTheme }: MobTabBarProps) {
  const [maisOpen, setMaisOpen] = useState(false);

  const maisTabs: Tab[] = role === "admin"
    ? adminTabs
    : role === "finance"
      ? [
          { href: "/clientes", label: "Clientes", id: "clientes", icon: icons.clientes },
          { href: "/pagamentos", label: "Pagamentos", id: "pagamentos", icon: icons.pagamentos },
        ]
      : role !== "limited_novalues"
        ? [{ href: "/materiais", label: "Materiais", id: "materiais", icon: icons.materiais }]
        : [];

  const activeMoreTab = maisTabs.find((tab) => tab.id === active);
  const drawerBg = lightTheme ? "#FFFFFF" : "var(--theme-surface)";
  const drawerBorder = lightTheme ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(var(--theme-accent-rgb),0.15)";
  const drawerMuted = lightTheme ? "rgba(0,0,0,0.68)" : "var(--theme-text-muted)";
  const drawerActive = lightTheme ? "#000000" : "var(--theme-accent)";
  const drawerActiveBg = lightTheme ? "rgba(0,0,0,0.06)" : "rgba(var(--theme-accent-rgb),0.08)";
  const drawerHandle = lightTheme ? "rgba(0,0,0,0.25)" : "rgba(var(--theme-accent-rgb),0.25)";
  const drawerTitle = lightTheme ? "rgba(0,0,0,0.52)" : "rgba(var(--theme-accent-rgb),0.45)";

  return (
    <>
      {maisOpen && (
        <button
          type="button"
          aria-label="Fechar painel de páginas"
          onClick={() => setMaisOpen(false)}
          className="mob-pages-overlay"
        />
      )}

      <section
        aria-hidden={!maisOpen}
        className={`mob-pages-drawer${maisOpen ? " open" : ""}`}
        style={{
          background: drawerBg,
          borderTop: drawerBorder,
          boxShadow: lightTheme ? "0 -8px 32px rgba(0,0,0,0.15)" : "0 -8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <div className="mob-pages-handle" style={{ background: drawerHandle }} />
        <p className="mob-pages-title" style={{ color: drawerTitle }}>Mais páginas</p>
        <div className="mob-pages-grid">
          {maisTabs.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              onClick={() => setMaisOpen(false)}
              className="mob-pages-item"
              style={{
                color: active === tab.id ? drawerActive : drawerMuted,
                background: active === tab.id ? drawerActiveBg : "transparent",
              }}
            >
              <span className="mob-pages-icon">{tab.icon}</span>
              <span className="mob-pages-label">{tab.label}</span>
            </a>
          ))}
        </div>
      </section>

      <nav className="mob-tabbar" aria-label="Navegação principal">
        {mainTabs.map((tab) => (
          <a key={tab.href} href={tab.href} className={`mob-tab${active === tab.id ? " active" : ""}`}>
            <span className="mob-tab-icon">{tab.icon}</span>
            <span className="mob-tab-label">{tab.label}</span>
          </a>
        ))}

        {maisTabs.length > 0 && (
          <button
            type="button"
            onClick={() => setMaisOpen((value) => !value)}
            className={`mob-tab${activeMoreTab ? " active" : ""}`}
            aria-expanded={maisOpen}
            aria-label={maisOpen ? "Fechar páginas" : "Abrir mais páginas"}
          >
            <span className="mob-tab-icon">
              {maisOpen ? icons.fechar : activeMoreTab?.icon ?? icons.mais}
            </span>
            <span className="mob-tab-label">
              {maisOpen ? "Fechar" : activeMoreTab?.label ?? "Mais"}
            </span>
          </button>
        )}
      </nav>
    </>
  );
}
