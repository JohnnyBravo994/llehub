"use client";

import MobTabBar from "../MobTabBar";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ARTIST_TIPOS, resolveColaboradorNome } from "../constants";
import { getPagamentosPageBundle, updatePagamento, deletePagamento, addPagamento, getAllColaboradores, getAllPagamentos } from "../actions";

interface Pagamento {
  id: number; evento_id: number; evento_nome: string; evento_data: string;
  nome: string; tipo: string; fee: number; evento_status?: string;
  evento_cachet: number;
}

interface Colaborador {
  id: number; nome: string; iban: string; skills: string; ativo: number;
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


function resolveNome(nome: string): string { return resolveColaboradorNome(nome); }
function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}

function monthShort(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  const mon = d.toLocaleDateString("pt-PT", { month: "short" });
  return mon.charAt(0).toUpperCase() + mon.slice(1).replace(".", "");
}

function groupByMonth(data: Pagamento[]) {
  const map: Record<string, Pagamento[]> = {};
  for (const p of data) {
    const key = p.evento_data.slice(0, 7);
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }
  return map;
}

const ANNIA_NOME = "annia";

function calcLucro(rows: Pagamento[]) {
  const eventosVistos = new Map<number, number>();
  for (const p of rows) {
    if (!eventosVistos.has(p.evento_id)) {
      eventosVistos.set(p.evento_id, p.evento_cachet);
    }
  }
  const faturado = Array.from(eventosVistos.values()).reduce((s, v) => s + v, 0);
  const custos = rows
    .filter(p => !p.nome.toLowerCase().includes(ANNIA_NOME))
    .reduce((s, p) => s + p.fee, 0);
  const lucro = faturado - custos;
  return { faturado, custos, lucro };
}

