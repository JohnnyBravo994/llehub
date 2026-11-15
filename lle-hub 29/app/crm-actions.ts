"use server";

// CRM v37: entidades independentes — nunca altera registos existentes na agenda/leads/clientes.
import { createClient } from "@libsql/client";
import { unstable_noStore as noStore } from "next/cache";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export type CRMType = "lead" | "evento" | "cliente";
const tables: Record<CRMType, string> = { lead: "leads", evento: "agenda", cliente: "clientes" };
const types: CRMType[] = ["lead", "evento", "cliente"];
export type CRMProfile = {
  origem: string; origem_detalhe: string; canal: string; primeiro_contacto: string;
  contactado_por: string; responsavel: string; resumo: string; etiquetas: string;
};
export type CRMRelation = { tipo: CRMType; id: number; title: string; date: string; status: string };
export type CRMMarketingStatus = {
  solicitado: boolean;
  estado: string;
  enviado_em: string;
};
export type CRMInteraction = {
  id: number; tipo: CRMType; registo_id: number; natureza: string; descricao: string;
  interlocutor: string; autor: string; aconteceu_em: string; created_at: string;
};
export type CRMTask = {
  id: number; tipo: CRMType; registo_id: number; titulo: string; responsavel: string;
  vence_em: string; estado: string; autor: string; created_at: string; concluida_em: string;
};

const EMPTY_PROFILE: CRMProfile = {
  origem: "", origem_detalhe: "", canal: "", primeiro_contacto: "", contactado_por: "", responsavel: "", resumo: "", etiquetas: "",
};

