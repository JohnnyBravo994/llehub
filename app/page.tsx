"use client";

import { useState } from "react";

const USERS: Record<string, { password: string; name: string; role: string }> = {
  "João":    { password: "Issimple1!",   name: "João",    role: "admin" },
  "Tânia":   { password: "#Num3r0121!",  name: "Tânia",   role: "admin" },
  "Soraya":  { password: "SorayaLLE!",   name: "Soraya",  role: "admin" },
  "Inês":    { password: "InesLLE2407!", name: "Inês",    role: "finance" },
  "Larissa": { password: "LarissaLLE!",  name: "Larissa", role: "limited_novalues" },
};

export default function Home() {
  const [selectedUser, setSelectedUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!selectedUser || !password) return;
    setIsLoading(true);
    setError("");
    const u = USERS[selectedUser];
    if (!u || u.password !== password) {
      setError("Password incorrecta.");
      setIsLoading(false);
      return;
    }
    localStorage.setItem("lle_user", JSON.stringify({ name: u.name, role: u.role }));
    window.location.href = u.role === "finance" ? "/agenda" : "/dashboard";
  };

  const members = [
    { value: "João",    label: "João" },
    { value: "Tânia",   label: "Tânia" },
    { value: "Soraya",  label: "Soraya" },
    { value: "Inês",    label: "Inês" },
    { value: "Larissa", label: "Larissa" },
  ];

  const C = {
    gold: "var(--theme-accent)",
    bg: "var(--theme-bg)",
    surface: "var(--theme-surface)",
    border: "rgba(var(--theme-accent-rgb),0.18)",
    borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
    textPrimary: "var(--theme-text)",
    textMuted: "var(--theme-text-secondary)",
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif", padding: "2rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "600px", border: "1px solid rgba(var(--theme-accent-rgb),0.04)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "400px", height: "400px", border: "1px solid rgba(var(--theme-accent-rgb),0.06)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "200px", height: "200px", border: "1px solid rgba(var(--theme-accent-rgb),0.08)", borderRadius: "50%", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: "400px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ display: "inline-block", position: "relative" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "4rem", letterSpacing: "0.5em", color: C.gold, fontWeight: 300, lineHeight: 1, paddingRight: "0.5em" }}>LLE</h1>
            <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)", marginTop: "0.75rem" }} />
          </div>
          <p style={{ fontSize: "7px", letterSpacing: "0.6em", color: "var(--theme-text-faint)", fontWeight: 500, marginTop: "1rem", textTransform: "uppercase" }}>Life · Live · Event</p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "0.85rem", color: "var(--theme-text-faint)", fontStyle: "italic", fontWeight: 300, marginTop: "0.4rem", letterSpacing: "0.1em" }}>Management Hub</p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "3rem", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />

          <p style={{ fontSize: "7px", letterSpacing: "0.5em", color: "var(--theme-accent-muted)", fontWeight: 600, marginBottom: "2rem", textTransform: "uppercase" }}>Identificação</p>

          {/* Membro */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase" }}>Membro da Equipa</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {members.map((m) => (
                <button
                  key={m.value}
                  onClick={() => { setSelectedUser(m.value); setPassword(""); setError(""); }}
                  disabled={isLoading}
                  style={{
                    background: selectedUser === m.value ? "rgba(var(--theme-accent-rgb),0.08)" : "transparent",
                    border: "none", borderBottom: `1px solid ${C.borderDim}`,
                    color: selectedUser === m.value ? C.textPrimary : C.textMuted,
                    fontSize: "11px", letterSpacing: "0.2em", padding: "0.85rem 0.75rem",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    fontWeight: selectedUser === m.value ? 600 : 400,
                    transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "0.75rem", textTransform: "uppercase",
                  }}
                >
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: selectedUser === m.value ? C.gold : "rgba(var(--theme-contrast-rgb),0.1)", flexShrink: 0, transition: "background 0.2s" }} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          {selectedUser && (
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••••"
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(var(--theme-contrast-rgb),0.03)", border: `1px solid ${error ? "rgba(255,80,80,0.4)" : C.border}`,
                  color: C.textPrimary, fontFamily: "inherit", fontSize: "14px",
                  padding: "0.75rem 1rem", outline: "none", letterSpacing: "0.15em",
                }}
              />
              {error && <p style={{ fontSize: "9px", color: "rgba(255,100,100,0.8)", marginTop: "0.5rem", letterSpacing: "0.15em" }}>{error}</p>}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading || !selectedUser || !password}
            style={{
              width: "100%",
              background: selectedUser && password && !isLoading ? C.gold : "rgba(var(--theme-accent-rgb),0.15)",
              border: "none",
              color: selectedUser && password && !isLoading ? "var(--theme-bg)" : "rgba(var(--theme-accent-rgb),0.4)",
              fontSize: "8px", letterSpacing: "0.5em", fontWeight: 700, padding: "1.1rem",
              cursor: selectedUser && password && !isLoading ? "pointer" : "not-allowed",
              fontFamily: "inherit", textTransform: "uppercase", transition: "all 0.3s ease",
            }}
          >
            {isLoading ? "A VERIFICAR..." : "ACEDER AO SISTEMA"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "7px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", marginTop: "2rem", textTransform: "uppercase" }}>Sistema Privado · Acesso Restrito</p>
      </div>
    </main>
  );
}
