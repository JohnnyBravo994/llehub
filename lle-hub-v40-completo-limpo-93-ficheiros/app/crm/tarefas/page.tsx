"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCRMTasksOverview, setCRMTaskComplete, type CRMType } from "../../crm-actions";
import DesktopNav from "../../DesktopNav";
import MobTabBar from "../../MobTabBar";
import {useTheme} from "../../useTheme";
import {ThemeSwitcher} from "../../ThemeSwitcher";

type Task={id:number;tipo:CRMType;registo_id:number;titulo:string;responsavel:string;vence_em:string;estado:string;autor:string;titulo_registo:string};
export default function CRMTasksPage(){
  const router=useRouter();
  const {lightTheme,setLightTheme}=useTheme();
  const [user,setUser]=useState("");
  const [role,setRole]=useState("");
  const [ready,setReady]=useState(false);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [filter,setFilter]=useState<"minhas"|"todas">("minhas");
  const [status,setStatus]=useState<"pendentes"|"todas">("pendentes");
  const [busy,setBusy]=useState(0);
  const [error,setError]=useState("");
  async function load(){const r=await getCRMTasksOverview(user);if(r.success)setTasks(r.data as Task[]);else setError("Não foi possível carregar as tarefas.");}
  useEffect(()=>{
    let u:{name?:string;role?:string}|null=null;
    try{u=JSON.parse(localStorage.getItem("lle_user")||"null");}catch{}
    if(!u?.name){router.replace("/");return;}
    if(!["admin","finance","limited_novalues"].includes(u.role||"")){router.replace("/agenda");return;}
    setUser(u.name);setRole(u.role||"");setReady(true);
  },[router]);
  useEffect(()=>{if(ready)void load();},[ready]);
  const filtered=tasks.filter(t=>(filter==="todas"||t.responsavel.trim().toLocaleLowerCase("pt-PT")===user.trim().toLocaleLowerCase("pt-PT"))&&(status==="todas"||t.estado!=="Concluída"));
  const pending=tasks.filter(t=>t.estado!=="Concluída");
  const done=async(t:Task)=>{
    setBusy(t.id);setError("");
    try{const r=await setCRMTaskComplete(t.id,t.estado!=="Concluída",user);if(!r.success)setError("Não foi possível atualizar.");else await load();}
    catch{setError("Erro ao atualizar tarefa.");}finally{setBusy(0);}
  };
  if(!ready)return <div className="crm-loading">LLE <span>CRM · a carregar</span></div>;
  return <div className="crm-page">
    <div className="mob-page-desktop"><DesktopNav userName={user} active="leads" onLogout={()=>{localStorage.removeItem("lle_user");router.push("/");}}/></div>
    <main className="crm-layout">
      <div className="crm-toolbar"><button className="crm-back" onClick={()=>router.push("/leads")}>← Voltar às Leads</button><ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme}/></div>
      <header className="crm-header"><p className="crm-eyebrow">LLE CRM / SEGUIMENTO COMERCIAL</p><h1 className="crm-title">Tarefas e follow-ups</h1><p className="crm-subtext">{pending.length} tarefas pendentes na equipa. Cada tarefa está ligada à ficha CRM de origem.</p></header>
      <section className="crm-sheet">
        <div className="crm-view-switch crm-task-filters"><button className={filter==="minhas"?"active":""} onClick={()=>setFilter("minhas")}>As minhas tarefas</button><button className={filter==="todas"?"active":""} onClick={()=>setFilter("todas")}>Toda a equipa</button><button className={status==="pendentes"?"active":""} onClick={()=>setStatus("pendentes")}>Pendentes</button><button className={status==="todas"?"active":""} onClick={()=>setStatus("todas")}>Todas</button></div>
        {error && <p className="crm-alert crm-alert-error">{error}</p>}
        {filtered.length===0?<p className="crm-muted" style={{padding:"25px 0"}}>Nenhuma tarefa com os filtros selecionados.</p>:filtered.map(t=><div className="crm-task-row" key={t.id}>
          <input type="checkbox" checked={t.estado==="Concluída"} disabled={busy===t.id} onChange={()=>done(t)} aria-label={`Concluir ou reabrir ${t.titulo}`}/>
          <div><button className="crm-name-button" onClick={()=>router.push(`/crm/${t.tipo}/${t.registo_id}`)}>{t.titulo}</button><small>{t.titulo_registo} · {t.responsavel||"Sem responsável"} · {t.vence_em||"Sem prazo"}</small></div>
          {t.vence_em&&t.vence_em<new Date().toISOString().slice(0,10)&&t.estado!=="Concluída"&&<span className="crm-overdue">Atrasada</span>}
          <button className="crm-list-link" onClick={()=>router.push(`/crm/${t.tipo}/${t.registo_id}`)}>Ficha →</button>
        </div>)}
      </section>
    </main>
    <div className="crm-mobile-nav"><MobTabBar active="leads" role={role} lightTheme={lightTheme}/></div>
  </div>;
}