function valid(t: string, id: number): t is CRMType {
  return types.includes(t as CRMType) && Number.isSafeInteger(id) && id > 0;
}
function text(v: unknown, max = 3000) {
  return String(v ?? "").trim().slice(0, max);
}
function isoDate(v: unknown) {
  const s = text(v, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function isoDateTime(v: unknown) {
  const s = text(v, 24);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s.replace("T", " ") + ":00" : "";
}
function mapRel(tipo: CRMType, r: Record<string, any>): CRMRelation {
  return {
    tipo, id: Number(r.id),
    title: String(tipo === "lead" ? (r.title || r.client_name || "Lead") : tipo === "evento" ? (r.event_name || "Evento") : (r.alias || r.nome || "Cliente")),
    date: String(tipo === "cliente" ? (r.created_at || "") : (r.event_date || "")),
    status: String(tipo === "lead" ? (r.status || "") : tipo === "evento" ? (r.billing_status || r.status || "") : ""),
  };
}

let ensurePromise: Promise<void> | null = null;
async function ensureCRMTables() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      // Apenas CREATE IF NOT EXISTS: não apaga nem modifica tabelas legadas.
      await db.execute(`CREATE TABLE IF NOT EXISTS crm_fichas (
        tipo TEXT NOT NULL CHECK(tipo IN ('lead','evento','cliente')),
        registo_id INTEGER NOT NULL,
        origem TEXT DEFAULT '', origem_detalhe TEXT DEFAULT '', canal TEXT DEFAULT '', primeiro_contacto TEXT DEFAULT '',
        contactado_por TEXT DEFAULT '', responsavel TEXT DEFAULT '',
        resumo TEXT DEFAULT '', etiquetas TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (tipo, registo_id)
      )`);
      try { await db.execute("ALTER TABLE crm_fichas ADD COLUMN origem_detalhe TEXT DEFAULT ''"); } catch { /* coluna já existente */ }
      await db.execute(`CREATE TABLE IF NOT EXISTS crm_interacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK(tipo IN ('lead','evento','cliente')),
        registo_id INTEGER NOT NULL,
        natureza TEXT NOT NULL DEFAULT 'Nota', descricao TEXT NOT NULL,
        interlocutor TEXT DEFAULT '', autor TEXT NOT NULL,
        aconteceu_em TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS crm_tarefas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK(tipo IN ('lead','evento','cliente')),
        registo_id INTEGER NOT NULL,
        titulo TEXT NOT NULL, responsavel TEXT DEFAULT '', vence_em TEXT DEFAULT '',
        estado TEXT NOT NULL DEFAULT 'Pendente', autor TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')), concluida_em TEXT DEFAULT ''
      )`);
      await db.execute("CREATE INDEX IF NOT EXISTS crm_interacoes_ref_idx ON crm_interacoes(tipo,registo_id,aconteceu_em)");
      await db.execute("CREATE INDEX IF NOT EXISTS crm_tarefas_ref_idx ON crm_tarefas(tipo,registo_id,estado,vence_em)");
    })().catch((e) => { ensurePromise = null; throw e; });
  }
  await ensurePromise;
}
async function exists(tipo: CRMType, id: number, usuario: string = "") {
  const where = tipo === "evento" && usuario === "Larissa" ? " AND visibility='Public'" : "";
  const r = await db.execute({sql: `SELECT id FROM ${tables[tipo]} WHERE id=?${where} LIMIT 1`, args: [id]});
  return r.rows.length > 0;
}
async function parentAndRelations(tipo: CRMType, id: number, usuario: string) {
  const [mr, relatedLeads, relatedEvents] = await Promise.all([
    db.execute({ sql: `SELECT * FROM ${tables[tipo]} WHERE id=? LIMIT 1`, args: [id] }),
    tipo === "cliente" ? db.execute({ sql: "SELECT * FROM leads WHERE cliente_id=? ORDER BY id DESC LIMIT 80", args: [id] }) : Promise.resolve({ rows: [] }),
    tipo === "cliente" ? db.execute({ sql: `SELECT * FROM agenda WHERE cliente_id=? ${usuario === "Larissa" ? "AND visibility='Public'" : ""} ORDER BY id DESC LIMIT 80`, args: [id] }) : Promise.resolve({ rows: [] }),
  ]);
  if (!mr.rows.length) return null;
  const main = mr.rows[0] as Record<string, any>;
  if (tipo === "evento" && usuario === "Larissa" && main.visibility !== "Public") return null;
  const relationRows: CRMRelation[] = [];
  const pushRel = (t: CRMType, row: Record<string, any>) => {
    if (!relationRows.some(v => v.tipo === t && v.id === Number(row.id))) relationRows.push(mapRel(t, row));
  };
  for (const row of relatedLeads.rows as Record<string, any>[]) pushRel("lead", row);
  for (const row of relatedEvents.rows as Record<string, any>[]) pushRel("evento", row);

  if (tipo !== "cliente") {
    const clienteId = Number(main.cliente_id || 0);
    if (clienteId > 0) {
      const cr = await db.execute({sql: "SELECT * FROM clientes WHERE id=? LIMIT 1", args: [clienteId]});
      if (cr.rows[0]) pushRel("cliente", cr.rows[0] as Record<string, any>);
    }
    if (tipo === "lead") {
      const evr = await db.execute({
        sql: `SELECT * FROM agenda WHERE (origem_lead_id=? OR (event_id IS NOT NULL AND event_id<>'' AND event_id=?)) ${usuario === "Larissa" ? "AND visibility='Public'" : ""} ORDER BY id DESC LIMIT 40`,
        args: [id, String(main.event_id || "")],
      });
      for (const row of evr.rows as Record<string, any>[]) pushRel("evento", row);
    } else {
      const leadId = Number(main.origem_lead_id || 0);
      const lr = await db.execute({
        sql: "SELECT * FROM leads WHERE id=? OR (event_id IS NOT NULL AND event_id<>'' AND event_id=?) ORDER BY id DESC LIMIT 40",
        args: [leadId, String(main.event_id || "")],
      });
      for (const row of lr.rows as Record<string, any>[]) pushRel("lead", row);
    }
  }
  // Não misturar clientes com nomes iguais sem uma ligação explícita (cliente_id/event_id).
  return { main, relations: relationRows };
}

