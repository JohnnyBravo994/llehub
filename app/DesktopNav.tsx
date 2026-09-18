"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type NavItem = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

type Props = {
  userName: string;
  active: string;
  onLogout: () => void;
};

const ALL_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agenda", label: "Agenda" },
  { href: "/leads", label: "Leads" },
  { href: "/clientes", label: "Clientes" },
  { href: "/faturacao", label: "Faturação" },
  { href: "/pagamentos", label: "Pagamentos" },
  { href: "/colaboradores", label: "Colaboradores" },
  { href: "/packs", label: "Packs" },
  { href: "/residencias", label: "Residências" },
  { href: "/valores", label: "Valores" },
];

const MATERIALS: NavItem = { href: "/materiais", label: "Materiais" };

function currentRole() {
  if (typeof window === "undefined") return "admin";
  try {
    const raw = localStorage.getItem("lle_user");
    return raw ? JSON.parse(raw)?.role || "admin" : "admin";
  } catch {
    return "admin";
  }
}

function allowedLinks(role: string) {
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/valores", "/packs", "/residencias", "/clientes"];
  const financeHrefs = ["/agenda", "/leads", "/faturacao", "/pagamentos", "/clientes"];

  let base: NavItem[];
  if (role === "admin") base = [...ALL_LINKS];
  else if (role === "finance") base = ALL_LINKS.filter(l => financeHrefs.includes(l.href));
  else base = ALL_LINKS.filter(l => !restrictedHrefs.includes(l.href));

  if (role !== "limited_novalues" && role !== "finance") base.push(MATERIALS);
  return base.filter((l, i, arr) => arr.findIndex(x => x.href === l.href) === i);
}

export default function DesktopNav({ userName, active, onLogout }: Props) {
  const [role, setRole] = useState("admin");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => setRole(currentRole()), []);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenGroup(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const allowed = useMemo(() => allowedLinks(role), [role]);
  const direct = ["/dashboard", "/agenda", "/leads", "/clientes"].map(href => allowed.find(x => x.href === href)).filter(Boolean) as NavItem[];
  const groups: NavGroup[] = [
    {
      id: "operacao",
      label: "Operação",
      items: ["/colaboradores", "/packs", "/residencias", "/materiais"].map(href => allowed.find(x => x.href === href)).filter(Boolean) as NavItem[],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      items: ["/faturacao", "/pagamentos"].map(href => allowed.find(x => x.href === href)).filter(Boolean) as NavItem[],
    },
    {
      id: "gestao",
      label: "Gestão",
      items: ["/valores"].map(href => allowed.find(x => x.href === href)).filter(Boolean) as NavItem[],
    },
  ].filter(g => g.items.length > 0);

  const activeHref = `/${active}`;
  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    color: isActive ? "var(--theme-text)" : "var(--theme-text-muted)",
    background: isActive ? "rgba(var(--theme-accent-rgb),0.10)" : "transparent",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: isActive ? 700 : 600,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    transition: "background .15s ease, color .15s ease",
  });

  return (
    <nav ref={rootRef} className="desktop-main-nav" aria-label="Navegação principal">
      <div className="desktop-main-nav-inner">
        <a href="/agenda" className="desktop-brand" aria-label="LLE Hub">
          <span className="desktop-brand-mark">LLE</span>
          <span className="desktop-brand-hub">Hub</span>
        </a>

        <div className="desktop-nav-center">
          {direct.map(item => (
            <a key={item.href} href={item.href} style={linkStyle(activeHref === item.href)}>{item.label}</a>
          ))}

          {groups.map(group => {
            const groupActive = group.items.some(item => item.href === activeHref);
            const open = openGroup === group.id;
            return (
              <div key={group.id} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  aria-expanded={open}
                  style={{
                    ...linkStyle(groupActive),
                    border: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    gap: 7,
                  }}
                >
                  {group.label}
                  <span aria-hidden="true" style={{ fontSize: 10, opacity: .7, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>⌄</span>
                </button>

                {open && (
                  <div className="desktop-nav-dropdown">
                    {group.items.map(item => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenGroup(null)}
                        className={activeHref === item.href ? "desktop-nav-dropdown-item active" : "desktop-nav-dropdown-item"}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="desktop-nav-user">
          <div className="desktop-nav-user-copy">
            <span className="desktop-nav-user-label">Sessão</span>
            <span className="desktop-nav-user-name">{userName || "Utilizador"}</span>
          </div>
          <button type="button" onClick={onLogout} className="desktop-nav-logout">Sair</button>
        </div>
      </div>
    </nav>
  );
}
