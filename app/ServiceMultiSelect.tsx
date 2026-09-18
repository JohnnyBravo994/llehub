"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SERVICOS_VENDIDOS,
  isAutoBudgetPackService,
  parseServicosContratados,
  serializeServicosContratados,
} from "./constants";

export function ServiceMultiSelect({
  value,
  onChange,
  placeholder = "Selecionar serviços...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = useMemo(() => parseServicosContratados(value), [value]);
  const allOptions = useMemo(() => {
    const merged = [...SERVICOS_VENDIDOS, ...selected.filter(s => !SERVICOS_VENDIDOS.includes(s as any))];
    return Array.from(new Set(merged));
  }, [selected]);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-PT");
  const filtered = allOptions.filter(s => s.toLocaleLowerCase("pt-PT").includes(normalizedSearch));
  const packs = filtered
    .filter(isAutoBudgetPackService)
    .sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
  const standalones = filtered
    .filter(service => !isAutoBudgetPackService(service))
    .sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
  const exactExists = allOptions.some(s => s.toLocaleLowerCase("pt-PT") === normalizedSearch);

  const setSelected = (items: string[]) => onChange(serializeServicosContratados(items));
  const toggle = (service: string) => {
    if (selected.includes(service)) setSelected(selected.filter(s => s !== service));
    else setSelected([...selected, service]);
  };
  const addCustom = () => {
    const custom = search.trim();
    if (!custom || selected.includes(custom)) return;
    setSelected([...selected, custom]);
    setSearch("");
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", minHeight: "58px", padding: selected.length ? "0.65rem 0.8rem" : "0 1rem",
          background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)",
          color: selected.length ? "var(--theme-text)" : "var(--theme-text-faint)", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem",
          cursor: "pointer", textAlign: "left", boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", flex: 1 }}>
          {selected.length === 0 ? (
            <span style={{ fontSize: "11px", letterSpacing: "0.04em" }}>{placeholder}</span>
          ) : selected.map(service => (
            <span key={service} style={{
              display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 8px",
              border: "1px solid rgba(var(--theme-accent-rgb),0.2)",
              background: "rgba(var(--theme-accent-rgb),0.07)", color: "var(--theme-accent)",
              fontSize: "9px", letterSpacing: "0.04em",
            }}>
              ✓ {service}
            </span>
          ))}
        </div>
        <span style={{ color: "var(--theme-text-faint)", fontSize: "12px", flexShrink: 0 }}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", zIndex: 10000, left: 0, right: 0, top: "calc(100% + 4px)",
          background: "var(--theme-surface-elevated)", border: "1px solid var(--theme-input-border)",
          boxShadow: "var(--theme-dropdown-shadow)", padding: "0.65rem", maxHeight: "360px", overflow: "hidden",
        }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "0.55rem" }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && normalizedSearch && !exactExists) { e.preventDefault(); addCustom(); } }}
              placeholder="Pesquisar ou escrever serviço..."
              style={{
                flex: 1, height: "38px", padding: "0 0.75rem", background: "var(--theme-input-bg)",
                border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", outline: "none",
                fontFamily: "inherit", fontSize: "10px",
              }}
            />
            {normalizedSearch && !exactExists && (
              <button type="button" onClick={addCustom} style={{
                border: "1px solid rgba(var(--theme-accent-rgb),0.25)", background: "rgba(var(--theme-accent-rgb),0.08)",
                color: "var(--theme-accent)", padding: "0 0.8rem", cursor: "pointer", fontFamily: "inherit",
                fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase",
              }}>Adicionar</button>
            )}
          </div>

          <div style={{ maxHeight: "280px", overflowY: "auto" }}>
            {[
              { label: "PACKS", items: packs },
              { label: "STANDALONES", items: standalones },
            ].map(group => group.items.length > 0 && (
              <div key={group.label}>
                <div style={{
                  position: "sticky", top: 0, zIndex: 2, padding: "0.55rem 0.65rem 0.4rem",
                  background: "var(--theme-surface-elevated)", color: "var(--theme-accent)",
                  fontSize: "8px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
                  borderBottom: "1px solid var(--theme-border)",
                }}>
                  {group.label}
                </div>
                {group.items.map(service => {
                  const active = selected.includes(service);
                  return (
                    <button key={service} type="button" onClick={() => toggle(service)} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "0.55rem 0.65rem",
                      border: "none", borderBottom: "1px solid var(--theme-border)", background: active ? "rgba(var(--theme-accent-rgb),0.06)" : "transparent",
                      color: active ? "var(--theme-accent)" : "var(--theme-text-secondary)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}>
                      <span style={{
                        width: "15px", height: "15px", flexShrink: 0, display: "grid", placeItems: "center",
                        border: `1px solid ${active ? "var(--theme-accent)" : "var(--theme-input-border)"}`,
                        background: active ? "rgba(var(--theme-accent-rgb),0.12)" : "transparent", fontSize: "9px",
                      }}>{active ? "✓" : ""}</span>
                      <span style={{ fontSize: "10px" }}>{service}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "1rem", color: "var(--theme-text-faint)", fontSize: "10px", textAlign: "center" }}>Sem resultados</div>
            )}
          </div>

          {selected.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.55rem" }}>
              <span style={{ color: "var(--theme-text-faint)", fontSize: "8px", letterSpacing: "0.1em" }}>{selected.length} selecionado{selected.length === 1 ? "" : "s"}</span>
              <button type="button" onClick={() => setSelected([])} style={{ border: "none", background: "transparent", color: "var(--theme-danger)", cursor: "pointer", fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Limpar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