export async function getCRMPageData(tipo: string, id: number, usuario: string = "") {
  noStore();
  if (!valid(tipo, id)) return { success: false, message: "Ficha inválida." };
  try {
    await ensureCRMTables();
    const found = await parentAndRelations(tipo, id, usuario);
    if (!found) return { success: false, message: "Registo não encontrado." };
    const main = found.main;
    const refs: { tipo: CRMType; id: number }[] = [{ tipo, id }, ...found.relations.map(r=>({tipo:r.tipo,id:r.id}))];
    const terms = refs.map(() => "(tipo=? AND registo_id=?)").join(" OR ");
    const args = refs.flatMap(r=>[r.tipo, r.id]);
    const [meta, iRes, tRes, artists] = await Promise.all([
      db.execute({sql: "SELECT * FROM crm_fichas WHERE tipo=? AND registo_id=?", args:[tipo,id]}),
      db.execute({sql: `SELECT * FROM crm_interacoes WHERE ${terms} ORDER BY aconteceu_em DESC,id DESC LIMIT 200`, args}),
      db.execute({sql: `SELECT * FROM crm_tarefas WHERE ${terms} ORDER BY CASE estado WHEN 'Pendente' THEN 0 ELSE 1 END,vence_em ASC,id DESC LIMIT 200`, args}),
      tipo === "evento" ? db.execute({sql:"SELECT nome,tipo FROM artistas_evento WHERE evento_id=? ORDER BY id",args:[id]}) : Promise.resolve({rows:[]}),
    ]);
    // Apenas campos operacionais: o CRM não devolve preços, custos, NIF, IBAN nem faturação.
    const resumo = tipo === "cliente" ? {
      nome: text(main.alias || main.nome), nome_oficial: text(main.nome),
      email: text(main.email), telefone: text(main.telefone), notas: text(main.notas),
      data: "", hora: "", local: "", estado: "", cliente: "", servico: "",
    } : tipo === "lead" ? {
      nome: text(main.title), nome_oficial: "", email: "", telefone: text(main.contacto),
      notas: text(main.notas), data: text(main.event_date), hora: "", local: text(main.local),
      estado: text(main.status), cliente: text(main.client_name), servico: text(main.servico_comercial),
    } : {
      nome: text(main.event_name), nome_oficial: "", email: "", telefone: text(main.contacto),
      notas: text(main.notas), data: text(main.event_date), hora: text(main.location),
      local: text(main.venue), estado: text(main.billing_status || main.status),
      cliente: text(main.cliente_nome), servico: text(main.servico_comercial),
    };
    return { success: true, data: {
      resumo, tipo, id, ficha: {...EMPTY_PROFILE,...(meta.rows[0] || {})} as CRMProfile,
      relations: found.relations, interacoes: iRes.rows as unknown as CRMInteraction[],
      tarefas: tRes.rows as unknown as CRMTask[],
      equipa: artists.rows.map((r:any)=>({nome:String(r.nome||""),funcao:String(r.tipo||"")})),
      marketing: tipo === "evento" ? {
        solicitado: Number(main.marketing_solicitado || 0) === 1,
        estado: String(main.marketing_envio_estado || "nao_solicitado"),
        enviado_em: String(main.marketing_enviado_em || ""),
      } : null,
    }};
  } catch (e) {
    console.error("CRM ficha:",e);
    return {success:false,message:"Não foi possível carregar a ficha CRM."};
  }
}

export async function saveCRMProfile(tipo:string,id:number,values:CRMProfile,autor:string) {
  if (!valid(tipo,id)) return {success:false,message:"Registo inválido."};
  try {
    await ensureCRMTables();
    if (!await exists(tipo,id,autor)) return {success:false,message:"Registo não encontrado."};
    const p:CRMProfile = {
      origem:text(values.origem,100), origem_detalhe:text(values.origem_detalhe,300), canal:text(values.canal,100), primeiro_contacto:isoDate(values.primeiro_contacto),
      contactado_por:text(values.contactado_por,120), responsavel:text(values.responsavel,120),
      resumo:text(values.resumo,6000), etiquetas:text(values.etiquetas,400),
    };
    const old = await db.execute({sql:"SELECT * FROM crm_fichas WHERE tipo=? AND registo_id=?",args:[tipo,id]});
    const previous = (old.rows[0] || {}) as Record<string,unknown>;
    const changed = Object.keys(p).filter(k => String(previous[k] || "") !== p[k as keyof CRMProfile]);
    if (!changed.length) return {success:true};
    await db.execute({
      sql:`INSERT INTO crm_fichas(tipo,registo_id,origem,origem_detalhe,canal,primeiro_contacto,contactado_por,responsavel,resumo,etiquetas,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(tipo,registo_id) DO UPDATE SET origem=excluded.origem,origem_detalhe=excluded.origem_detalhe,canal=excluded.canal,
        primeiro_contacto=excluded.primeiro_contacto,contactado_por=excluded.contactado_por,
        responsavel=excluded.responsavel,resumo=excluded.resumo,etiquetas=excluded.etiquetas,updated_at=datetime('now')`,
      args:[tipo,id,p.origem,p.origem_detalhe,p.canal,p.primeiro_contacto,p.contactado_por,p.responsavel,p.resumo,p.etiquetas],
    });
    await db.execute({
      sql:"INSERT INTO crm_interacoes(tipo,registo_id,natureza,descricao,interlocutor,autor,aconteceu_em) VALUES (?,?,?,?,?,?,datetime('now'))",
      args:[tipo,id,"Atualização CRM",`Campos atualizados: ${changed.join(', ')}`,"",text(autor,80)||"Utilizador"],
    });
    return {success:true};
  } catch(e) {console.error("CRM guardar ficha",e);return {success:false,message:"Não foi possível guardar a ficha."};}
}

