"use client";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getFaturacaoData, updateItemBillingStatus, setupDatabase,
  getAllClientes, createCliente, updateValorRecebido,
} from "../actions";

type Origem = 'agenda' | 'lead';

interface FatItem {
  id: number; origem: Origem; descricao: string; data: string;
  valor: number; billing_status: string; cliente_id: number | null; cliente_nome: string; modalidade?: string;
  valor_recebido?: number;
}

interface Cliente { id: number; nome: string; nif?: string; email?: string; telefone?: string; notas?: string; alias?: string; }

const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
  purple: "#A78BFA",
};

// Os 8 estados unificados
const TODOS_ESTADOS = ["Contacto", "Proposta Enviada", "Em Negociação", "Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago", "Cancelado"];

// Estados visíveis na faturação (a partir de Confirmado)
const ESTADOS_FAT = ["Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago", "Cancelado"];

const ESTADO_CFG: Record<string, { color: string; dot: string }> = {
  "Contacto":         { color: C.textSec,  dot: "#6B7280" },
  "Proposta Enviada": { color: C.blue,     dot: C.blue },
  "Em Negociação":    { color: C.amber,    dot: C.amber },
  "Confirmado":       { color: C.green,    dot: C.green },
  "Em Adjudicação":   { color: C.gold,     dot: C.gold },
  "Adjudicado":       { color: "#C9A96E",  dot: "#C9A96E" },
  "Faturado":         { color: C.purple,   dot: C.purple },
  "Pago":             { color: "#5DCAA5",  dot: "#5DCAA5" },
  "Cancelado":        { color: C.red,      dot: C.red },
};

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtEuro(v: number) {
  return v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Display alias if available, otherwise official name
function displayClienteName(nome: string, clienteInfo?: { alias?: string }) {
  return clienteInfo?.alias?.trim() || nome;
}

export default function FaturacaoPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [grouped, setGrouped] = useState<Record<string, FatItem[]>>({});
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Por Faturar");
  const [search, setSearch] = useState("");
  const [clienteModal, setClienteModal] = useState(false);
  const [clienteForm, setClienteForm] = useState({ nome: "", nif: "", email: "", telefone: "", notas: "", alias: "" });
  const [savingCliente, setSavingCliente] = useState(false);
  const [editingRecebido, setEditingRecebido] = useState<{ origem: Origem; id: number; valor: string } | null>(null);
  const [collapsedClientes, setCollapsedClientes] = useState<Set<string>>(new Set());
  // Bulk selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); // "origem-id"
  const [bulkStatus, setBulkStatus] = useState("");

  const toggleCliente = (nome: string) => {
    setCollapsedClientes(prev => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome); else next.add(nome);
      return next;
    });
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    const [fatRes, cliRes] = await Promise.all([getFaturacaoData(), getAllClientes()]);
    if (fatRes.success) setGrouped(fatRes.grouped as Record<string, FatItem[]>);
    if (cliRes.success) setClientes(cliRes.data as Cliente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== "admin") { router.push("/agenda"); return; }
    setUserName(parsed.name);
    setupDatabase().then(() => load());
    setTimeout(() => setMounted(true), 100);
  }, [load]);

  async function handleStatusChange(item: FatItem, newStatus: string) {
    await updateItemBillingStatus(item.origem, item.id, newStatus);
    showToast("Estado actualizado");
    load();
  }

  async function handleBulkStatus() {
    if (!bulkStatus || selectedItems.size === 0) return;
    for (const key of selectedItems) {
      const [orig, idStr] = key.split("-");
      await updateItemBillingStatus(orig as Origem, parseInt(idStr), bulkStatus);
    }
    showToast(`${selectedItems.size} ${selectedItems.size === 1 ? "item" : "itens"} actualizados`);
    setSelectedItems(new Set());
    setBulkStatus("");
    load();
  }

  const toggleItem = (key: string) => setSelectedItems(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  async function handleSaveValorRecebido() {
    if (!editingRecebido) return;
    const valor = parseFloat(editingRecebido.valor.replace(",", ".")) || 0;
    await updateValorRecebido(editingRecebido.origem, editingRecebido.id, valor);
    setEditingRecebido(null);
    showToast("Valor recebido guardado");
    load();
  }

  async function handleSaveCliente() {
    if (!clienteForm.nome.trim()) return;
    setSavingCliente(true);
    await createCliente(clienteForm);
    showToast("Cliente criado");
    setSavingCliente(false);
    setClienteModal(false);
    setClienteForm({ nome: "", nif: "", email: "", telefone: "", notas: "", alias: "" });
    load();
  }

  // Clientes totalmente pagos (todos os items nao-cancelados sao "Pago")
  const clientesTotalmentePagos = new Set(
    Object.entries(grouped)
      .filter(([, items]) => {
        const naoCanc = items.filter(i => i.billing_status !== "Cancelado");
        return naoCanc.length > 0 && naoCanc.every(i => i.billing_status === "Pago");
      })
      .map(([cliente]) => cliente)
  );

  // Estados "por faturar" = ainda não faturados nem pagos
  const ESTADOS_POR_FATURAR = ['Confirmado', 'Em Adjudicação', 'Adjudicado'];

  // Filtrar grupos por estado e pesquisa
  const filteredGrouped = Object.entries(grouped).reduce<Record<string, FatItem[]>>((acc, [cliente, items]) => {
    // Na tab "Pagos" mostrar so clientes totalmente pagos
    if (filtroEstado === "Pagos") {
      if (!clientesTotalmentePagos.has(cliente)) return acc;
      let filtered = items.filter(i => i.billing_status === "Pago");
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(i => i.descricao.toLowerCase().includes(s) || cliente.toLowerCase().includes(s));
      }
      if (filtered.length > 0) acc[cliente] = filtered;
      return acc;
    }
    // Tab "Por Faturar": mostra só Confirmado, Em Adjudicação, Adjudicado (excluir Faturado, Pago, Cancelado)
    if (filtroEstado === "Por Faturar") {
      let filtered = items.filter(i => ESTADOS_POR_FATURAR.includes(i.billing_status));
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(i => i.descricao.toLowerCase().includes(s) || cliente.toLowerCase().includes(s));
      }
      if (filtered.length > 0) acc[cliente] = filtered;
      return acc;
    }
    // Tab "Faturado": só itens Faturado (aguarda pagamento)
    if (filtroEstado === "Faturado") {
      let filtered = items.filter(i => i.billing_status === "Faturado");
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(i => i.descricao.toLowerCase().includes(s) || cliente.toLowerCase().includes(s));
      }
      if (filtered.length > 0) acc[cliente] = filtered;
      return acc;
    }
    // Nas outras tabs, esconder clientes totalmente pagos (a nao ser que pesquise)
    if (!search && clientesTotalmentePagos.has(cliente) && filtroEstado !== "Cancelado") return acc;
    let filtered = items.filter(i => i.billing_status !== "Cancelado"); // ocultar cancelados por defeito
    if (filtroEstado === "Cancelado") filtered = items.filter(i => i.billing_status === "Cancelado");
    else if (filtroEstado !== "Todos") filtered = filtered.filter(i => i.billing_status === filtroEstado);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(i => i.descricao.toLowerCase().includes(s) || cliente.toLowerCase().includes(s));
    }
    if (filtered.length > 0) acc[cliente] = filtered;
    return acc;
  }, {});

  // Totais globais
  const allItems = Object.values(grouped).flat();
  const totalGeral = allItems.reduce((s, i) => s + i.valor, 0);
  const totalPago = allItems.filter(i => i.billing_status === 'Pago').reduce((s, i) => s + i.valor, 0);
  const totalRecebidoParcial = allItems.filter(i => i.billing_status === 'Adjudicado').reduce((s, i) => s + (i.valor_recebido || 0), 0);
  const totalRecebido = totalPago + totalRecebidoParcial;
  const totalPendente = allItems.filter(i => ['Confirmado', 'Em Adjudicação', 'Adjudicado'].includes(i.billing_status)).reduce((s, i) => s + i.valor - (i.billing_status === 'Adjudicado' ? (i.valor_recebido || 0) : 0), 0);
  const totalFaturado = allItems.filter(i => i.billing_status === 'Faturado').reduce((s, i) => s + i.valor, 0);

  const clientes_count = Object.keys(grouped).length;

  if (loading) return <Loading />;

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: "#0C0B09", color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      {<Nav userName={userName} active="faturacao" onLogout={={() => { localStorage.removeItem("lle_user"); router.push("/");  lightTheme={lightTheme} }}/>

      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>
              Faturação
              {clientes_count > 0 && <span style={{ color: C.textMuted, marginLeft: "0.75rem" }}>({clientes_count} {clientes_count === 1 ? 'cliente' : 'clientes'})</span>}
            </p>
            <p style={{ fontSize: "8px", color: C.textMuted, marginTop: "0.4rem", letterSpacing: "0.15em" }}>
              Eventos e leads a partir do estado <span style={{ color: C.green }}>Confirmado</span>
            </p>
          </div>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
          <button onClick={() => setClienteModal(true)} style={addBtnStyle}>
            <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
            Novo Cliente
          </button>
        </div>

        {/* RESUMO FINANCEIRO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: totalFaturado > 0 ? "0.75rem" : "2rem" }}>
          {[
            { label: "Total Geral", valor: totalGeral, color: C.gold },
            { label: "A Receber", valor: totalPendente, color: C.amber },
            { label: "Recebido", valor: totalRecebido, color: C.green },
          ].map(({ label, valor, color }) => (
            <div key={label} style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "1.5rem 2rem", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${color}44, transparent)`  lightTheme={lightTheme} }}/>
              <p style={{ fontSize: "7px", letterSpacing: "0.5em", color: C.goldDim, marginBottom: "0.75rem", textTransform: "uppercase" }}>{label}</p>
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", color, lineHeight: 1, fontWeight: 300 }}>{fmtEuro(valor)}</p>
            </div>
          ))}
        </div>

        {/* FATURADO — banner compacto, só aparece se houver */}
        {totalFaturado > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", padding: "0.7rem 1.25rem", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)", borderTop: "none" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.purple, flexShrink: 0  lightTheme={lightTheme} }}/>
            <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: C.purple, textTransform: "uppercase", fontWeight: 600 }}>Faturado · aguarda pagamento</span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.1rem", color: C.purple, fontWeight: 300, marginLeft: "auto", letterSpacing: "0.05em" }}>{fmtEuro(totalFaturado)}</span>
          </div>
        )}

        {/* FILTROS */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar cliente ou evento..."
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "0.6rem 1rem", letterSpacing: "0.05em", outline: "none", flex: "1", minWidth: "200px" }}
          />
          {["Por Faturar", "Faturado", "Pagos", "Todos"].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)} style={{
              background: filtroEstado === e ? (e === "Pagos" ? "rgba(93,202,165,0.08)" : e === "Faturado" ? "rgba(167,139,250,0.08)" : "rgba(201,169,110,0.08)") : "transparent",
              border: filtroEstado === e ? `1px solid ${e === "Pagos" ? C.green : e === "Faturado" ? C.purple : C.border}` : `1px solid ${C.borderDim}`,
              color: filtroEstado === e ? (e === "Pagos" ? C.green : e === "Faturado" ? C.purple : C.gold) : C.textMuted,
              fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1rem", cursor: "pointer",
              fontFamily: "inherit", textTransform: "uppercase", fontWeight: filtroEstado === e ? 600 : 400,
              transition: "all 0.2s",
            }}>{e === "Pagos" ? `✓ Pagos (${clientesTotalmentePagos.size})` : e}</button>
          ))}
        </div>

        {/* BULK ACTION BAR */}
        {selectedItems.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", padding: "0.75rem 1.25rem", background: "rgba(201,169,110,0.06)", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: C.gold, fontWeight: 600 }}>{selectedItems.size} {selectedItems.size === 1 ? "item seleccionado" : "itens seleccionados"}</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.borderDim}`, color: bulkStatus ? C.textPrimary : C.textMuted, fontFamily: "inherit", fontSize: "9px", padding: "0.4rem 0.75rem", letterSpacing: "0.1em", outline: "none", cursor: "pointer", appearance: "none" as any }}>
              <option value="">Alterar estado para...</option>
              {TODOS_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleBulkStatus} disabled={!bulkStatus} style={{ background: bulkStatus ? C.gold : "rgba(255,255,255,0.04)", border: "none", color: bulkStatus ? "#0C0B09" : C.textMuted, fontSize: "9px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.5rem 1.25rem", cursor: bulkStatus ? "pointer" : "default", fontFamily: "inherit", textTransform: "uppercase" }}>Aplicar</button>
            <button onClick={() => setSelectedItems(new Set())} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: "9px", cursor: "pointer", marginLeft: "auto" }}>✕ Limpar seleção</button>
          </div>
        )}

        {/* CARDS POR CLIENTE */}
        {Object.keys(filteredGrouped).length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "4rem", textAlign: "center" }}>
            <p style={{ fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>
              {Object.keys(grouped).length === 0
                ? "Sem eventos ou leads com cliente associado a partir do estado Confirmado."
                : "Nenhum resultado para os filtros seleccionados."}
            </p>
            {Object.keys(grouped).length === 0 && (
              <p style={{ fontSize: "9px", color: C.textMuted, marginTop: "1rem", letterSpacing: "0.15em", opacity: 0.6 }}>
                Edita um evento na Agenda ou uma Lead e associa um cliente + estado ≥ Confirmado.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {Object.entries(filteredGrouped).map(([clienteNome, items]) => {
              const totalCliente = items.reduce((s, i) => s + i.valor, 0);
              const pagos = items.filter(i => i.billing_status === 'Pago').reduce((s, i) => s + i.valor, 0);
              const recebidoParcial = items.filter(i => i.billing_status === 'Adjudicado').reduce((s, i) => s + (i.valor_recebido || 0), 0);
              const totalRecebidoCliente = pagos + recebidoParcial;
              const pendentes = items.filter(i => ['Confirmado', 'Em Adjudicação', 'Adjudicado', 'Faturado'].includes(i.billing_status)).length;
              const clienteInfo = clientes.find(c => c.nome === clienteNome || (c.alias?.trim() && c.alias.trim() === clienteNome));

              return (
                <div key={clienteNome} style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" />/>

                  {/* Card Header */}
                  <div
                    onClick={() => toggleCliente(clienteNome)}
                    style={{ padding: "1.5rem 2rem", borderBottom: collapsedClientes.has(clienteNome) ? "none" : `1px solid ${C.borderDim}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer", userSelect: "none" }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.35rem" }}>
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", color: C.textPrimary, fontWeight: 400, letterSpacing: "0.05em" }}>{displayClienteName(clienteNome, clienteInfo)}</span>
                        {clienteInfo?.alias?.trim() && clienteInfo.nome !== clienteNome && (
                          <span style={{ fontSize: "9px", letterSpacing: "0.15em", color: C.textMuted }}>{clienteInfo.nome}</span>
                        )}
                        {clienteInfo?.nif && (
                          <span style={{ fontSize: "8px", letterSpacing: "0.2em", color: C.textMuted, background: "rgba(255,255,255,0.04)", padding: "2px 8px", border: `1px solid ${C.borderDim}` }}>
                            NIF {clienteInfo.nif}
                          </span>
                        )}
                        <span style={{ fontSize: "11px", color: C.goldDim, opacity: 0.6, marginLeft: "0.25rem" }}>{collapsedClientes.has(clienteNome) ? "▸" : "▾"}</span>
                      </div>
                      <div style={{ display: "flex", gap: "1.5rem" }}>
                        {clienteInfo?.email && <span style={{ fontSize: "9px", color: C.textSec }}>✉ {clienteInfo.email}</span>}
                        {clienteInfo?.telefone && <span style={{ fontSize: "9px", color: C.textSec }}>📞 {clienteInfo.telefone}</span>}
                        <span style={{ fontSize: "9px", color: C.textMuted }}>{items.length} {items.length === 1 ? 'evento' : 'eventos'}</span>
                        {pendentes > 0 && <span style={{ fontSize: "9px", color: C.amber }}>{pendentes} por receber</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.goldDim, marginBottom: "0.35rem" }}>TOTAL</p>
                      <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.6rem", color: C.gold, fontWeight: 300 }}>{fmtEuro(totalCliente)}</p>
                      {totalRecebidoCliente > 0 && <p style={{ fontSize: "9px", color: C.green, marginTop: "2px" }}>{fmtEuro(totalRecebidoCliente)} recebido</p>}
                    </div>
                  </div>

                  {/* Eventos do cliente */}
                  {!collapsedClientes.has(clienteNome) && (
                  <div>
                    {items.map((item, idx) => {
                      const cfg = ESTADO_CFG[item.billing_status] || { color: C.textSec, dot: C.textSec };
                      const isLast = idx === items.length - 1;
                      return (
                        <div key={`${item.origem}-${item.id}`} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto auto", gap: "1rem", alignItems: "center", padding: "1rem 2rem", borderBottom: isLast ? "none" : `1px solid ${C.borderDim}`, transition: "background 0.15s", background: selectedItems.has(`${item.origem}-${item.id}`) ? "rgba(201,169,110,0.04)" : "transparent" }}
                          onMouseEnter={e => { if (!selectedItems.has(`${item.origem}-${item.id}`)) e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                          onMouseLeave={e => { if (!selectedItems.has(`${item.origem}-${item.id}`)) e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* Checkbox */}
                          <input type="checkbox" checked={selectedItems.has(`${item.origem}-${item.id}`)} onChange={() => toggleItem(`${item.origem}-${item.id}`)} style={{ accentColor: C.gold, cursor: "pointer", width: "14px", height: "14px"  lightTheme={lightTheme} }}/>
                          {/* Descrição + origem */}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "9px", color: item.origem === 'agenda' ? C.gold : C.purple, letterSpacing: "0.2em", opacity: 0.7, textTransform: "uppercase" }}>
                                {item.origem === 'agenda' ? '📅' : '🎯'}
                              </span>
                              <span style={{ fontSize: "12px", color: C.textPrimary, fontWeight: 500 }}>{item.descricao}</span>
                            </div>
                            <span style={{ fontSize: "9px", color: C.textMuted, marginLeft: "1.3rem" }}>{fmtDate(item.data)}</span>
                          </div>

                          {/* Valor + recebido parcial */}
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "12px", color: C.gold, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {item.valor > 0 ? fmtEuro(item.valor) : "—"}
                            </span>
                            {item.billing_status === 'Adjudicado' && (
                              <div style={{ marginTop: "4px" }}>
                                {editingRecebido?.origem === item.origem && editingRecebido?.id === item.id ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                                    <input
                                      autoFocus
                                      value={editingRecebido.valor}
                                      onChange={e => setEditingRecebido(r => r ? { ...r, valor: e.target.value } : r)}
                                      onKeyDown={e => { if (e.key === "Enter") handleSaveValorRecebido(); if (e.key === "Escape") setEditingRecebido(null); }}
                                      style={{ width: "80px", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.green}44`, color: C.green, fontFamily: "inherit", fontSize: "10px", padding: "2px 6px", outline: "none", textAlign: "right" }}
                                    />
                                    <button onClick={handleSaveValorRecebido} style={{ background: "transparent", border: "none", color: C.green, cursor: "pointer", fontSize: "11px", padding: "1px 4px" }}>✓</button>
                                    <button onClick={() => setEditingRecebido(null)} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: "11px", padding: "1px 4px" }}>✕</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setEditingRecebido({ origem: item.origem, id: item.id, valor: String(item.valor_recebido || "") })}
                                    style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end", padding: 0, marginLeft: "auto" }}
                                  >
                                    {(item.valor_recebido || 0) > 0
                                      ? <span style={{ fontSize: "9px", color: C.green }}>{fmtEuro(item.valor_recebido!)} recebido</span>
                                      : <span style={{ fontSize: "8px", color: C.textMuted, letterSpacing: "0.15em" }}>+ recebido</span>
                                    }
                                    <svg width="9" height="9" viewBox="0 0 16 16" stroke={C.textMuted} fill="none" strokeWidth="2"><path d="M11 2l3 3-9 9H2v-3l9-9z"/></svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Status badge */}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "8px", letterSpacing: "0.2em", padding: "4px 10px", fontWeight: 600, textTransform: "uppercase", background: `${cfg.color}14`, color: cfg.color, whiteSpace: "nowrap" }}>
                            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: cfg.dot, flexShrink: 0  lightTheme={lightTheme} }}/>
                            {item.billing_status}
                          </span>

                          {/* Selector de estado */}
                          <select
                            value={item.billing_status}
                            onChange={e => handleStatusChange(item, e.target.value)}
                            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.borderDim}`, color: C.textSec, fontFamily: "inherit", fontSize: "8px", padding: "0.4rem 0.6rem", letterSpacing: "0.1em", outline: "none", cursor: "pointer", appearance: "none" as any }}
                          >
                            {TODOS_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal novo cliente */}
      {clienteModal && (
        <div onClick={e => e.target === e.currentTarget && setClienteModal(false)} style={overlayStyle}>
          <div style={modalStyle}>
            <div style={topLineStyle} />
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "2rem" }}>Novo Cliente</p>
            <FormField label="Nome Oficial *"><input style={inputStyle} value={clienteForm.nome} onChange={e => setClienteForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome ou empresa..." /></FormField>
            <FormField label="Alias / Nome curto"><input style={inputStyle} value={clienteForm.alias} onChange={e => setClienteForm(f => ({ ...f, alias: e.target.value }))} placeholder="Ex: Hyatt, Marriott..." /></FormField>
            <FormField label="NIF"><input style={inputStyle} value={clienteForm.nif} onChange={e => setClienteForm(f => ({ ...f, nif: e.target.value }))} placeholder="Número de identificação fiscal..." /></FormField>
            <FormField label="Email"><input style={inputStyle} value={clienteForm.email} onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" /></FormField>
            <FormField label="Telefone"><input style={inputStyle} value={clienteForm.telefone} onChange={e => setClienteForm(f => ({ ...f, telefone: e.target.value }))} placeholder="+351 9xx xxx xxx" /></FormField>
            <FormField label="Notas"><input style={inputStyle} value={clienteForm.notas} onChange={e => setClienteForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observações..." /></FormField>
            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
              <button onClick={() => setClienteModal(false)} style={btnSecStyle}>Cancelar</button>
              <button onClick={handleSaveCliente} disabled={savingCliente || !clienteForm.nome.trim()} style={btnPrimStyle}>{savingCliente ? "A guardar..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "#1a1408", border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
        {toast}
      </div>
    </div>{/* end desktop */}

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "#F5F0E8", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.9rem 1.1rem", borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(12,11,9,0.97)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.2rem", letterSpacing:"0.35em", color:"#C9A96E", fontWeight:300 }}>LLE</span>
        <button onClick={() => setClienteModal(true)} className="mob-fab" style={{width:"auto", padding:"0 0.9rem", gap:6, borderRadius:8}}>
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
          <span style={{fontSize:"9px", letterSpacing:"0.2em", fontFamily:"'Montserrat',sans-serif", fontWeight:600}}>Cliente</span>
        </button>
      </div>

      {/* Stats */}
      <div className="mob-stats-row">
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Total</span>
          <span className="mob-stat-value" style={{color:"#C9A96E"}}>{fmtEuro(totalGeral)}</span>
        </div>
        <div className="mob-stat-cell">
          <span className="mob-stat-label">A Receber</span>
          <span className="mob-stat-value" style={{color:"#EF9F27"}}>{fmtEuro(totalPendente)}</span>
        </div>
        <div className="mob-stat-cell">
          <span className="mob-stat-label">Recebido</span>
          <span className="mob-stat-value" style={{color:"#5DCAA5"}}>{fmtEuro(totalRecebido)}</span>
        </div>
      </div>

      {/* Estado filter pills */}
      <div className="mob-filters">
        {["Por Faturar", "Faturado", "Pagos", "Todos"].map(e => (
          <button key={e} className={`mob-filter-pill${filtroEstado===e ? (e==="Pagos"?" active":" active gold") : ""}`} onClick={() => setFiltroEstado(e)}>
            {e === "Pagos" ? `✓ Pagos (${clientesTotalmentePagos.size})` : e}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mob-topbar">
        <div className="mob-search-wrap">
          <svg className="mob-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/></svg>
          <input className="mob-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar cliente ou evento..." />
        </div>
      </div>

      {/* Mobile bulk action bar */}
      {selectedItems.size > 0 && (
        <div style={{ position: "sticky", top: "52px", zIndex: 9, margin: "0", padding: "0.65rem 1rem", background: "rgba(18,14,8,0.98)", borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "9px", letterSpacing: "0.25em", color: C.gold, fontWeight: 700, whiteSpace: "nowrap" }}>{selectedItems.size} {selectedItems.size === 1 ? "item" : "itens"}</span>
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.borderDim}`, color: bulkStatus ? C.textPrimary : C.textMuted, fontFamily: "inherit", fontSize: "10px", padding: "0.45rem 0.6rem", letterSpacing: "0.05em", outline: "none", appearance: "none" as any }}
          >
            <option value="">Alterar estado...</option>
            {TODOS_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={handleBulkStatus}
            disabled={!bulkStatus}
            style={{ background: bulkStatus ? C.gold : "rgba(255,255,255,0.04)", border: "none", color: bulkStatus ? "#0C0B09" : C.textMuted, fontSize: "9px", letterSpacing: "0.25em", fontWeight: 700, padding: "0.5rem 0.9rem", cursor: bulkStatus ? "pointer" : "default", fontFamily: "inherit", textTransform: "uppercase", whiteSpace: "nowrap", borderRadius: "2px" }}
          >Aplicar</button>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
          <button onClick={() => setSelectedItems(new Set())} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: "16px", cursor: "pointer", padding: "0 4px", lineHeight: "1" }}>✕</button>
        </div>
      )}

      {/* Client cards */}
      <div className="mob-list">
        {Object.keys(filteredGrouped).length === 0 && <div className="mob-empty">Sem resultados</div>}
        {Object.entries(filteredGrouped).map(([clienteNome, items]: [string, any[]]) => {
          const totalCliente = items.reduce((s:number, i:any) => s + i.valor, 0);
          const pagos = items.filter((i:any) => i.billing_status === "Pago").reduce((s:number, i:any) => s + i.valor, 0);
          const recebidoParcial = items.filter((i:any) => i.billing_status === "Adjudicado").reduce((s:number, i:any) => s + (i.valor_recebido || 0), 0);
          const totalRecebidoCliente = pagos + recebidoParcial;
          const pendentes = items.filter((i:any) => ["Confirmado","Em Adjudicação","Adjudicado","Faturado"].includes(i.billing_status)).length;
          const clienteInfo2 = clientes.find(c => c.nome === clienteNome || (c.alias?.trim() && c.alias.trim() === clienteNome));
          const displayNome = displayClienteName(clienteNome, clienteInfo2);
          return (
            <div key={clienteNome}>
              <div className="mob-section-header" onClick={() => toggleCliente(clienteNome)} style={{ cursor: "pointer", userSelect: "none" }}>
                <span style={{maxWidth:"60%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{displayNome}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{color: totalRecebidoCliente >= totalCliente ? "#5DCAA5" : "#C9A96E", fontSize:"11px", fontWeight:700, letterSpacing:0}}>{fmtEuro(totalCliente)}</span>
                  <span style={{ color: "rgba(201,169,110,0.5)", fontSize: "12px" }}>{collapsedClientes.has(clienteNome) ? "▸" : "▾"}</span>
                </div>
              </div>
              {!collapsedClientes.has(clienteNome) && items.map((item:any) => {
                const itemKey = `${item.origem}-${item.id}`;
                const isSelected = selectedItems.has(itemKey);
                const bsColors: Record<string,string> = {
                  "Confirmado":"#5DCAA5","Em Adjudicação":"#C9A96E","Adjudicado":"#C9A96E",
                  "Faturado":"#A78BFA","Pago":"#5DCAA5","Cancelado":"#E24B4A",
                };
                const bc = bsColors[item.billing_status] || "rgba(245,240,232,0.3)";
                const d = new Date(item.data+"T00:00:00");
                return (
                  <div
                    key={item.id}
                    className="mob-card"
                    onClick={() => toggleItem(itemKey)}
                    style={{ cursor: "pointer", background: isSelected ? "rgba(201,169,110,0.07)" : undefined, borderLeft: isSelected ? `2px solid ${C.gold}` : "2px solid transparent", transition: "background 0.15s, border-color 0.15s" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "22px", flexShrink: 0 }}>
                      <div style={{
                        width: "16px", height: "16px", borderRadius: "3px",
                        border: `1.5px solid ${isSelected ? C.gold : "rgba(201,169,110,0.3)"}`,
                        background: isSelected ? C.gold : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s", flexShrink: 0,
                      }}>
                        {isSelected && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#0C0B09" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </div>
                    <div className="mob-date-bubble">
                      <div className="mob-date-day">{String(d.getDate()).padStart(2,"0")}/{String(d.getMonth()+1).padStart(2,"0")}</div>
                      <div className="mob-date-weekday">{d.toLocaleDateString("pt-PT",{weekday:"short"})}</div>
                    </div>
                    <div className="mob-card-body">
                      <div className="mob-card-title">{item.titulo || item.descricao}</div>
                      <div className="mob-card-badges">
                        <span className="mob-badge" style={{background:`${bc}18`,color:bc}}>
                          <span className="mob-badge-dot" style={{background:bc}}/>
                          {item.billing_status}
                        </span>
                      </div>
                    </div>
                    <div className="mob-card-right">
                      <span className="mob-card-value">{fmtEuro(item.valor)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <MobTabBar active="faturacao" role="admin" />
    </div>
    </>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

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

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0B09" }}>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: "rgba(245,240,232,0.22)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const addBtnStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "#8a7350", fontSize: "8px", letterSpacing: "0.35em", padding: "0.5rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" };
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" };
const modalStyle: React.CSSProperties = { background: "#131108", border: "1px solid rgba(201,169,110,0.12)", padding: "2.5rem", width: "480px", maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", position: "relative" };
const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" };
const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "'Montserrat','Helvetica Neue',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
const btnPrimStyle: React.CSSProperties = { background: "#C9A96E", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnSecStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

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
        <div style={{ width: "36px", height: "3px", background: "rgba(201,169,110,0.25)", borderRadius: "2px", margin: "0 auto 0.75rem"  lightTheme={lightTheme} }}/>
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
