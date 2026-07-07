"use client";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAllClientes, createCliente, updateCliente, deleteCliente, setupDatabase } from "../actions";

interface Cliente {
  id: number; nome: string; nif?: string; email?: string;
  telefone?: string; notas?: string; alias?: string;
}

const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
};
const C_Light = {
  gold: "#000000", goldDim: "#000000", surface: "#FFFFFF",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#000000", textSec: "rgba(0,0,0,0.75)", textMuted: "rgba(0,0,0,0.55)",
  green: "#000000", amber: "#000000", blue: "#000000", red: "#000000",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;


const emptyForm = { nome: "", nif: "", email: "", telefone: "", notas: "", alias: "" };

function displayName(c: Cliente) {
  return c.alias?.trim() || c.nome;
}

export default function ClientesPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const router = useRouter();
  const [userName, setUserName] = useState("");
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
    await setupDatabase();
    const r = await getAllClientes();
    if (r.success) setClientes(r.data as Cliente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== "admin") { router.push("/agenda"); return; }
    setUserName(parsed.name);
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
    background: Colors.gold, border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.4em",
    fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };
  const btnSecStyle: React.CSSProperties = {
    background: "transparent", border: `1px solid ${Colors.border}`, color: Colors.textSec,
    fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600,
    padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
  };
  const overlayBottomStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)",
  };

  if (loading) {

  const Colors = getColors(lightTheme);
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: lightTheme ? "#FFFBF7" : "#0C0B09" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: Colors.gold, fontWeight: 300 }}>LLE</span>
      </div>
    );
  }

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: lightTheme ? "#FFFBF7" : "#0C0B09", color: Colors.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="clientes" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");  }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.textSec, textTransform: "uppercase", fontWeight: 600 }}>Clientes</p>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button onClick={openCreate} style={{ background: "transparent", border: `1px solid ${Colors.border}`, color: Colors.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
            Novo Cliente
          </button>
          </div>
        </div>

        <div style={{ background: Colors.surface, border: `1px solid ${Colors.borderDim}`, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
          <div style={{ borderBottom: `1px solid ${Colors.borderDim}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, alias, NIF ou email..."
              style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "none", color: Colors.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "0.9rem 1.5rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Alias / Nome app", "Nome Oficial", "NIF", "Email", "Telefone", "Notas", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: Colors.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${Colors.border}`, textAlign: i >= 6 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={tdS()}>
                      {c.alias?.trim()
                        ? <><span style={{ fontWeight: 700, fontSize: "12px" }}>{c.alias}</span></>
                        : <span style={{ color: Colors.textMuted, fontSize: "10px" }}>—</span>
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
                        <button onClick={() => handleDelete(c)} title="Eliminar" style={{ ...iconBtnStyle, color: Colors.red }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="3 6 4 14 12 14 13 6" /><path d="M2 6h12M10 6V4H6v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: Colors.textMuted, letterSpacing: "0.2em" }}>
                    {search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda. Clica em + Novo Cliente para começar."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: "0.75rem", fontSize: "8px", letterSpacing: "0.3em", color: Colors.textMuted, textTransform: "uppercase" }}>
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
        </div>
      </main>
    </div>

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "#F5F0E8", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(12,11,9,0.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>Clientes</span>
          <span style={{ fontSize: "8px", letterSpacing: "0.2em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar cliente..."
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "inherit", fontSize: "12px", padding: "0.6rem 0.9rem", outline: "none" }}
        />
        <button onClick={openCreate} style={{ background: "rgba(201,169,110,0.12)", border: "1px solid rgba(201,169,110,0.2)", color: "#C9A96E", fontSize: "16px", padding: "0.6rem 0.9rem", cursor: "pointer" }}>+</button>
      </div>

      <div className="mob-list">
        {filtered.map(c => (
          <div key={c.id} style={{ padding: "1rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#F5F0E8", marginBottom: "2px" }}>
                  {c.alias?.trim() || c.nome}
                </div>
                {c.alias?.trim() && (
                  <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.35)", marginBottom: "3px" }}>{c.nome}</div>
                )}
                {c.nif && <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.4)" }}>NIF: {c.nif}</div>}
                {c.email && <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.4)" }}>{c.email}</div>}
                {c.telefone && <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.4)" }}>{c.telefone}</div>}
              </div>
              <div style={{ display: "flex", gap: "4px", marginLeft: "0.75rem" }}>
                <button onClick={() => openEdit(c)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.5)", fontSize: "10px", padding: "6px 10px", cursor: "pointer" }}>✏️</button>
                <button onClick={() => handleDelete(c)} style={{ background: "rgba(226,75,74,0.08)", border: "1px solid rgba(226,75,74,0.2)", color: "#E24B4A", fontSize: "10px", padding: "6px 10px", cursor: "pointer" }}>🗑</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "rgba(245,240,232,0.2)", letterSpacing: "0.15em" }}>
            {search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          </div>
        )}
      </div>

      <MobTabBar active="clientes" role="admin" />
    </div>

    {/* ── Modal Criar / Editar ── */}
    {modal.open && (
      <>
        {/* Desktop modal */}
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeModal()} style={overlayStyle}>
          <div style={{ background: "#131108", border: `1px solid ${Colors.border}`, padding: "2.5rem", width: "560px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.75rem" }}>
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
          <div style={{ background: "#131108", borderTop: `1px solid ${Colors.border}`, width: "100%", maxHeight: "92dvh", overflowY: "auto", padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", borderRadius: "12px 12px 0 0", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.goldDim, textTransform: "uppercase", fontWeight: 600 }}>
                {modal.editing ? "Editar Cliente" : "Novo Cliente"}
              </p>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: Colors.textMuted, fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
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
          <div style={{ background: "#131108", border: `1px solid ${Colors.border}`, padding: "2rem", width: "400px", maxWidth: "90vw", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #E24B4A, transparent)" }} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: "#E24B4A", textTransform: "uppercase", fontWeight: 600, marginBottom: "1rem" }}>Confirmar eliminação</p>
            <p style={{ fontSize: "12px", color: Colors.textSec, marginBottom: "1.5rem" }}>Eliminar <strong style={{ color: Colors.textPrimary }}>{displayName(confirmDelete)}</strong>? Esta acção pode ser desfeita com Undo.</p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btnSecStyle}>Cancelar</button>
              <button onClick={confirmDoDelete} style={{ ...btnPrimStyle, background: "#E24B4A" }}>Eliminar</button>
            </div>
          </div>
        </div>
        <div className="mob-shell" onClick={() => setConfirmDelete(null)} style={overlayBottomStyle}>
          <div style={{ background: "#131108", borderTop: `1px solid ${Colors.border}`, width: "100%", padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", borderRadius: "12px 12px 0 0", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #E24B4A, transparent)" }} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: "#E24B4A", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>Eliminar cliente?</p>
            <p style={{ fontSize: "12px", color: Colors.textSec, marginBottom: "1.25rem" }}><strong style={{ color: Colors.textPrimary }}>{displayName(confirmDelete)}</strong></p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
              <button onClick={confirmDoDelete} style={{ ...btnPrimStyle, flex: 1, background: "#E24B4A" }}>Eliminar</button>
            </div>
          </div>
        </div>
      </>
    )}

    {/* Toast */}
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "#1a1408", border: `1px solid ${Colors.border}`, color: Colors.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "1rem" }}>
      <span>{toast}</span>
      {undoAction && (
        <button onClick={undoAction.fn} style={{ background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.3)", color: Colors.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.3rem 0.75rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
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
  color: "rgba(245,240,232,0.22)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem",
};
const inputStyleBase: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  color: "#F5F0E8", fontFamily: "'Montserrat',sans-serif", fontSize: "11px",
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
          style={{ ...inputStyleBase, border: "1px solid rgba(201,169,110,0.2)", background: "rgba(201,169,110,0.05)" }}
          value={form.alias}
          onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
          placeholder="Ex: Hyatt, Epic Sana..."
        />
        <p style={{ fontSize: "9px", color: "rgba(245,240,232,0.22)", marginTop: "0.4rem", letterSpacing: "0.05em" }}>Aparece nos dropdowns e listagens. Se vazio, usa o nome oficial.</p>
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
    fontSize: "11px", color: muted ? "rgba(245,240,232,0.45)" : "#F5F0E8",
    padding: "0.75rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.04)",
    whiteSpace: nowrap ? "nowrap" : undefined,
  };
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
  color: "rgba(245,240,232,0.35)", padding: "5px 7px", cursor: "pointer",
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
    { href: "/clientes", label: "Clientes" },
  ];
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/clientes"];
  const links = [
    ...(role === "admin" ? allLinks : allLinks.filter(l => !restrictedHrefs.includes(l.href))),
    ...(role !== "limited_novalues" ? [{ href: "/materiais", label: "Materiais" }] : []),
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, zIndex: 100, background: "rgba(12,11,9,0.95)", backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "#C9A96E" : "rgba(245,240,232,0.45)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "rgba(245,240,232,0.22)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "rgba(245,240,232,0.22)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
      </div>
    </nav>
  );
}

// ── Mobile Tab Bar — 4 fixos + "Mais" drawer ───────────────────────────────
function MobTabBar({ active, role }: { active: string; role: string }) {
  const [maisOpen, setMaisOpen] = useState(false);

  // Os 4 tabs fixos — sempre visíveis
  const mainTabs = [
    { href: "/agenda", label: "Agenda", id: "agenda", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
    { href: "/leads", label: "Leads", id: "leads", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    )},
    { href: "/faturacao", label: "Faturação", id: "faturacao", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
      </svg>
    )},
    { href: "/colaboradores", label: "Equipa", id: "colaboradores", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="18" cy="8" r="2.5"/><path d="M17 20c0-2 1.3-3.5 3-3.5"/>
      </svg>
    )},
  ];

  // Páginas no drawer "Mais" (admin only)
  const materiaisTab = { href: "/materiais", label: "Materiais", id: "materiais", icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 018 0v2"/>
    </svg>
  )};
  const maisTabs = role === "admin" ? [
    { href: "/clientes", label: "Clientes", id: "clientes", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/>
        <line x1="16" y1="11" x2="22" y2="11"/><line x1="19" y1="8" x2="19" y2="14"/>
      </svg>
    )},
    { href: "/pagamentos", label: "Pagamentos", id: "pagamentos", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="6" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="7" cy="15" r="1" fill="currentColor"/>
      </svg>
    )},
    { href: "/dashboard", label: "Dashboard", id: "dashboard", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )},
    materiaisTab,
  ] : role !== "limited_novalues" ? [materiaisTab] : [];

  const activeInMais = maisTabs.some(t => t.id === active);

  return (
    <>
      {/* Overlay para fechar drawer */}
      {maisOpen && (
        <div
          onClick={() => setMaisOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Drawer "Mais" — sobe por cima da tab bar */}
      <div style={{
        position: "fixed", bottom: "calc(60px + env(safe-area-inset-bottom))", left: 0, right: 0,
        zIndex: 200, transform: maisOpen ? "translateY(0)" : "translateY(110%)",
        transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
        background: "#131108", borderTop: "1px solid rgba(201,169,110,0.15)",
        borderRadius: "16px 16px 0 0", padding: "0.75rem 0.5rem",
        paddingBottom: "0.5rem",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
      }}>
        {/* Handle */}
        <div style={{ width: "36px", height: "3px", background: "rgba(201,169,110,0.25)", borderRadius: "2px", margin: "0 auto 0.75rem"  }}/>
        <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.4)", textTransform: "uppercase", textAlign: "center", marginBottom: "0.5rem", fontFamily: "'Montserrat',sans-serif" }}>Mais páginas</p>
        <div style={{ display: "flex", justifyContent: "space-around", padding: "0 0.5rem" }}>
          {maisTabs.map(t => (
            <a key={t.href} href={t.href} onClick={() => setMaisOpen(false)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                textDecoration: "none", padding: "0.6rem 1rem", minWidth: "72px",
                color: active === t.id ? "#C9A96E" : "rgba(245,240,232,0.4)",
                background: active === t.id ? "rgba(201,169,110,0.08)" : "transparent",
                borderRadius: "10px",
              }}>
              <span style={{ width: "22px", height: "22px", display: "block" }}>{t.icon}</span>
              <span style={{ fontSize: "9px", letterSpacing: "0.1em", fontFamily: "'Montserrat',sans-serif", fontWeight: active === t.id ? 600 : 400 }}>{t.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Tab bar principal */}
      <nav className="mob-tabbar">
        {mainTabs.map(l => (
          <a key={l.href} href={l.href} className={`mob-tab${active === l.id ? " active" : ""}`}>
            <span className="mob-tab-icon">{l.icon}</span>
            <span className="mob-tab-label">{l.label}</span>
          </a>
        ))}
        {/* Botão "Mais" — só para admin */}
        {maisTabs.length > 0 && (
          <button
            onClick={() => setMaisOpen(v => !v)}
            className={`mob-tab${activeInMais ? " active" : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <span className="mob-tab-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {maisOpen
                  ? <path d="M18 15l-6-6-6 6"/>
                  : <><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></>
                }
              </svg>
            </span>
            <span className="mob-tab-label">{maisOpen ? "Fechar" : "Mais"}</span>
          </button>
        )}
      </nav>
    </>
  );
}
