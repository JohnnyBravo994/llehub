"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobTabBar from "../MobTabBar";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { useTheme } from "../useTheme";
import { COLABORADOR_SKILLS } from "../constants";
import { getAllPacksComerciais, createPackComercial, updatePackComercial, togglePackComercialAtivo, getAllMateriais } from "../actions";
import DesktopNav from "../DesktopNav";

type PackComponent = {
  id?: number; tipo: "skill" | "material"; referencia: string; material_id?: number | null;
  quantidade: number; notas?: string; material_nome?: string; material_imagem?: string; material_custo_interno?: number;
};
type Pack = {
  id: number; nome: string; descricao: string; valor_sud: number; valor_residencia: number; valor_evento_residencia: number;
  valor_parceria: number; valor_cliente_final: number; notas: string; ativo: number; componentes: PackComponent[];
};
type Material = { id: number; nome: string; imagem?: string; categoria?: string; custo_interno?: number; ativo?: number };

const blank = () => ({
  nome: "", descricao: "", valor_sud: "", valor_residencia: "", valor_evento_residencia: "",
  valor_parceria: "", valor_cliente_final: "", notas: "", ativo: 1, componentes: [] as PackComponent[],
});

function n(v: string | number) { return Number(String(v ?? "").replace(",", ".")) || 0; }
function euro(v: number) { return n(v) ? `${n(v).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} €` : "—"; }