export default function PagamentosPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", tipo: "DJ", fee: 0 });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [addModal, setAddModal] = useState<{ open: boolean; evento_id: number; evento_nome: string; evento_data: string } | null>(null);
  const [addForm, setAddForm] = useState({ nome: "", tipo: "DJ", fee: 0 });
  const [resumoOpen, setResumoOpen] = useState(false);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    const bundle = await getPagamentosPageBundle();
    if (bundle.success) {
      const r = bundle.pagamentos;
      const cr = bundle.colaboradores;
      if (r?.success) setPagamentos(r.data as Pagamento[]);
      if (cr?.success) setColaboradores(cr.data as Colaborador[]);
    }
    setLoading(false);
  }, []);

  function lookupIban(nome: string): string {
    const lower = nome.trim().toLowerCase();
    const found = (colaboradores as Colaborador[]).find(c => c.nome.trim().toLowerCase() === lower);
    return found?.iban || "";
  }

  function exportCSV() {
    const rows = selectedMonth ? (byMonth[selectedMonth] || []) : [];
    if (rows.length === 0) { showToast("Sem dados para exportar"); return; }
    const grouped: Record<string, { dias: string[]; fee: number }> = {};
    for (const p of rows) {
      const key = resolveNome(p.nome);
      if (!grouped[key]) grouped[key] = { dias: [], fee: 0 };
      grouped[key].dias.push(p.evento_data.slice(8));
      grouped[key].fee += p.fee;
    }
    const esc = (v: string) => (v.includes(";") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      ["Colaborador", "Dia Evento", "IBAN", "Montante", "Comentário"].join(";"),
      ...Object.entries(grouped).map(([nome, g]) => {
        const iban = lookupIban(nome);
        const montante = g.fee.toLocaleString("pt-PT", { minimumFractionDigits: 2 }) + " €";
        return [esc(nome), esc(g.dias.join(", ")), iban ? `="${iban}"` : "", esc(montante), ""].join(";");
      }),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const [y, m] = (selectedMonth || "").split("-");
    const mName = selectedMonth ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-PT", { month: "long" }) : "todos";
    a.href = url; a.download = `pagamentos_${mName}_${y || ""}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exportado");
  }

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (!["admin", "finance"].includes(parsed.role || "")) { router.push("/agenda"); return; }
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    load();
  }, [load]);

  const filtered = pagamentos.filter(p => p.evento_data.startsWith(selectedYear));
  const byMonth = groupByMonth(filtered);
  const months = Object.keys(byMonth).sort();

  // Auto-select current or latest month when year changes
  useEffect(() => {
    if (months.length === 0) { setSelectedMonth(""); return; }
    const currentYM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    if (months.includes(currentYM)) {
      setSelectedMonth(currentYM);
    } else {
      setSelectedMonth(months[months.length - 1]);
    }
  }, [selectedYear, months.join(",")]);

  const years = Array.from(new Set(pagamentos.map(p => p.evento_data.slice(0, 4)))).sort();

  const { faturado: faturadoAno, custos: custosAno, lucro: lucroAno } = calcLucro(filtered);

  const activeRows = selectedMonth ? (byMonth[selectedMonth] || []) : [];
  const { faturado: faturadoMes, custos: custosMes, lucro: lucroMes } = calcLucro(activeRows);

  const startEdit = (p: Pagamento) => {
    setEditingId(p.id);
    setEditForm({ nome: p.nome, tipo: p.tipo, fee: p.fee });
  };

  const saveEdit = async (p: Pagamento) => {
    setSaving(true);
    await updatePagamento(p.id, editForm);
    setEditingId(null);
    showToast("Pagamento actualizado");
    load();
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este pagamento?")) return;
    await deletePagamento(id);
    showToast("Removido");
    load();
  };

  const openAddModal = (p: Pagamento) => {
    setAddModal({ open: true, evento_id: p.evento_id, evento_nome: p.evento_nome, evento_data: p.evento_data });
    setAddForm({ nome: "", tipo: "DJ", fee: 0 });
  };

  const handleAddPagamento = async () => {
    if (!addModal || !addForm.nome.trim()) { showToast("Nome obrigatório"); return; }
    setSaving(true);
    await addPagamento({ ...addModal, ...addForm });
    setAddModal(null);
    showToast("Artista adicionado");
    load();
    setSaving(false);
  };

  if (loading) return <Loading />;

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="pagamentos" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");   }} />

      <main style={{ padding: "2rem 2.5rem", maxWidth: "1200px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.25rem" }}>Pagamentos a Artistas</p>
            <p style={{ fontSize: "11px", color: C.textMuted }}>Gestão de cachets e fees por evento</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {/* Yearly totals */}
            <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", marginBottom: "4px" }}>Faturado {selectedYear}</p>
                <p style={{ fontSize: "1.1rem", color: C.gold, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, letterSpacing: "0.05em" }}>{faturadoAno.toLocaleString("pt-PT")}€</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", marginBottom: "4px" }}>Custos {selectedYear}</p>
                <p style={{ fontSize: "1.1rem", color: C.red, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, letterSpacing: "0.05em" }}>−{custosAno.toLocaleString("pt-PT")}€</p>
              </div>
              <div style={{ textAlign: "right", borderLeft: `1px solid ${C.border}`, paddingLeft: "2rem" }}>
                <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", marginBottom: "4px" }}>Lucro {selectedYear}</p>
                <p style={{ fontSize: "1.4rem", color: lucroAno >= 0 ? C.green : C.red, fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, letterSpacing: "0.05em" }}>{lucroAno.toLocaleString("pt-PT")}€</p>
              </div>
            </div>
            {/* Year selector */}
            <div style={{ display: "flex", gap: "4px" }}>
              {years.map(y => (
                <button key={y} onClick={() => setSelectedYear(y)} style={{ background: selectedYear === y ? "rgba(var(--theme-accent-rgb),0.12)" : "transparent", border: `1px solid ${selectedYear === y ? C.gold : C.borderDim}`, color: selectedYear === y ? C.gold : C.textMuted, fontSize: "9px", letterSpacing: "0.3em", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit", fontWeight: selectedYear === y ? 700 : 400 }}>{y}</button>
              ))}
            </div>
            <button
              onClick={() => setResumoOpen(true)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.gold, fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="11" y2="9"/><line x1="5" y1="12" x2="8" y2="12"/></svg>
              Resumo Artistas
            </button>
            <button
              onClick={exportCSV}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.green, fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M8 2v8M5 7l3 3 3-3M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1"/></svg>
              Exportar CSV
            </button>
          </div>
        </div>

        {months.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: C.textMuted, fontSize: "11px", letterSpacing: "0.2em" }}>
            Sem pagamentos registados para {selectedYear}.<br />
            <span style={{ fontSize: "9px", marginTop: "0.5rem", display: "block" }}>Adiciona artistas na Agenda ao editar um evento.</span>
          </div>
        ) : (
          <>
            {/* ── Month Tabs ── */}
            <div style={{ display: "flex", gap: "0", marginBottom: "0", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
              {months.map(month => {
                const isActive = selectedMonth === month;
                const rows = byMonth[month];
                const { lucro } = calcLucro(rows);
                return (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    style={{
                      background: isActive ? "rgba(var(--theme-accent-rgb),0.07)" : "transparent",
                      border: "none",
                      borderBottom: isActive ? `2px solid ${C.gold}` : "2px solid transparent",
                      color: isActive ? C.gold : C.textMuted,
                      fontSize: "8px",
                      letterSpacing: "0.35em",
                      padding: "0.75rem 1.25rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: isActive ? 700 : 400,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      position: "relative",
                      top: "1px",
                      transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    <span>{monthShort(month)}</span>
                    <span style={{
                      fontSize: "7px",
                      letterSpacing: "0.1em",
                      color: isActive ? (lucro >= 0 ? C.green : C.red) : C.textMuted,
                      fontWeight: isActive ? 700 : 400,
                    }}>
                      {lucro >= 0 ? "+" : ""}{lucro.toLocaleString("pt-PT")}€
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Active Month Content ── */}
            {selectedMonth && (
              <div style={{ marginTop: "1.75rem" }}>
                {/* Month stats bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <span style={{ fontSize: "10px", letterSpacing: "0.4em", color: C.gold, textTransform: "capitalize", fontWeight: 700 }}>
                    {monthLabel(selectedMonth)}
                  </span>
                  <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "6px", letterSpacing: "0.35em", color: C.textMuted, textTransform: "uppercase", marginBottom: "2px" }}>Faturado</p>
                      <p style={{ fontSize: "11px", color: C.gold, fontWeight: 600 }}>{faturadoMes.toLocaleString("pt-PT")}€</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "6px", letterSpacing: "0.35em", color: C.textMuted, textTransform: "uppercase", marginBottom: "2px" }}>Custos</p>
                      <p style={{ fontSize: "11px", color: C.red, fontWeight: 600 }}>−{custosMes.toLocaleString("pt-PT")}€</p>
                    </div>
                    <div style={{ textAlign: "right", borderLeft: `1px solid ${C.border}`, paddingLeft: "1.5rem" }}>
                      <p style={{ fontSize: "6px", letterSpacing: "0.35em", color: C.textMuted, textTransform: "uppercase", marginBottom: "2px" }}>Lucro</p>
                      <p style={{ fontSize: "13px", color: lucroMes >= 0 ? C.green : C.red, fontWeight: 700 }}>{lucroMes.toLocaleString("pt-PT")}€</p>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent)44, transparent)" }} />
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Data", "Evento", "Artista", "Tipo", "Fee", "Ações"].map((h, i) => (
                          <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.6rem 1rem", borderBottom: `1px solid ${C.border}`, textAlign: i >= 4 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeRows.map(p => {
                        const isEditing = editingId === p.id;
                        const isAnnia = p.nome.toLowerCase().includes(ANNIA_NOME);
                        return (
                          <tr key={p.id} style={{ background: isAnnia ? "rgba(95,202,165,0.04)" : undefined }}>
                            <td style={tds({ muted: true, nowrap: true })}>{fmtDate(p.evento_data)}</td>
                            <td style={tds({ maxW: "220px" })}>
                              <span style={{ fontSize: "11px" }}>{p.evento_nome}</span>
                              {p.evento_status === 'Cancelado' && <span style={{ fontSize: "8px", color: C.red, marginLeft: "6px" }}>[CANC]</span>}
                            </td>
                            <td style={tds({})}>
                              {isEditing
                                ? <input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} style={{ ...inlineInput, width: "140px"   }} />
                                : <span style={{ fontSize: "11px", color: isAnnia ? C.green : C.textPrimary }}>{resolveNome(p.nome)}</span>
                              }
                            </td>
                            <td style={tds({ muted: true })}>
                              {isEditing
                                ? <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))} style={{ ...inlineInput, width: "110px", appearance: "none" as any }}>{ARTIST_TIPOS.map(t => <option key={t}>{t}</option>)}</select>
                                : <span style={{ fontSize: "9px", letterSpacing: "0.1em" }}>{p.tipo}</span>
                              }
                            </td>
                            <td style={{ ...tds({}), textAlign: "right" }}>
                              {isEditing
                                ? <input type="number" value={editForm.fee} onChange={e => setEditForm(f => ({ ...f, fee: parseFloat(e.target.value) || 0 }))} style={{ ...inlineInput, width: "80px", textAlign: "right"   }} />
                                : <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ color: isAnnia ? C.green : C.gold, fontWeight: 600 }}>{p.fee.toLocaleString("pt-PT")}€</span>
                                    {isAnnia && <span style={{ fontSize: "7px", letterSpacing: "0.2em", color: C.green, background: "rgba(95,202,165,0.12)", padding: "1px 5px", fontWeight: 600 }}>LUCRO</span>}
                                  </span>
                              }
                            </td>
                            <td style={{ padding: "0.6rem 1rem", textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                                {isEditing ? (
                                  <>
                                    <button onClick={() => saveEdit(p)} disabled={saving} style={{ ...smallBtn, color: C.green, borderColor: `${C.green}44` }}>✓ Guardar</button>
                                    <button onClick={() => setEditingId(null)} style={{ ...smallBtn, color: C.textMuted }}>Cancelar</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => openAddModal(p)} style={{ ...smallBtn, color: C.blue, borderColor: `${C.blue}33` }} title="Adicionar artista neste evento">+</button>
                                    <button onClick={() => startEdit(p)} style={{ ...smallBtn, color: C.textSec }}>Editar</button>
                                    <button onClick={() => handleDelete(p.id)} style={{ ...smallBtn, color: C.red, borderColor: `${C.red}33` }}>✕</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Resumo Artistas Modal */}
      {resumoOpen && (() => {
        const byMonthArtist: Record<string, Record<string, { days: number[]; total: number }>> = {};
        for (const p of filtered) {
          const month = p.evento_data.slice(0, 7);
          const nome = resolveNome(p.nome);
          const day = new Date(p.evento_data + "T00:00:00").getDate();
          if (!byMonthArtist[month]) byMonthArtist[month] = {};
          if (!byMonthArtist[month][nome]) byMonthArtist[month][nome] = { days: [], total: 0 };
          byMonthArtist[month][nome].days.push(day);
          byMonthArtist[month][nome].total += p.fee;
        }
        const sortedMonths = Object.keys(byMonthArtist).sort();
        const grandTotal = filtered.reduce((s, p) => s + p.fee, 0);
        return (
          <div onClick={e => e.target === e.currentTarget && setResumoOpen(false)} style={overlayStyle}>
            <div style={{ ...modalStyle, width: "600px", maxHeight: "82vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={topLineStyle} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
                <div>
                  <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, margin: 0 }}>Resumo por Artista</p>
                  <p style={{ fontSize: "10px", color: C.textMuted, marginTop: "4px" }}>{selectedYear} · dias trabalhados + total</p>
                </div>
                <button onClick={() => setResumoOpen(false)} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>✕</button>
              </div>

              {sortedMonths.map(month => {
                const artistsInMonth = Object.entries(byMonthArtist[month]).sort((a, b) => b[1].total - a[1].total);
                const monthTotal = artistsInMonth.reduce((s, [, v]) => s + v.total, 0);
                return (
                  <div key={month} style={{ marginBottom: "1.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: "8px", letterSpacing: "0.4em", color: C.gold, textTransform: "capitalize", fontWeight: 700 }}>{monthLabel(month)}</span>
                      <span style={{ fontSize: "10px", color: C.textSec }}>{monthTotal.toLocaleString("pt-PT")}€</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {artistsInMonth.map(([nome, { days, total }]) => {
                          const isAnnia = nome.toLowerCase().includes(ANNIA_NOME);
                          return (
                            <tr key={nome}>
                              <td style={{ padding: "0.5rem 0", borderBottom: `1px solid ${C.borderDim}`, width: "130px", whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: "10px", color: isAnnia ? C.green : C.textPrimary, fontWeight: 600 }}>{nome}</span>
                              </td>
                              <td style={{ padding: "0.5rem 0.75rem", borderBottom: `1px solid ${C.borderDim}` }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                                  {[...days].sort((a, b) => a - b).map((d, i) => (
                                    <span key={i} style={{ fontSize: "9px", background: "rgba(var(--theme-contrast-rgb),0.05)", border: `1px solid ${C.borderDim}`, color: C.textSec, padding: "1px 6px", minWidth: "20px", textAlign: "center" }}>
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td style={{ padding: "0.5rem 0", borderBottom: `1px solid ${C.borderDim}`, textAlign: "right", whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: "12px", color: isAnnia ? C.green : C.gold, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif" }}>{total.toLocaleString("pt-PT")}€</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "8px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Total {selectedYear}</span>
                <span style={{ fontSize: "18px", color: C.gold, fontWeight: 300, fontFamily: "'Cormorant Garamond',serif", letterSpacing: "0.05em" }}>{grandTotal.toLocaleString("pt-PT")}€</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add artista modal */}
      {addModal?.open && (
        <div onClick={e => e.target === e.currentTarget && setAddModal(null)} style={overlayStyle}>
          <div style={modalStyle}>
            <div style={topLineStyle} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Adicionar Artista</p>
            <p style={{ fontSize: "10px", color: C.textMuted, marginBottom: "1.5rem" }}>{addModal.evento_nome} · {fmtDate(addModal.evento_data)}</p>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Nome</label>
              <input style={inputStyle} value={addForm.nome} onChange={e => setAddForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do artista..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select style={{ ...inputStyle, appearance: "none" as any }} value={addForm.tipo} onChange={e => setAddForm(f => ({ ...f, tipo: e.target.value }))}>
                  {ARTIST_TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fee (€)</label>
                <input type="number" style={inputStyle} value={addForm.fee} onChange={e => setAddForm(f => ({ ...f, fee: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button onClick={() => setAddModal(null)} style={btnSecStyle}>Fechar</button>
              <button onClick={handleAddPagamento} disabled={saving} style={btnPrimStyle}>{saving ? "A guardar..." : "Adicionar"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "var(--theme-toast-bg)", border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
        {toast}
      </div>
    </div>{/* end desktop */}

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "var(--theme-text)", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.9rem 1.1rem", borderBottom:"1px solid rgba(var(--theme-contrast-rgb),0.05)", background:"var(--theme-nav-bg)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.2rem", letterSpacing:"0.35em", color:"var(--theme-accent)", fontWeight:300 }}>LLE</span>
        <div style={{ display:"flex", gap:"0.6rem", alignItems:"center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.5rem 0.5rem" }} />
          <span style={{ fontSize:"8px", letterSpacing:"0.35em", color:"var(--theme-text-faint)", textTransform:"uppercase" }}>{userName}</span>
        </div>
      </div>

      {/* Year selector */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(var(--theme-contrast-rgb),0.05)", overflowX:"auto", flexShrink:0 }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)} style={{ flex:1, background: selectedYear===y ? "rgba(var(--theme-accent-rgb),0.08)" : "transparent", border:"none", borderBottom: selectedYear===y ? "2px solid var(--theme-accent)" : "2px solid transparent", color: selectedYear===y ? "var(--theme-accent)" : "var(--theme-text-subtle)", fontFamily:"'Montserrat',sans-serif", fontSize:"11px", letterSpacing:"0.2em", padding:"0.7rem", cursor:"pointer" }}>{y}</button>
        ))}
      </div>

      {/* Annual stats */}
      <div className="mob-stats-row">
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Faturado</span>
          <span className="mob-stat-value" style={{color:"var(--theme-accent)"}}>{faturadoAno.toLocaleString("pt-PT")}€</span>
        </div>
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Custos</span>
          <span className="mob-stat-value" style={{color:"var(--theme-danger)"}}>−{custosAno.toLocaleString("pt-PT")}€</span>
        </div>
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Lucro</span>
          <span className="mob-stat-value" style={{color: lucroAno>=0 ? "var(--theme-success)" : "var(--theme-danger)"}}>{lucroAno.toLocaleString("pt-PT")}€</span>
        </div>
      </div>

      {/* Month tabs */}
      <div className="mob-pag-months">
        {months.map(m => {
          const rows = byMonth[m];
          const { lucro } = calcLucro(rows);
          return (
            <button key={m} className={`mob-pag-mtab${selectedMonth===m?" active":""}`} onClick={() => setSelectedMonth(m)}>
              {new Date(m + "-01T00:00:00").toLocaleDateString("pt-PT",{month:"short"})} {lucro >= 0 ? "" : "▾"}
            </button>
          );
        })}
      </div>

      {/* Artist rows for selected month */}
      <div className="mob-list">
        {selectedMonth && byMonth[selectedMonth] && (() => {
          const rows = byMonth[selectedMonth];
          const { faturado, custos, lucro } = calcLucro(rows);
          return (
            <>
              <div className="mob-section-header">
                <span>{new Date(selectedMonth+"-01T00:00:00").toLocaleDateString("pt-PT",{month:"long",year:"numeric"})}</span>
                <span className="mob-section-count" style={{color: lucro>=0?"var(--theme-success)":"var(--theme-danger)"}}>{lucro.toLocaleString("pt-PT")}€</span>
              </div>
              {rows.map((row: Pagamento) => (
                <div key={row.id} className="mob-artist-row">
                  <div style={{flex:1, minWidth:0}}>
                    <div className="mob-artist-name">{row.evento_nome}</div>
                    <div className="mob-artist-tipo">{resolveNome(row.nome)} · {row.tipo}</div>
                    <div style={{fontSize:"10px", color:"var(--theme-text-faint)", marginTop:2}}>
                      {new Date(row.evento_data+"T00:00:00").toLocaleDateString("pt-PT",{day:"numeric",month:"short"})}
                    </div>
                  </div>
                  <div style={{flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
                    <span className="mob-artist-fee" style={{color: "var(--theme-warning)"}}>{row.fee.toLocaleString("pt-PT")}€</span>
                  </div>
                </div>
              ))}
            </>
          );
        })()}
        {(!selectedMonth || !byMonth[selectedMonth]) && <div className="mob-empty">Sem pagamentos</div>}
      </div>

      <MobTabBar active="pagamentos" role={userRole} lightTheme={lightTheme} />
    </div>
    </>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

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

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg }}>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
    </div>
  );
}

const tds = ({ muted, nowrap, maxW }: { muted?: boolean; nowrap?: boolean; maxW?: string }): React.CSSProperties => ({
  fontSize: "11px", color: muted ? "var(--theme-text-muted)" : "var(--theme-text)",
  padding: "0.75rem 1rem", borderBottom: "1px solid var(--theme-border)",
  whiteSpace: nowrap ? "nowrap" : undefined, maxWidth: maxW,
  overflow: maxW ? "hidden" : undefined, textOverflow: maxW ? "ellipsis" : undefined,
});
const inlineInput: React.CSSProperties = { background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "'Montserrat',sans-serif", fontSize: "11px", padding: "4px 8px", outline: "none" };
const smallBtn: React.CSSProperties = { background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "8px", letterSpacing: "0.2em", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 };
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" };
const modalStyle: React.CSSProperties = { background: "var(--theme-surface)", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", padding: "2.5rem", width: "460px", maxWidth: "90vw", position: "relative" };
const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "7px", letterSpacing: "0.4em", color: "var(--theme-text-faint)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "'Montserrat',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
const btnPrimStyle: React.CSSProperties = { background: "var(--theme-accent)", border: "none", color: "var(--theme-accent-contrast)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnSecStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-subtle)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

