"use client";

import { useParams, useRouter } from "next/navigation";
import { guardarNotificacaoMarketing } from "../../../actions";
import { useCallback, useEffect, useState } from "react";
import DesktopNav from "../../../DesktopNav";
import MobTabBar from "../../../MobTabBar";
import { ThemeSwitcher } from "../../../ThemeSwitcher";
import { useTheme } from "../../../useTheme";
import {
  getCRMPageData, saveCRMProfile, addCRMInteraction, addCRMTask, setCRMTaskComplete,
  type CRMProfile, type CRMType, type CRMRelation, type CRMInteraction, type CRMTask,
} from "../../../crm-actions";

type Summary = { nome:string; nome_oficial:string; email:string; telefone:string; notas:string; data:string; hora:string; local:string; estado:string; cliente:string; servico:string };
type CRMMarketing = {solicitado:boolean;estado:string;enviado_em:string};
type Detail = { resumo:Summary; tipo:CRMType; id:number; ficha:CRMProfile; relations:CRMRelation[]; interacoes:CRMInteraction[]; tarefas:CRMTask[]; equipa:{nome:string;funcao:string}[]; marketing:CRMMarketing|null };
type Tab = "resumo" | "historico" | "tarefas" | "relacionados";
const labels:Record<CRMType,string> = {lead:"Lead",evento:"Evento",cliente:"Cliente"};
const routes:Record<CRMType,string> = {lead:"/leads",evento:"/agenda",cliente:"/clientes"};
const ORIGENS = ["", "Instagram", "Facebook", "Google", "Website", "WhatsApp", "Email", "Recomendação", "Cliente existente", "Evento / Networking", "Parceiro", "Outro"];
const CANAIS = ["", "Instagram", "Facebook", "Email", "Telefone", "WhatsApp", "Website", "Presencial", "Outro"];
const INTERACOES = ["Contacto inicial", "Telefone", "WhatsApp", "Email", "Reunião", "Proposta enviada", "Follow-up", "Nota", "Outro"];
const EMPTY:CRMProfile = {origem:"",origem_detalhe:"",canal:"",primeiro_contacto:"",contactado_por:"",responsavel:"",resumo:"",etiquetas:""};