export default function PacksPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [drawer, setDrawer] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const C = lightTheme ? {
    bg: "#FFFBF7", surface: "#FFFFFF", elevated: "#FFFDFB", border: "rgba(0,0,0,.12)", text: "#111827", muted: "rgba(17,24,39,.62)", accent: "#8B4513", danger: "#C62828", success: "#2E7D32"
  } : {
    bg: "var(--theme-bg)", surface: "var(--theme-surface)", elevated: "var(--theme-surface-elevated)", border: "var(--theme-border)", text: "var(--theme-text)", muted: "var(--theme-text-muted)", accent: "var(--theme-accent)", danger: "var(--theme-danger)", success: "var(--theme-success)"
  };

  const load = async () => {
    setLoading(true);
    const [pr, mr] = await Promise.all([getAllPacksComerciais(), getAllMateriais()]);
    if (pr.success) setPacks(pr.data as Pack[]);
    if (mr.success) setMaterials((mr.data as Material[]).filter(m => m.ativo !== 0));
    setLoading(false);
  };

  useEffect(() => {
    const raw = localStorage.getItem("lle_user");
    if (!raw) { router.push("/"); return; }
    const u = JSON.parse(raw);
    setUserName(u.name || ""); setUserRole(u.role || "admin");
    load();
  }, []);

  const openNew = () => { setForm(blank()); setDrawer({ open: true, id: null }); };
  const openEdit = (p: Pack) => {
    setForm({
      nome: p.nome, descricao: p.descricao || "", valor_sud: String(p.valor_sud || ""), valor_residencia: String(p.valor_residencia || ""),
      valor_evento_residencia: String(p.valor_evento_residencia || ""), valor_parceria: String(p.valor_parceria || ""),
      valor_cliente_final: String(p.valor_cliente_final || ""), notas: p.notas || "", ativo: p.ativo,
      componentes: (p.componentes || []).map(c => ({ ...c, quantidade: Math.max(1, Number(c.quantidade || 1)) })),
    });
    setDrawer({ open: true, id: p.id });
  };
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const save = async () => {
    if (!form.nome.trim()) { say("Dá um nome ao pack"); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(), descricao: form.descricao.trim(), valor_sud: n(form.valor_sud), valor_residencia: n(form.valor_residencia),
      valor_evento_residencia: n(form.valor_evento_residencia), valor_parceria: n(form.valor_parceria), valor_cliente_final: n(form.valor_cliente_final),
      notas: form.notas.trim(), ativo: form.ativo,
      componentes: form.componentes.map(c => ({ tipo: c.tipo, referencia: c.referencia, material_id: c.material_id ?? null, quantidade: Math.max(1, n(c.quantidade) || 1), notas: c.notas || "" })),
    };
    const r = drawer.id ? await updatePackComercial(drawer.id, payload) : await createPackComercial(payload);
    setSaving(false);
    if (!r.success) { say((r as any).message || "Não foi possível guardar"); return; }
    setDrawer({ open: false, id: null }); await load(); say("Pack guardado");
  };

  const addSkill = () => setForm(f => ({ ...f, componentes: [...f.componentes, { tipo: "skill", referencia: "", quantidade: 1 }] }));
  const addMaterial = () => setForm(f => ({ ...f, componentes: [...f.componentes, { tipo: "material", referencia: "", material_id: null, quantidade: 1 }] }));
  const updateComp = (idx: number, patch: Partial<PackComponent>) => setForm(f => ({ ...f, componentes: f.componentes.map((c, i) => i === idx ? { ...c, ...patch } : c) }));
  const removeComp = (idx: number) => setForm(f => ({ ...f, componentes: f.componentes.filter((_, i) => i !== idx) }));

  const skills = useMemo(() => [...COLABORADOR_SKILLS].filter(s => s !== "Outro").sort((a,b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" })), []);
  const visible = useMemo(() => packs.filter(p => (showInactive || p.ativo === 1) && (!search.trim() || `${p.nome} ${p.descricao}`.toLowerCase().includes(search.toLowerCase()))).sort((a,b) => a.nome.localeCompare(b.nome,"pt-PT",{sensitivity:"base"})), [packs, search, showInactive]);

  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: lightTheme ? "#fff" : "var(--theme-input-bg)", color: C.text, border: `1px solid ${C.border}`, minHeight: 40, padding: "0 10px", fontFamily: "inherit", outline: "none" };
  const label: React.CSSProperties = { display: "block", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: C.muted, marginBottom: 5, fontWeight: 700 };
  const button: React.CSSProperties = { border: `1px solid ${C.border}`, background: "transparent", color: C.text, minHeight: 36, padding: "0 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" };

  return <>
    <div className="desk-shell" style={{ minHeight: "100vh", background: C.bg, color: C.text, opacity: mounted ? 1 : 0 }}>
      <DesktopNav userName={userName} active="packs" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />
      <main style={{ marginLeft: 0, padding: "2.75rem 3rem", maxWidth: 1560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
          <div><div style={{ fontSize: 11, letterSpacing: ".26em", textTransform: "uppercase", color: C.accent }}>Produtos comerciais</div><h1 style={{ margin: "8px 0 6px", fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 38 }}>Packs</h1><p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Preço próprio do pack + composição por skills e materiais. Standalones continuam a vir de Colaboradores.</p></div>
          <div style={{ display: "flex", gap: 8 }}><ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} /><button onClick={openNew} style={{ ...button, background: C.accent, color: lightTheme ? "#fff" : "var(--theme-bg)", borderColor: C.accent }}>Novo Pack</button></div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar packs..." style={{ ...input, maxWidth: 360 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: C.muted }}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Mostrar inativos</label>
        </div>

        {loading ? <div style={{ color: C.muted }}>A carregar…</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
          {visible.map(p => <article key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16, opacity: p.ativo ? 1 : .5, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{p.descricao || "Sem descrição"}</div></div><span style={{ fontSize: 10, color: p.ativo ? C.success : C.muted }}>{p.ativo ? "ATIVO" : "INATIVO"}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 14 }}>
              <Price label="Cliente final" value={p.valor_cliente_final} C={C} /><Price label="Parceria" value={p.valor_parceria} C={C} /><Price label="SUD" value={p.valor_sud} C={C} /><Price label="Residência" value={p.valor_residencia} C={C} /><Price label="Evento residência" value={p.valor_evento_residencia} C={C} />
              <div style={{ padding: 16, border: `1px solid ${C.border}` }}><div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>Composição</div><div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>{p.componentes?.length || 0} componente{p.componentes?.length === 1 ? "" : "s"}</div></div>
            </div>
            {p.componentes?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{p.componentes.slice(0,6).map((c,i) => <span key={i} style={{ fontSize: 10, padding: "4px 6px", border: `1px solid ${C.border}`, color: C.muted }}>{c.quantidade > 1 ? `${c.quantidade}× ` : ""}{c.tipo === "material" ? (c.material_nome || c.referencia) : c.referencia}</span>)}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={() => openEdit(p)} style={button}>Editar</button><button onClick={async () => { await togglePackComercialAtivo(p.id, p.ativo ? 0 : 1); await load(); }} style={{ ...button, color: p.ativo ? C.danger : C.success }}>{p.ativo ? "Desativar" : "Reativar"}</button></div>
          </article>)}
        </div>}
      </main>
    </div>

    <div className="mob-shell" style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 88, opacity: mounted ? 1 : 0 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, borderBottom: `1px solid ${C.border}`, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 10, color: C.accent, letterSpacing: ".2em" }}>PACKS</div><div style={{ fontSize: 19, fontFamily: "'Cormorant Garamond',serif" }}>Produtos comerciais</div></div><button onClick={openNew} style={{ ...button, background: C.accent, color: lightTheme ? "#fff" : "var(--theme-bg)" }}>+ Novo</button></div>
      <div style={{ padding: 16 }}><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." style={input} /></div>
      <div>{visible.map(p => <div key={p.id} onClick={() => openEdit(p)} style={{ padding: "14px 14px", borderBottom: `1px solid ${C.border}`, opacity: p.ativo ? 1 : .5 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>{p.nome}</b><span style={{ color: C.accent, fontWeight: 700 }}>{euro(p.valor_cliente_final)}</span></div><div style={{ marginTop: 5, fontSize: 12, color: C.muted }}>{p.componentes?.length || 0} componentes · Parceiro {euro(p.valor_parceria)} · SUD {euro(p.valor_sud)}</div></div>)}</div>
      <MobTabBar active="packs" role={userRole} lightTheme={lightTheme} />
    </div>

    {drawer.open && <div onMouseDown={e => { if (e.target === e.currentTarget) setDrawer({ open: false, id: null }); }} style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,.55)", display: "flex", justifyContent: "flex-end" }}>
      <section style={{ width: "min(720px,100vw)", height: "100%", overflowY: "auto", background: C.elevated, color: C.text, padding: "20px 20px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 20 }}><div><div style={{ fontSize: 10, color: C.accent, letterSpacing: ".2em" }}>{drawer.id ? "EDITAR PACK" : "NOVO PACK"}</div><h2 style={{ margin: "5px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 30 }}>{form.nome || "Pack"}</h2></div><button onClick={() => setDrawer({ open: false, id: null })} style={button}>Fechar</button></div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
          <label><span style={label}>Nome</span><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={input} /></label>
          <label><span style={label}>Descrição curta</span><input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={input} /></label>
        </div>
        <div style={{ marginTop: 18, fontSize: 11, color: C.accent, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase" }}>Faturação do Pack</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginTop: 9 }}>
          {[['valor_cliente_final','Cliente Final'],['valor_parceria','Parceria'],['valor_sud','SUD'],['valor_residencia','Residência'],['valor_evento_residencia','Evento Residência']].map(([key,txt]) => <label key={key}><span style={label}>{txt}</span><input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} inputMode="decimal" placeholder="0" style={{ ...input, textAlign: "right" }} /></label>)}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.border}` }}><div><div style={{ fontSize: 11, color: C.accent, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase" }}>Composição</div><div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Skills são executantes; materiais são equipamento incluído.</div></div><div style={{ display: "flex", gap: 12 }}><button onClick={addSkill} style={button}>+ Skill</button><button onClick={addMaterial} style={button}>+ Material</button></div></div>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {form.componentes.length === 0 && <div style={{ border: `1px dashed ${C.border}`, padding: 16, color: C.muted, fontSize: 12 }}>Sem componentes definidos. O pack pode ser vendido, mas o custo estimado ficará sem composição.</div>}
          {form.componentes.map((c, idx) => <div key={idx} style={{ border: `1px solid ${C.border}`, padding: 10, display: "grid", gridTemplateColumns: "minmax(0,1fr) 82px auto", gap: 8, alignItems: "center", minWidth: 0 }}>
            {c.tipo === "skill" ? <select value={c.referencia} onChange={e => updateComp(idx, { referencia: e.target.value })} style={input}><option value="">Escolher skill...</option>{skills.map(s => <option key={s} value={s}>{s}</option>)}</select> : <div style={{ display: "flex", gap: 8, minWidth: 0, alignItems: "center" }}>{c.material_id && materials.find(m => m.id === c.material_id)?.imagem ? <img src={materials.find(m => m.id === c.material_id)?.imagem} alt="" style={{ width: 42, height: 42, objectFit: "cover", border: `1px solid ${C.border}`, flexShrink: 0 }} /> : null}<select value={c.material_id || ""} onChange={e => { const id = Number(e.target.value) || null; const m = materials.find(x => x.id === id); updateComp(idx, { material_id: id, referencia: m?.nome || "", material_nome: m?.nome || "", material_imagem: m?.imagem || "", material_custo_interno: Number(m?.custo_interno || 0) }); }} style={{ ...input, minWidth: 0 }}><option value="">Escolher material...</option>{materials.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-PT")).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>}
            <input type="number" min={1} value={c.quantidade} onChange={e => updateComp(idx, { quantidade: Math.max(1, Number(e.target.value) || 1) })} style={{ ...input, textAlign: "center" }} title="Quantidade" />
            <button onClick={() => removeComp(idx)} style={{ ...button, color: C.danger }}>Retirar</button>
          </div>)}
        </div>

        <label style={{ display: "block", marginTop: 18 }}><span style={label}>Notas internas</span><textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={4} style={{ ...input, minHeight: 90, padding: 10, resize: "vertical" }} /></label>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 20 }}><label style={{ display: "flex", alignItems: "center", gap: 12, color: C.muted, fontSize: 12 }}><input type="checkbox" checked={form.ativo === 1} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked ? 1 : 0 }))} /> Pack ativo</label><button disabled={saving} onClick={save} style={{ ...button, background: C.accent, color: lightTheme ? "#fff" : "var(--theme-bg)", borderColor: C.accent, minWidth: 130 }}>{saving ? "A guardar…" : "Guardar Pack"}</button></div>
      </section>
    </div>}

    {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9000, background: C.surface, color: C.accent, border: `1px solid ${C.border}`, padding: "12px 16px", fontSize: 12 }}>{toast}</div>}
  </>;
}

function Price({ label, value, C }: { label: string; value: number; C: any }) { return <div style={{ padding: 16, border: `1px solid ${C.border}` }}><div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>{label}</div><div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>{euro(value)}</div></div>; }

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const links = [{href:"/dashboard",label:"Dashboard"},{href:"/agenda",label:"Agenda"},{href:"/leads",label:"Leads"},{href:"/faturacao",label:"Faturação"},{href:"/pagamentos",label:"Pagamentos"},{href:"/colaboradores",label:"Colaboradores"},{href:"/packs",label:"Packs"},{href:"/valores",label:"Valores"},{href:"/residencias",label:"Residências"},{href:"/materiais",label:"Materiais"},{href:"/clientes",label:"Clientes"}];
  return <aside style={{ position:"fixed",left:0,top:0,bottom:0,width:220,background:"var(--theme-surface)",borderRight:"1px solid var(--theme-border)",padding:"22px 14px",boxSizing:"border-box",zIndex:100 }}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,letterSpacing:".2em",color:"var(--theme-accent)",marginBottom:20}}>LLE</div><nav style={{display:"grid",gap:3}}>{links.map(l=><a key={l.href} href={l.href} style={{padding:"9px 10px",textDecoration:"none",fontSize: 12,letterSpacing:".05em",color:active===l.href.slice(1)?"var(--theme-accent)":"var(--theme-text-muted)",background:active===l.href.slice(1)?"rgba(var(--theme-accent-rgb),.08)":"transparent"}}>{l.label}</a>)}</nav><div style={{position:"absolute",bottom:18,left:14,right:14,fontSize: 11,color:"var(--theme-text-faint)"}}><div>{userName}</div><button onClick={onLogout} style={{marginTop:7,border:0,background:"transparent",padding:0,color:"var(--theme-danger)",fontSize: 10,cursor:"pointer"}}>SAIR</button></div></aside>;
}
