"use client";

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
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009", pageBg: "#0C0B09",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
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
                <button key={y} onClick={() => setSelectedYear(y)} style={{ background: selectedYear === y ? "rgba(201,169,110,0.12)" : "transparent", border: `1px solid ${selectedYear === y ? C.gold : C.borderDim}`, color: selectedYear === y ? C.gold : C.textMuted, fontSize: "9px", letterSpacing: "0.3em", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit", fontWeight: selectedYear === y ? 700 : 400 }}>{y}</button>
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
                      background: isActive ? "rgba(201,169,110,0.07)" : "transparent",
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
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E44, transparent)" }} />
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
                                    <span key={i} style={{ fontSize: "9px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.borderDim}`, color: C.textSec, padding: "1px 6px", minWidth: "20px", textAlign: "center" }}>
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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.9rem 1.1rem", borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(12,11,9,0.97)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.2rem", letterSpacing:"0.35em", color:"#C9A96E", fontWeight:300 }}>LLE</span>
        <div style={{ display:"flex", gap:"0.6rem", alignItems:"center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.5rem 0.5rem" }} />
          <span style={{ fontSize:"8px", letterSpacing:"0.35em", color:"rgba(245,240,232,0.2)", textTransform:"uppercase" }}>{userName}</span>
        </div>
      </div>

      {/* Year selector */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(255,255,255,0.05)", overflowX:"auto", flexShrink:0 }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)} style={{ flex:1, background: selectedYear===y ? "rgba(201,169,110,0.08)" : "transparent", border:"none", borderBottom: selectedYear===y ? "2px solid #C9A96E" : "2px solid transparent", color: selectedYear===y ? "#C9A96E" : "rgba(245,240,232,0.3)", fontFamily:"'Montserrat',sans-serif", fontSize:"11px", letterSpacing:"0.2em", padding:"0.7rem", cursor:"pointer" }}>{y}</button>
        ))}
      </div>

      {/* Annual stats */}
      <div className="mob-stats-row">
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Faturado</span>
          <span className="mob-stat-value" style={{color:"#C9A96E"}}>{faturadoAno.toLocaleString("pt-PT")}€</span>
        </div>
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Custos</span>
          <span className="mob-stat-value" style={{color:"#E24B4A"}}>−{custosAno.toLocaleString("pt-PT")}€</span>
        </div>
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Lucro</span>
          <span className="mob-stat-value" style={{color: lucroAno>=0 ? "#5DCAA5" : "#E24B4A"}}>{lucroAno.toLocaleString("pt-PT")}€</span>
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
                <span className="mob-section-count" style={{color: lucro>=0?"#5DCAA5":"#E24B4A"}}>{lucro.toLocaleString("pt-PT")}€</span>
              </div>
              {rows.map((row: Pagamento) => (
                <div key={row.id} className="mob-artist-row">
                  <div style={{flex:1, minWidth:0}}>
                    <div className="mob-artist-name">{row.evento_nome}</div>
                    <div className="mob-artist-tipo">{resolveNome(row.nome)} · {row.tipo}</div>
                    <div style={{fontSize:"10px", color:"rgba(245,240,232,0.25)", marginTop:2}}>
                      {new Date(row.evento_data+"T00:00:00").toLocaleDateString("pt-PT",{day:"numeric",month:"short"})}
                    </div>
                  </div>
                  <div style={{flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
                    <span className="mob-artist-fee" style={{color: "#EF9F27"}}>{row.fee.toLocaleString("pt-PT")}€</span>
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
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid var(--theme-border)", position: "sticky", top: 0, zIndex: 100, background: "rgba(12,11,9,0.95)", backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "#C9A96E" : "rgba(245,240,232,0.45)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "var(--theme-text-faint)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
      </div>
    </nav>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg }}>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
    </div>
  );
}

const tds = ({ muted, nowrap, maxW }: { muted?: boolean; nowrap?: boolean; maxW?: string }): React.CSSProperties => ({
  fontSize: "11px", color: muted ? "rgba(245,240,232,0.45)" : "#F5F0E8",
  padding: "0.75rem 1rem", borderBottom: "1px solid var(--theme-border)",
  whiteSpace: nowrap ? "nowrap" : undefined, maxWidth: maxW,
  overflow: maxW ? "hidden" : undefined, textOverflow: maxW ? "ellipsis" : undefined,
});
const inlineInput: React.CSSProperties = { background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "'Montserrat',sans-serif", fontSize: "11px", padding: "4px 8px", outline: "none" };
const smallBtn: React.CSSProperties = { background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "8px", letterSpacing: "0.2em", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 };
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" };
const modalStyle: React.CSSProperties = { background: "var(--theme-surface)", border: "1px solid rgba(201,169,110,0.12)", padding: "2.5rem", width: "460px", maxWidth: "90vw", position: "relative" };
const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "7px", letterSpacing: "0.4em", color: "var(--theme-text-faint)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "'Montserrat',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
const btnPrimStyle: React.CSSProperties = { background: "var(--theme-accent)", border: "none", color: "var(--theme-accent-contrast)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnSecStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "var(--theme-text-subtle)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

// ── Mobile Tab Bar — 4 fixos + "Mais" drawer ───────────────────────────────
function MobTabBar({ active, role, lightTheme }: { active: string; role: string; lightTheme: boolean }) {
  const [maisOpen, setMaisOpen] = useState(false);
  const drawerBg = lightTheme ? "#FFFFFF" : "#131108";
  const drawerBorder = lightTheme ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(201,169,110,0.15)";
  const drawerShadow = lightTheme ? "0 -8px 32px rgba(0,0,0,0.15)" : "0 -8px 32px rgba(0,0,0,0.6)";
  const drawerMuted = lightTheme ? "rgba(0,0,0,0.65)" : "rgba(245,240,232,0.4)";
  const drawerActiveBg = lightTheme ? "rgba(0,0,0,0.06)" : "rgba(201,169,110,0.08)";
  const drawerGold = lightTheme ? "#000000" : "#C9A96E";
  const drawerHandle = lightTheme ? "rgba(0,0,0,0.25)" : "rgba(201,169,110,0.25)";
  const drawerTitle = lightTheme ? "rgba(0,0,0,0.5)" : "rgba(201,169,110,0.4)";

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
  const valoresTab = { href: "/valores", label: "Valores", id: "valores", icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-3 3 2 5-7"/>
    </svg>
  )};
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
    valoresTab,
    { href: "/residencias", label: "Residências", id: "residencias", icon: valoresTab.icon },
    materiaisTab,
  ] : role === "finance" ? [{ href: "/clientes", label: "Clientes", id: "clientes", icon: materiaisTab.icon }, { href: "/pagamentos", label: "Pagamentos", id: "pagamentos", icon: materiaisTab.icon }] : role !== "limited_novalues" ? [materiaisTab] : [];

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
        background: drawerBg, borderTop: drawerBorder,
        borderRadius: "16px 16px 0 0", padding: "0.75rem 0.5rem",
        paddingBottom: "0.5rem",
        boxShadow: drawerShadow,
      }}>
        {/* Handle */}
        <div style={{ width: "36px", height: "3px", background: drawerHandle, borderRadius: "2px", margin: "0 auto 0.75rem"   }} />
        <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: drawerTitle, textTransform: "uppercase", textAlign: "center", marginBottom: "0.5rem", fontFamily: "'Montserrat',sans-serif" }}>Mais páginas</p>
        <div style={{ display: "flex", justifyContent: "space-around", padding: "0 0.5rem" }}>
          {maisTabs.map(t => (
            <a key={t.href} href={t.href} onClick={() => setMaisOpen(false)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                textDecoration: "none", padding: "0.6rem 1rem", minWidth: "72px",
                color: active === t.id ? drawerGold : drawerMuted,
                background: active === t.id ? drawerActiveBg : "transparent",
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