function localDateTime() {
  const d = new Date();
  const pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(s?:string) {
  if(!s) return "—";
  const d=new Date(s.slice(0,10)+"T12:00:00");
  if(Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtDateTime(s?:string) {
  return s ? `${fmtDate(s)}${s.length>=16?` · ${s.slice(11,16)}`:""}` : "—";
}
function Field({title,children}:{title:string;children:React.ReactNode}) {
  return <div className="crm-detail"><div className="crm-label">{title}</div><div className="crm-value">{children || "—"}</div></div>;
}

export default function CRMPage() {
  const params=useParams();
  const router=useRouter();
  const {lightTheme,setLightTheme}=useTheme();
  const tipo=String(params.tipo || "");
  const id=Number(params.id);
  const valid=["lead","evento","cliente"].includes(tipo)&&Number.isSafeInteger(id)&&id>0;
  const [username,setUsername]=useState("");
  const [role,setRole]=useState("");
  const [authorized,setAuthorized]=useState(false);
  const [data,setData]=useState<Detail|null>(null);
  const [ficha,setFicha]=useState<CRMProfile>(EMPTY);
  const [tab,setTab]=useState<Tab>("resumo");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [interaction,setInteraction]=useState({natureza:"Telefone",descricao:"",interlocutor:"",aconteceu_em:localDateTime()});
  const [task,setTask]=useState({titulo:"",responsavel:"",vence_em:""});
  const [showNewInteraction,setShowNewInteraction]=useState(false);
  const [showNewTask,setShowNewTask]=useState(false);
  const [showAllHistory,setShowAllHistory]=useState(false);
  const [marketingRequested,setMarketingRequested]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    if(!valid){setError("Endereço CRM inválido.");setLoading(false);return;}
    const r=await getCRMPageData(tipo,id,username);
    if(r.success && r.data){
      const v=r.data as Detail;
      setData(v);setFicha({...EMPTY,...v.ficha});
      setMarketingRequested(Boolean(v.marketing?.solicitado));setError("");
    } else setError(r.message || "Erro ao carregar ficha.");
    setLoading(false);
  },[tipo,id,valid,username]);

  useEffect(()=>{
    let u:{name?:string;role?:string}|null=null;
    try{u=JSON.parse(localStorage.getItem("lle_user") || "null");}catch{}
    if(!u?.name){router.replace("/");return;}
    if(!["admin","finance","limited_novalues"].includes(u.role||"")){router.replace("/agenda");return;}
    setUsername(u.name);
    setRole(u.role||"");
    setAuthorized(true);
  },[router]);
  useEffect(()=>{if(authorized)void load();},[authorized,load]);

  const send=async(fn:()=>Promise<{success:boolean;message?:string}>,success:string)=>{
    setBusy(true);setNotice("");setError("");
    try{
      const r=await fn();
      if(!r.success) setError(r.message||"Não foi possível guardar.");
      else {setNotice(success);await load();}
      return !!r.success;
    }catch{setError("Não foi possível guardar. Verifica a ligação.");return false;}
    finally{setBusy(false);}
  };
  const save=()=>send(()=>saveCRMProfile(tipo,id,ficha,username),"Ficha CRM atualizada.");
  const canNotifyMarketing = tipo === "evento" && ["João", "Tânia", "Inês", "Soraya"].includes(username);
  const saveMarketing = async () => {
    if (!canNotifyMarketing || !valid || busy) return;
    setBusy(true);setNotice("");setError("");
    try {
      const result = await guardarNotificacaoMarketing(id, marketingRequested, username);
      await load();
      if (result.success) setNotice(result.message);
      else setError(result.message || "Falhou a notificação de Marketing.");
    } catch {
      setError("Não foi possível guardar o pedido de Marketing.");
    } finally { setBusy(false); }
  };
  const addContact=async()=>{
    const ok=await send(()=>addCRMInteraction(tipo,id,interaction,username),"Contacto registado no histórico.");
    if(ok){setInteraction({natureza:"Telefone",descricao:"",interlocutor:"",aconteceu_em:localDateTime()});setShowNewInteraction(false);}
  };
  const addTask=async()=>{
    const ok=await send(()=>addCRMTask(tipo,id,task,username),"Tarefa criada.");
    if(ok){setTask({titulo:"",responsavel:username,vence_em:""});setShowNewTask(false);}
  };
  const done=async(t:CRMTask)=>{await send(()=>setCRMTaskComplete(t.id,t.estado!=="Concluída",username),"Tarefa atualizada.");};
  const target=(valid?tipo:"lead") as CRMType;
  const related=(data?.relations||[]);
  const openTasks=(data?.tarefas||[]).filter(t=>t.estado!=="Concluída");
  const closedTasks=(data?.tarefas||[]).filter(t=>t.estado==="Concluída");
  const lateTasks=openTasks.filter(t=>t.vence_em && t.vence_em < new Date().toISOString().slice(0,10));
  const tags=(ficha.etiquetas||"").split(",").map(s=>s.trim()).filter(Boolean);

  const textField=(key:keyof CRMProfile,label:string,placeholder:string,opts:{multi?:boolean;date?:boolean;options?:string[]}={})=>(
    <label className="crm-editfield" key={key}>
      <span className="crm-label">{label}</span>
      {opts.multi ? <textarea className="crm-input crm-textarea" value={ficha[key]||""} onChange={e=>setFicha(f=>({...f,[key]:e.target.value}))} placeholder={placeholder} rows={5}/>
      : opts.options ? <select className="crm-input" value={ficha[key]||""} onChange={e=>setFicha(f=>({...f,[key]:e.target.value}))}>
          {opts.options.map(s=><option key={s} value={s}>{s||"— Por definir —"}</option>)}
        </select>
      : <input type={opts.date?"date":"text"} list={key==="responsavel"||key==="contactado_por"?"lle-crm-pessoas":undefined} className="crm-input" value={ficha[key]||""} onChange={e=>setFicha(f=>({...f,[key]:e.target.value}))} placeholder={placeholder}/>}
    </label>
  );

  if(!authorized || loading) return <div className="crm-loading">LLE <span>CRM · a carregar ficha</span></div>;
  return <div className="crm-page">
    <div className="mob-page-desktop"><DesktopNav userName={username} active={target==="evento"?"agenda":target==="lead"?"leads":"clientes"} onLogout={()=>{localStorage.removeItem("lle_user");router.push("/");}}/></div>
    <main className="crm-layout">
      <div className="crm-toolbar">
        <button className="crm-back" onClick={()=>router.push(routes[target])}>← {target==="lead"?"Leads":target==="evento"?"Agenda":"Clientes"}</button>
        <div className="crm-toolbar-right">
          <button type="button" className="crm-list-link" onClick={()=>router.push("/crm/tarefas")}>As minhas tarefas</button>
          <span className="crm-brand">LLE <span>CRM · v38</span></span>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme}/>
        </div>
      </div>
      {error && <p className="crm-alert crm-alert-error" role="alert">{error}</p>}
      {notice && <p className="crm-alert" role="status">{notice}</p>}
      {!data ? <div className="crm-sheet">Ficha indisponível. <button className="crm-secondary" onClick={load}>Tentar novamente</button></div> : <>
        <section className="crm-header">
          <p className="crm-eyebrow">{labels[data.tipo].toUpperCase()} / FICHA 360º · #{id}</p>
          <h1 className="crm-title">{data.resumo.nome}</h1>
          <div className="crm-chips">
            {data.resumo.estado && <span className="crm-chip">{data.resumo.estado}</span>}
            {data.resumo.data && <span className="crm-chip">{fmtDate(data.resumo.data)}</span>}
            {ficha.origem && <span className="crm-chip">Origem: {ficha.origem}</span>}
            {ficha.responsavel && <span className="crm-chip">Responsável: {ficha.responsavel}</span>}
            {tags.map(t=><span className="crm-chip" key={t}>#{t}</span>)}
          </div>
          <p className="crm-subtext">CRM complementar. A ficha operacional original e os valores existentes mantêm-se inalterados.</p>
        </section>
        <div className="crm-tabbar" role="tablist" aria-label="Secções do CRM">
          {(["resumo","historico","tarefas","relacionados"] as Tab[]).map(k=><button role="tab" aria-selected={tab===k} className={"crm-tab"+(tab===k?" active":"")} key={k} onClick={()=>setTab(k)}>
            {{resumo:"Resumo",historico:"Histórico",tarefas:"Tarefas",relacionados:"Relacionados"}[k]}
            {k==="tarefas" && openTasks.length>0 ? <b>{openTasks.length}</b> : null}
            {k==="relacionados" && related.length>0 ? <b>{related.length}</b> : null}
          </button>)}
        </div>
        <datalist id="lle-crm-pessoas">{["João","Tânia","Soraya","Inês","Larissa"].map(n=><option key={n} value={n}/>)}</datalist>
        {tab==="resumo" && <div className="crm-grid">
          <div className="crm-stack">
            <section className="crm-sheet">
              <div className="crm-section-heading"><h2>Visão geral</h2><span>Dados atuais do Hub</span></div>
              <div className="crm-properties">
                {data.resumo.cliente && <Field title="Cliente">{data.resumo.cliente}</Field>}
                {data.resumo.nome_oficial && <Field title="Nome oficial">{data.resumo.nome_oficial}</Field>}
                {data.resumo.data && <Field title="Data do evento">{fmtDate(data.resumo.data)}</Field>}
                {data.resumo.hora && <Field title="Horário">{data.resumo.hora}</Field>}
                {data.resumo.local && <Field title="Local">{data.resumo.local}</Field>}
                {data.resumo.servico && <Field title="Serviço">{data.resumo.servico}</Field>}
                {data.resumo.telefone && <Field title="Contacto">{data.resumo.telefone}</Field>}
                {data.resumo.email && <Field title="Email">{data.resumo.email}</Field>}
                {data.resumo.notas && <div className="crm-original-note"><div className="crm-label">Notas originais</div>{data.resumo.notas}</div>}
                {!data.resumo.notas && !data.resumo.cliente && !data.resumo.local && !data.resumo.data && !data.resumo.email && <p className="crm-muted">Os dados comerciais podem ser editados no módulo original.</p>}
              </div>
              {data.equipa.length>0 && <div className="crm-team"><div className="crm-label">Equipa atribuída</div>{data.equipa.map((p,i)=><span key={i} className="crm-chip">{p.nome} · {p.funcao}</span>)}</div>}
              {tipo === "evento" && <div className="crm-marketing">
                <div className="crm-label">Equipa de Marketing</div>
                {canNotifyMarketing ? <>
                  <label className="crm-marketing-check">
                    <input type="checkbox" checked={marketingRequested} disabled={busy} onChange={e=>setMarketingRequested(e.target.checked)} />
                    Notificar Marketing por email
                  </label>
                  <p className="crm-helper">Enviar para deptMarketing@lifeliveevent.eu o nome, a data, o horário, o local e as pessoas atribuídas. Sem valores financeiros.</p>
                  <div className="crm-marketing-footer">
                    <span className="crm-marketing-status">{data.marketing?.estado === "enviado" ? "Enviado" : data.marketing?.estado === "erro" ? "Erro no envio" : data.marketing?.solicitado ? "Pendente" : "Não solicitado"}</span>
                    <button className="crm-primary" type="button" disabled={busy} onClick={saveMarketing}>
                      {busy ? "A guardar…" : marketingRequested ? (data.marketing?.estado === "enviado" ? "Confirmar estado" : "Guardar e notificar") : "Guardar opção"}
                    </button>
                  </div>
                  {data.marketing?.estado === "enviado" && <p className="crm-helper">Pedido enviado. Voltar a guardar não envia duplicados.</p>}
                </> : <p className="crm-muted">A notificação de Marketing é gerida por João, Tânia, Inês e Soraya.</p>}
              </div>}
              <button className="crm-link" onClick={()=>router.push(routes[target])}>Abrir módulo original →</button>
            </section>
            <section className="crm-sheet">
              <div className="crm-section-heading"><h2>Resumo da relação</h2><span>Registo do CRM</span></div>
              {textField("resumo","Briefing / contexto / próximos passos","O que importa saber sobre esta relação?",{multi:true})}
              <p className="crm-helper">Esta descrição é adicional e não substitui as notas do evento ou cliente.</p>
            </section>
          </div>
          <div className="crm-stack">
            <section className="crm-sheet">
              <div className="crm-section-heading"><h2>Proveniência</h2><span>Quem · Quando · Como</span></div>
              <div className="crm-formgrid">
                {textField("origem","Como chegou até nós?","Origem",{options:ORIGENS})}
                {textField("origem_detalhe","Referência / campanha / quem recomendou","Ex.: indicado pela Ana, campanha Instagram…")}
                {textField("canal","Canal do primeiro contacto","Canal",{options:CANAIS})}
                {textField("primeiro_contacto","Data do primeiro contacto","",{date:true})}
                {textField("contactado_por","Quem fez o primeiro contacto?","Nome da pessoa")}
                {textField("responsavel","Responsável LLE","Ex.: Larissa")}
                {textField("etiquetas","Etiquetas (separadas por vírgula)","Casamento, Corporate, VIP")}
              </div>
              <div className="crm-actions"><button className="crm-primary" disabled={busy} onClick={save}>{busy?"A guardar…":"Guardar informações CRM"}</button></div>
            </section>
            <section className="crm-sheet">
              <div className="crm-section-heading"><h2>Próximas ações</h2><button className="crm-link" onClick={()=>setTab("tarefas")}>Ver todas →</button></div>
              {lateTasks.length>0 && <p className="crm-warn">{lateTasks.length} {lateTasks.length===1?"tarefa atrasada":"tarefas atrasadas"}</p>}
              {openTasks.length===0?<p className="crm-muted">Nenhuma tarefa pendente.</p>:openTasks.slice(0,4).map(t=><div className="crm-mini-task" key={t.id}><span>□</span><div>{t.titulo}<small>{t.responsavel||"Sem responsável"} · {fmtDate(t.vence_em)}</small></div></div>)}
              <button className="crm-secondary" onClick={()=>{setTab("tarefas");setShowNewTask(true);}}>+ Nova tarefa</button>
            </section>
          </div>
        </div>}
        {tab==="historico" && <section className="crm-sheet crm-tab-content">
          <div className="crm-section-heading"><h2>Histórico de contactos</h2><button className="crm-primary" onClick={()=>setShowNewInteraction(v=>!v)}>+ Registar contacto</button></div>
          {showNewInteraction && <div className="crm-editor">
            <div className="crm-formgrid">
              <label className="crm-editfield"><span className="crm-label">Tipo</span><select className="crm-input" value={interaction.natureza} onChange={e=>setInteraction(v=>({...v,natureza:e.target.value}))}>{INTERACOES.map(s=><option key={s}>{s}</option>)}</select></label>
              <label className="crm-editfield"><span className="crm-label">Quando aconteceu</span><input className="crm-input" type="datetime-local" value={interaction.aconteceu_em} onChange={e=>setInteraction(v=>({...v,aconteceu_em:e.target.value}))}/></label>
              <label className="crm-editfield"><span className="crm-label">Com quem falámos?</span><input className="crm-input" value={interaction.interlocutor} onChange={e=>setInteraction(v=>({...v,interlocutor:e.target.value}))} placeholder="Nome do interlocutor"/></label>
            </div>
            <label className="crm-editfield"><span className="crm-label">O que foi conversado?</span><textarea className="crm-input crm-textarea" rows={4} value={interaction.descricao} onChange={e=>setInteraction(v=>({...v,descricao:e.target.value}))} placeholder="Resumo, acordos, perguntas, próximos passos…"/></label>
            <div className="crm-actions"><button className="crm-secondary" onClick={()=>setShowNewInteraction(false)}>Cancelar</button><button className="crm-primary" disabled={busy||!interaction.descricao.trim()} onClick={addContact}>Guardar contacto</button></div>
          </div>}
          {data.interacoes.length===0?<p className="crm-muted">Ainda não existem contactos registados. Começa por adicionar o primeiro.</p>:<div className="crm-timeline">
            {(showAllHistory?data.interacoes:data.interacoes.slice(0,40)).map(h=><div className="crm-timeline-row" key={h.id}>
              <span className="crm-timeline-dot"/>
              <div className="crm-timeline-content"><div className="crm-timeline-top"><strong>{h.natureza}</strong><time>{fmtDateTime(h.aconteceu_em)}</time></div>
                <p>{h.descricao}</p><small>Registado por {h.autor}{h.interlocutor?` · Interlocutor: ${h.interlocutor}`:""}{h.tipo!==tipo||h.registo_id!==id?` · ${labels[h.tipo]} #${h.registo_id}`:""}</small>
              </div>
            </div>)}
            {!showAllHistory&&data.interacoes.length>40&&<button className="crm-secondary" onClick={()=>setShowAllHistory(true)}>Mostrar mais registos</button>}
          </div>}
        </section>}
        {tab==="tarefas" && <section className="crm-sheet crm-tab-content">
          <div className="crm-section-heading"><h2>Tarefas & follow-ups</h2><button className="crm-primary" onClick={()=>{setTask(v=>({...v,responsavel:v.responsavel||username}));setShowNewTask(v=>!v);}}>+ Nova tarefa</button></div>
          {showNewTask && <div className="crm-editor"><label className="crm-editfield"><span className="crm-label">O que é preciso fazer?</span><input className="crm-input" value={task.titulo} onChange={e=>setTask(v=>({...v,titulo:e.target.value}))} placeholder="Ex.: Fazer follow-up da proposta"/></label>
            <div className="crm-formgrid"><label className="crm-editfield"><span className="crm-label">Responsável</span><input className="crm-input" list="lle-crm-pessoas" value={task.responsavel} onChange={e=>setTask(v=>({...v,responsavel:e.target.value}))} placeholder="Quem trata disto?"/></label>
              <label className="crm-editfield"><span className="crm-label">Data limite</span><input className="crm-input" type="date" value={task.vence_em} onChange={e=>setTask(v=>({...v,vence_em:e.target.value}))}/></label></div>
            <div className="crm-actions"><button className="crm-secondary" onClick={()=>setShowNewTask(false)}>Cancelar</button><button className="crm-primary" disabled={busy||!task.titulo.trim()} onClick={addTask}>Criar tarefa</button></div>
          </div>}
          {openTasks.length===0&&closedTasks.length===0?<p className="crm-muted">Ainda não há tarefas. Cria um follow-up com responsável e data.</p>:<>
            {openTasks.map(t=><div key={t.id} className="crm-task-row"><input type="checkbox" checked={false} disabled={busy} onChange={()=>done(t)} aria-label={`Concluir ${t.titulo}`}/>
              <div><strong>{t.titulo}</strong><small>{t.responsavel||"Sem responsável"} · {fmtDate(t.vence_em)}{t.tipo!==tipo||t.registo_id!==id?` · ${labels[t.tipo]} #${t.registo_id}`:""}</small></div>
              {t.vence_em&&t.vence_em<new Date().toISOString().slice(0,10) && <span className="crm-overdue">Atrasada</span>}
            </div>)}
            {closedTasks.length>0&&<><h3 className="crm-completed-label">Concluídas ({closedTasks.length})</h3>{closedTasks.map(t=><div key={t.id} className="crm-task-row completed"><input type="checkbox" checked disabled={busy} onChange={()=>done(t)} aria-label={`Reabrir ${t.titulo}`}/><div><strong>{t.titulo}</strong><small>{t.responsavel||"Sem responsável"} · {fmtDate(t.vence_em)}</small></div></div>)}</>}
          </>}
        </section>}
        {tab==="relacionados" && <section className="crm-sheet crm-tab-content">
          <div className="crm-section-heading"><h2>Relações ligadas</h2><span>Leads · Eventos · Clientes</span></div>
          <p className="crm-helper">Associados pelos identificadores existentes no Hub, sem duplicar eventos nem cruzar clientes apenas por terem nomes semelhantes.</p>
          {!related.length?<p className="crm-muted">Ainda não há registos com ligação explícita a esta ficha.</p>:<div className="crm-relation-list">{related.map(r=><button key={`${r.tipo}-${r.id}`} className="crm-relation" onClick={()=>router.push(`/crm/${r.tipo}/${r.id}`)}><span className="crm-relation-kind">{labels[r.tipo]}</span><span className="crm-relation-title">{r.title}</span><span className="crm-relation-date">{r.date?fmtDate(r.date):r.status}</span><span>→</span></button>)}</div>}
        </section>}
      </>}
    </main>
    <div className="crm-mobile-nav"><MobTabBar active={target==="evento"?"agenda":target==="lead"?"leads":"clientes"} role={role} lightTheme={lightTheme}/></div>
  </div>;
}
