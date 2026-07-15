"use client";

import MobTabBar from "../MobTabBar";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAllClientes, createCliente, updateCliente, deleteCliente } from "../actions";

interface Cliente {
  id: number; nome: string; nif?: string; email?: string;
  telefone?: string; notas?: string; alias?: string;
}

const C = {
  gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)",
  border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
  textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)",
  green: "var(--theme-success)", amber: "var(--theme-warning)", blue: "var(--theme-info)", red: "var(--theme-danger)",
};

const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32", amber: "#A65300", blue: "#1565C0", red: "#C62828", purple: "#6A1B9A",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;


const emptyForm = { nome: "", nif: "", email: "", telefone: "", notas: "", alias: "" };

function displayName(c: Cliente) {
  return c.alias?.trim() || c.nome;
}

export default function ClientesPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing: Cliente | null }>({ open: false, editing: null });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null);
  const [toast, setToast] = useState("");
  const [undoAction, setUndoAction] = useState<{ label: string; fn: () => void } | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, undo?: { label: string; fn: () => void }) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setUndoAction(undo || null);
    const t = setTimeout(() => { setToast(""); setUndoAction(null); }, 4000);
    setToastTimer(t);
  };

  const load = useCallback(async () => {
    const r = await getAllClientes();
    if (r.success) setClientes(r.data as Cliente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (!["admin", "finance"].includes(parsed.role || "")) { router.push("/agenda"); return; }
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setModal({ open: true, editing: null });
  };

  const openEdit = (c: Cliente) => {
    setForm({ nome: c.nome, nif: c.nif || "", email: c.email || "", telefone: c.telefone || "", notas: c.notas || "", alias: c.alias || "" });
    setModal({ open: true, editing: c });
  };

  const closeModal = () => setModal({ open: false, editing: null });

  const handleSave = async () => {
    if (!form.nome.trim()) { showToast("Nome é obrigatório"); return; }
    setSaving(true);
    if (modal.editing) {
      await updateCliente(modal.editing.id, form);
      showToast("Cliente actualizado");
    } else {
      await createCliente(form);
      showToast("Cliente criado");
    }
    closeModal();
    load();
    setSaving(false);
  };

  const handleDelete = (c: Cliente) => {
    setConfirmDelete(c);
  };

  const confirmDoDelete = async () => {
    if (!confirmDelete) return;
    const snapshot = { ...confirmDelete };
    setConfirmDelete(null);
    // Remove optimistically
    setClientes(prev => prev.filter(x => x.id !== snapshot.id));
    showToast(`"${displayName(snapshot)}" eliminado`, {
      label: "Undo",
      fn: async () => {
        // Re-create the client (soft undo via re-insert)
        await createCliente({ nome: snapshot.nome, nif: snapshot.nif, email: snapshot.email, telefone: snapshot.telefone, notas: snapshot.notas, alias: snapshot.alias });
        setToast(""); setUndoAction(null);
        load();
      },
    });
    await deleteCliente(snapshot.id);
  };

  const filtered = clientes.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.alias || "").toLowerCase().includes(q) ||
      (c.nif || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  const btnPrimStyle: React.CSSProperties = {
    background: C.gold, border: "none", color: "var(--theme-accent-contrast)", fontSize: "9px", letterSpacing: "0.4em",
    fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };
  const btnSecStyle: React.CSSProperties = {
    background: "transparent", border: `1px solid ${C.border}`, color: C.textSec,
    fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600,
    padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
  };
  const overlayBottomStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: C.gold, fontWeight: 300 }}>LLE</span>
      </div>
    );
  }

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="clientes" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");  }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>Clientes</p>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button onClick={openCreate} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
            Novo Cliente
          </button>
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
          <div style={{ borderBottom: `1px solid ${C.borderDim}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, alias, NIF ou email..."
              style={{ width: "100%", background: "var(--theme-subtle-bg)", border: "none", color: C.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "0.9rem 1.5rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Alias / Nome app", "Nome Oficial", "NIF", "Email", "Telefone", "Notas", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, textAlign: i >= 6 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={tdS()}>
                      {c.alias?.trim()
                        ? <><span style={{ fontWeight: 700, fontSize: "12px" }}>{c.alias}</span></>
                        : <span style={{ color: C.textMuted, fontSize: "10px" }}>—</span>
                      }
                    </td>
                    <td style={tdS({ muted: true })}>{c.nome}</td>
                    <td style={tdS({ muted: true, nowrap: true })}>{c.nif || "—"}</td>
                    <td style={tdS({ muted: true })}>{c.email || "—"}</td>
                    <td style={tdS({ muted: true })}>{c.telefone || "—"}</td>
                    <td style={{ ...tdS({ muted: true }), maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.notas || "—"}</td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(c)} title="Editar" style={iconBtnStyle}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 2l3 3-9 9H2v-3L11 2z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(c)} title="Eliminar" style={{ ...iconBtnStyle, color: C.red }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="3 6 4 14 12 14 13 6" /><path d="M2 6h12M10 6V4H6v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>
                    {search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda. Clica em + Novo Cliente para começar."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: "0.75rem", fontSize: "8px", letterSpacing: "0.3em", color: C.textMuted, textTransform: "uppercase" }}>
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
        </div>
      </main>
    </div>

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "var(--theme-text)", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>Clientes</span>
          <span style={{ fontSize: "8px", letterSpacing: "0.2em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--theme-border)", display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar cliente..."
          style={{ flex: 1, background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "inherit", fontSize: "12px", padding: "0.6rem 0.9rem", outline: "none" }}
        />
        <button onClick={openCreate} style={{ background: "rgba(var(--theme-accent-rgb),0.12)", border: "1px solid rgba(var(--theme-accent-rgb),0.2)", color: "var(--theme-accent)", fontSize: "16px", padding: "0.6rem 0.9rem", cursor: "pointer" }}>+</button>
      </div>

      <div className="mob-list">
        {filtered.map(c => (
          <div key={c.id} style={{ padding: "1rem 1.1rem", borderBottom: "1px solid var(--theme-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--theme-text)", marginBottom: "2px" }}>
                  {c.alias?.trim() || c.nome}
                </div>
                {c.alias?.trim() && (
                  <div style={{ fontSize: "10px", color: "var(--theme-text-subtle)", marginBottom: "3px" }}>{c.nome}</div>
                )}
                {c.nif && <div style={{ fontSize: "10px", color: "var(--theme-text-muted)" }}>NIF: {c.nif}</div>}
                {c.email && <div style={{ fontSize: "10px", color: "var(--theme-text-muted)" }}>{c.email}</div>}
                {c.telefone && <div style={{ fontSize: "10px", color: "var(--theme-text-muted)" }}>{c.telefone}</div>}
              </div>
              <div style={{ display: "flex", gap: "4px", marginLeft: "0.75rem" }}>
                <button onClick={() => openEdit(c)} style={{ background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "10px", padding: "6px 10px", cursor: "pointer" }}>✏️</button>
                <button onClick={() => handleDelete(c)} style={{ background: "rgba(226,75,74,0.08)", border: "1px solid rgba(226,75,74,0.2)", color: "var(--theme-danger)", fontSize: "10px", padding: "6px 10px", cursor: "pointer" }}>🗑</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "var(--theme-text-faint)", letterSpacing: "0.15em" }}>
            {search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          </div>
        )}
      </div>

      <MobTabBar active="clientes" role={userRole} lightTheme={lightTheme} />
    </div>

    {/* ── Modal Criar / Editar ── */}
    {modal.open && (
      <>
        {/* Desktop modal */}
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeModal()} style={overlayStyle}>
          <div style={{ background: "var(--theme-surface)", border: `1px solid ${C.border}`, padding: "2.5rem", width: "560px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.75rem" }}>
              {modal.editing ? "Editar Cliente" : "Novo Cliente"}
            </p>
            <ClienteModalForm form={form} setForm={setForm} />
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button onClick={closeModal} style={btnSecStyle}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={btnPrimStyle}>{saving ? "A guardar..." : modal.editing ? "Guardar" : "Criar"}</button>
            </div>
          </div>
        </div>
        {/* Mobile bottom sheet */}
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeModal()} style={overlayBottomStyle}>
          <div style={{ background: "var(--theme-surface)", borderTop: `1px solid ${C.border}`, width: "100%", maxHeight: "92dvh", overflowY: "auto", padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", borderRadius: "12px 12px 0 0", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600 }}>
                {modal.editing ? "Editar Cliente" : "Novo Cliente"}
              </p>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: C.textMuted, fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <ClienteModalForm form={form} setForm={setForm} />
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={closeModal} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimStyle, flex: 2 }}>{saving ? "A guardar..." : modal.editing ? "Guardar" : "Criar"}</button>
            </div>
          </div>
        </div>
      </>
    )}

    {/* ── Confirm Delete ── */}
    {confirmDelete && (
      <>
        <div className="mob-page-desktop" onClick={() => setConfirmDelete(null)} style={overlayStyle}>
          <div style={{ background: "var(--theme-surface)", border: `1px solid ${C.border}`, padding: "2rem", width: "400px", maxWidth: "90vw", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-danger), transparent)" }} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: "var(--theme-danger)", textTransform: "uppercase", fontWeight: 600, marginBottom: "1rem" }}>Confirmar eliminação</p>
            <p style={{ fontSize: "12px", color: C.textSec, marginBottom: "1.5rem" }}>Eliminar <strong style={{ color: C.textPrimary }}>{displayName(confirmDelete)}</strong>? Esta acção pode ser desfeita com Undo.</p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btnSecStyle}>Cancelar</button>
              <button onClick={confirmDoDelete} style={{ ...btnPrimStyle, background: "var(--theme-danger)" }}>Eliminar</button>
            </div>
          </div>
        </div>
        <div className="mob-shell" onClick={() => setConfirmDelete(null)} style={overlayBottomStyle}>
          <div style={{ background: "var(--theme-surface)", borderTop: `1px solid ${C.border}`, width: "100%", padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", borderRadius: "12px 12px 0 0", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-danger), transparent)" }} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: "var(--theme-danger)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>Eliminar cliente?</p>
            <p style={{ fontSize: "12px", color: C.textSec, marginBottom: "1.25rem" }}><strong style={{ color: C.textPrimary }}>{displayName(confirmDelete)}</strong></p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
              <button onClick={confirmDoDelete} style={{ ...btnPrimStyle, flex: 1, background: "var(--theme-danger)" }}>Eliminar</button>
            </div>
          </div>
        </div>
      </>
    )}

    {/* Toast */}
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "var(--theme-toast-bg)", border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "1rem" }}>
      <span>{toast}</span>
      {undoAction && (
        <button onClick={undoAction.fn} style={{ background: "rgba(var(--theme-accent-rgb),0.15)", border: "1px solid rgba(var(--theme-accent-rgb),0.3)", color: C.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.3rem 0.75rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
          {undoAction.label}
        </button>
      )}
    </div>
    </>
  );
}

// ── Formulário do modal — fora do componente principal para evitar remount a cada keystroke ──
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "7px", letterSpacing: "0.4em",
  color: "var(--theme-text-faint)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem",
};
const inputStyleBase: React.CSSProperties = {
  width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)",
  color: "var(--theme-text)", fontFamily: "'Montserrat',sans-serif", fontSize: "11px",
  padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box",
};

function ClienteModalForm({ form, setForm }: {
  form: { alias: string; nome: string; nif: string; telefone: string; email: string; notas: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Alias / Nome visível na app</label>
        <input
          style={{ ...inputStyleBase, border: "1px solid rgba(var(--theme-accent-rgb),0.2)", background: "rgba(var(--theme-accent-rgb),0.05)" }}
          value={form.alias}
          onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
          placeholder="Ex: Hyatt, Epic Sana..."
        />
        <p style={{ fontSize: "9px", color: "var(--theme-text-faint)", marginTop: "0.4rem", letterSpacing: "0.05em" }}>Aparece nos dropdowns e listagens. Se vazio, usa o nome oficial.</p>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Nome Oficial *</label>
        <input
          style={inputStyleBase}
          value={form.nome}
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          placeholder="Nome completo / razão social..."
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }} className="mob-form-grid">
        <div>
          <label style={labelStyle}>NIF</label>
          <input style={inputStyleBase} value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} placeholder="123456789" />
        </div>
        <div>
          <label style={labelStyle}>Telefone</label>
          <input style={inputStyleBase} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="+351..." />
        </div>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Email</label>
        <input style={inputStyleBase} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.pt" />
      </div>
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={labelStyle}>Notas</label>
        <textarea
          style={{ ...inputStyleBase, height: "70px", resize: "vertical" }}
          value={form.notas}
          onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
          placeholder="Notas internas..."
        />
      </div>
    </>
  );
}

function tdS({ muted, nowrap }: { muted?: boolean; nowrap?: boolean } = {}): React.CSSProperties {
  return {
    fontSize: "11px", color: muted ? "var(--theme-text-muted)" : "var(--theme-text)",
    padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--theme-border)",
    whiteSpace: nowrap ? "nowrap" : undefined,
  };
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(var(--theme-contrast-rgb),0.06)",
  color: "var(--theme-text-subtle)", padding: "5px 7px", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const allLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/agenda", label: "Agenda" },
    { href: "/leads", label: "Leads" },
    { href: "/faturacao", label: "Faturação" },
    { href: "/pagamentos", label: "Pagamentos" },
    { href: "/colaboradores", label: "Colaboradores" },
    { href: "/valores", label: "Valores" }, { href: "/residencias", label: "Residências" },
    { href: "/clientes", label: "Clientes" },
  ];
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/valores", "/residencias", "/clientes"];
  const financeHrefs = ["/agenda", "/leads", "/faturacao", "/pagamentos", "/clientes"];
  const financeLinks = [
    ...allLinks.filter(l => financeHrefs.includes(l.href)),
    ...(allLinks.some(l => l.href === "/clientes") ? [] : [{ href: "/clientes", label: "Clientes" }]),
  ].filter((l, i, arr) => arr.findIndex(x => x.href === l.href) === i);
  const baseLinks = role === "admin" ? allLinks : role === "finance" ? financeLinks : allLinks.filter(l => !restrictedHrefs.includes(l.href));
  const links = [
    ...baseLinks,
    ...((role !== "limited_novalues" && role !== "finance") ? [{ href: "/materiais", label: "Materiais" }] : []),
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid var(--theme-border)", position: "sticky", top: 0, zIndex: 100, background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "var(--theme-accent)" : "var(--theme-text-muted)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-faint)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
      </div>
    </nav>
  );
}