export async function addCRMInteraction(tipo:string,id:number,entry:{natureza:string;descricao:string;interlocutor:string;aconteceu_em:string},autor:string) {
  if (!valid(tipo,id)) return {success:false,message:"Registo inválido."};
  const descricao=text(entry.descricao,6000);
  if (!descricao) return {success:false,message:"Descreve o contacto."};
  try {
    await ensureCRMTables();
    if (!await exists(tipo,id,autor)) return {success:false,message:"Registo não encontrado."};
    await db.execute({
      sql:"INSERT INTO crm_interacoes(tipo,registo_id,natureza,descricao,interlocutor,autor,aconteceu_em) VALUES (?,?,?,?,?,?,?)",
      args:[tipo,id,text(entry.natureza,50)||"Nota",descricao,text(entry.interlocutor,150),text(autor,80)||"Utilizador",isoDateTime(entry.aconteceu_em)||new Date().toISOString().slice(0,19).replace("T"," ")],
    });
    return {success:true};
  } catch(e){console.error("CRM registar contacto",e);return {success:false,message:"Não foi possível guardar o contacto."};}
}

export async function addCRMTask(tipo:string,id:number,task:{titulo:string;responsavel:string;vence_em:string},autor:string) {
  if(!valid(tipo,id)) return {success:false,message:"Registo inválido."};
  const titulo=text(task.titulo,500);
  if(!titulo) return {success:false,message:"Indica a tarefa."};
  try {
    await ensureCRMTables();
    if (!await exists(tipo,id,autor)) return {success:false,message:"Registo não encontrado."};
    await db.execute({sql:"INSERT INTO crm_tarefas(tipo,registo_id,titulo,responsavel,vence_em,autor) VALUES (?,?,?,?,?,?)",
      args:[tipo,id,titulo,text(task.responsavel,120),isoDate(task.vence_em),text(autor,80)||"Utilizador"]});
    return {success:true};
  } catch(e){console.error("CRM criar tarefa",e);return {success:false,message:"Não foi possível criar a tarefa."};}
}

export async function setCRMTaskComplete(taskId:number,done:boolean,autor:string) {
  if(!Number.isSafeInteger(taskId)||taskId<1) return {success:false};
  try {
    await ensureCRMTables();
    const row=await db.execute({sql:"SELECT * FROM crm_tarefas WHERE id=?",args:[taskId]});
    if(!row.rows.length) return {success:false};
    const t=row.rows[0] as Record<string,any>;
    if (!valid(String(t.tipo),Number(t.registo_id)) || !await exists(t.tipo as CRMType,Number(t.registo_id),autor)) return {success:false};
    await db.execute({sql:"UPDATE crm_tarefas SET estado=?,concluida_em=? WHERE id=?",
      args:[done?"Concluída":"Pendente",done?new Date().toISOString().slice(0,19).replace("T"," "):"",taskId]});
    await db.execute({sql:"INSERT INTO crm_interacoes(tipo,registo_id,natureza,descricao,interlocutor,autor,aconteceu_em) VALUES (?,?,?,?,?,?,datetime('now'))",
      args:[t.tipo,t.registo_id,"Tarefa",`${done?"Concluída":"Reaberta"}: ${t.titulo}`,"",text(autor,80)||"Utilizador"]});
    return {success:true};
  } catch(e){console.error("CRM estado tarefa",e);return {success:false};}
}

// Fila global de follow-ups para os responsáveis comerciais e de marketing.
export async function getCRMTasksOverview(usuario: string = "") {
  noStore();
  try {
    await ensureCRMTables();
    const r=await db.execute({sql:`SELECT t.*,
      CASE t.tipo
        WHEN 'lead' THEN (SELECT title FROM leads WHERE id=t.registo_id)
        WHEN 'evento' THEN (SELECT event_name FROM agenda WHERE id=t.registo_id)
        WHEN 'cliente' THEN (SELECT COALESCE(NULLIF(alias,''),nome) FROM clientes WHERE id=t.registo_id)
        ELSE '' END AS titulo_registo
      FROM crm_tarefas t
      WHERE (? <> 'Larissa' OR t.tipo <> 'evento' OR EXISTS (
        SELECT 1 FROM agenda a WHERE a.id=t.registo_id AND a.visibility='Public'
      ))
      ORDER BY CASE t.estado WHEN 'Pendente' THEN 0 ELSE 1 END,
        CASE WHEN t.vence_em='' THEN '9999-12-31' ELSE t.vence_em END ASC, t.id DESC
      LIMIT 600`, args:[usuario]});
    return {success:true,data:r.rows.map((row:any)=>({
      id:Number(row.id),tipo:row.tipo as CRMType,registo_id:Number(row.registo_id),
      titulo:String(row.titulo),responsavel:String(row.responsavel||""),vence_em:String(row.vence_em||""),
      estado:String(row.estado||"Pendente"),autor:String(row.autor||""),titulo_registo:String(row.titulo_registo||"Registo indisponível"),
    }))};
  }catch(e){console.error("CRM tarefas",e);return {success:false,data:[]};}
}
