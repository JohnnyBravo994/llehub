"use server";

import { createClient } from "@libsql/client";
import { ARTIST_TIPOS, SERVICOS_VENDIDOS } from "./constants";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const DEFAULT_FUNCOES_VALORES = [...ARTIST_TIPOS];

async function ensureColaboradoresExtendedColumns() {
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN nome_artistico TEXT DEFAULT ''"); } catch { }
  try { await turso.execute("ALTER TABLE colaboradores ADD COLUMN nome_pessoal TEXT DEFAULT ''"); } catch { }
  try {
    await turso.execute("UPDATE colaboradores SET nome_artistico = nome WHERE COALESCE(nome_artistico, '') = ''");
  } catch { }
}

async function ensureArtistasAssociacaoIgnoradosTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS artistas_associacao_ignorados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_key TEXT NOT NULL UNIQUE,
      nome_original TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

async function ensureValoresFuncoesTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS valores_funcoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcao TEXT NOT NULL UNIQUE,
      custo_padrao REAL NOT NULL DEFAULT 0,
      valor_cliente_padrao REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  for (const funcao of DEFAULT_FUNCOES_VALORES) {
    try {
      await turso.execute({
        sql: "INSERT OR IGNORE INTO valores_funcoes (funcao, custo_padrao, valor_cliente_padrao, notas, ativo) VALUES (?, 0, 0, '', 1)",
        args: [funcao],
      });
    } catch { }
  }
}


async function ensureValoresMasterTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS valores_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      servico TEXT NOT NULL,
      duracao_formato TEXT DEFAULT '',
      contexto TEXT DEFAULT 'Normal',
      cliente_nome TEXT DEFAULT '',
      custo_interno REAL NOT NULL DEFAULT 0,
      valor_parceiro REAL NOT NULL DEFAULT 0,
      valor_cliente_final REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  const cols = [
    "servico TEXT NOT NULL DEFAULT ''",
    "duracao_formato TEXT DEFAULT ''",
    "contexto TEXT DEFAULT 'Normal'",
    "cliente_nome TEXT DEFAULT ''",
    "custo_interno REAL NOT NULL DEFAULT 0",
    "valor_parceiro REAL NOT NULL DEFAULT 0",
    "valor_cliente_final REAL NOT NULL DEFAULT 0",
    "notas TEXT DEFAULT ''",
    "ativo INTEGER DEFAULT 1",
  ];
  for (const col of cols) {
    try { await turso.execute(`ALTER TABLE valores_master ADD COLUMN ${col}`); } catch { }
  }

  // Pré-carrega os serviços comerciais que a LLE vende. Não sobrescreve valores existentes.
  for (const servico of SERVICOS_VENDIDOS) {
    const exists = await turso.execute({
      sql: "SELECT id FROM valores_master WHERE LOWER(TRIM(servico)) = LOWER(TRIM(?)) LIMIT 1",
      args: [servico],
    });
    if (exists.rows.length === 0) {
      await turso.execute({
        sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_cliente_final, notas, ativo) VALUES (?, '', 'Normal', '', 0, 0, 0, 'Serviço base LLE — preencher valores', 1)",
        args: [servico],
      });
    }
  }
}

async function ensureResidenciasAtivasTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS residencias_ativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cliente_id INTEGER,
      cliente_nome TEXT DEFAULT '',
      local TEXT DEFAULT '',
      servico TEXT DEFAULT 'DJ',
      duracao_formato TEXT DEFAULT '',
      custo_interno REAL NOT NULL DEFAULT 0,
      valor_cliente REAL NOT NULL DEFAULT 0,
      performer_padrao_id INTEGER,
      performer_padrao_nome TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  const cols = [
    "nome TEXT NOT NULL DEFAULT ''",
    "cliente_id INTEGER",
    "cliente_nome TEXT DEFAULT ''",
    "local TEXT DEFAULT ''",
    "servico TEXT DEFAULT 'DJ'",
    "duracao_formato TEXT DEFAULT ''",
    "custo_interno REAL NOT NULL DEFAULT 0",
    "valor_cliente REAL NOT NULL DEFAULT 0",
    "performer_padrao_id INTEGER",
    "performer_padrao_nome TEXT DEFAULT ''",
    "notas TEXT DEFAULT ''",
    "ativo INTEGER DEFAULT 1",
  ];
  for (const col of cols) {
    try { await turso.execute(`ALTER TABLE residencias_ativas ADD COLUMN ${col}`); } catch { }
  }
}

async function ensureCommercialColumns() {
  try { await turso.execute("ALTER TABLE agenda ADD COLUMN residencia_id INTEGER"); } catch { }
  try { await turso.execute("ALTER TABLE leads ADD COLUMN residencia_id INTEGER"); } catch { }
}

function extractField(details: string, field: string): string {
  if (!details) return '';
  const regex = new RegExp(`${field}:\\s*([^|]+)`);
  const match = details.match(regex);
  return match ? match[1].trim() : '';
}

// UUID v4 simples (não requer lib externa)
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── SYNC CENTRAL por event_id ─────────────────────────────────────────────────
// Propaga campos partilhados para todos os registos com o mesmo event_id.
// Não sobrescreve event_id nem id; só os campos de conteúdo.
async function propagateByEventId(event_id: string, fields: {
  title?: string; event_date?: string; value?: number; status?: string;
  cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  local?: string; contacto?: string; notas?: string;
  valor_recebido?: number;
}) {
  if (!event_id) return;
  const f = fields;
  // Agenda: actualizar todos os campos presentes
  const agendaUpdates: string[] = [];
  const agendaArgs: (string | number | null)[] = [];
  if (f.title !== undefined)         { agendaUpdates.push('event_name=?');    agendaArgs.push(f.title); }
  if (f.event_date !== undefined)    { agendaUpdates.push('event_date=?');    agendaArgs.push(f.event_date); }
  if (f.value !== undefined)         { agendaUpdates.push('client_cachet=?'); agendaArgs.push(f.value); }
  if (f.status !== undefined)        { agendaUpdates.push('billing_status=?');agendaArgs.push(f.status); }
  if (f.cliente_id !== undefined)    { agendaUpdates.push('cliente_id=?');    agendaArgs.push(f.cliente_id ?? null); }
  if (f.cliente_nome !== undefined)  { agendaUpdates.push('cliente_nome=?');  agendaArgs.push(f.cliente_nome); }
  if (f.modalidade !== undefined)    { agendaUpdates.push('modalidade=?');    agendaArgs.push(f.modalidade); }
  if (f.local !== undefined)         { agendaUpdates.push('venue=?');         agendaArgs.push(f.local); }
  if (f.contacto !== undefined)      { agendaUpdates.push('contacto=?');      agendaArgs.push(f.contacto); }
  if (f.notas !== undefined)         { agendaUpdates.push('notas=?');         agendaArgs.push(f.notas); }
  if (f.valor_recebido !== undefined){ agendaUpdates.push('valor_recebido=?');agendaArgs.push(f.valor_recebido); }
  if (agendaUpdates.length > 0) {
    agendaArgs.push(event_id);
    await turso.execute({ sql: `UPDATE agenda SET ${agendaUpdates.join(',')} WHERE event_id=?`, args: agendaArgs });
  }

  // Leads: mesmos campos (com mapeamento de nomes de colunas diferentes)
  const leadsUpdates: string[] = [];
  const leadsArgs: (string | number | null)[] = [];
  if (f.title !== undefined)         { leadsUpdates.push('title=?');         leadsArgs.push(f.title); }
  if (f.event_date !== undefined)    { leadsUpdates.push('event_date=?');    leadsArgs.push(f.event_date); }
  if (f.value !== undefined)         { leadsUpdates.push('value=?');         leadsArgs.push(f.value); }
  if (f.status !== undefined)        { leadsUpdates.push('status=?');        leadsArgs.push(f.status); }
  if (f.cliente_id !== undefined)    { leadsUpdates.push('cliente_id=?');    leadsArgs.push(f.cliente_id ?? null); }
  if (f.cliente_nome !== undefined)  { leadsUpdates.push('client_name=?');   leadsArgs.push(f.cliente_nome); }
  if (f.modalidade !== undefined)    { leadsUpdates.push('modalidade=?');    leadsArgs.push(f.modalidade); }
  if (f.local !== undefined)         { leadsUpdates.push('local=?');         leadsArgs.push(f.local); }
  if (f.contacto !== undefined)      { leadsUpdates.push('contacto=?');      leadsArgs.push(f.contacto); }
  if (f.notas !== undefined)         { leadsUpdates.push('notas=?');         leadsArgs.push(f.notas); }
  if (f.valor_recebido !== undefined){ leadsUpdates.push('valor_recebido=?');leadsArgs.push(f.valor_recebido); }
  if (leadsUpdates.length > 0) {
    leadsArgs.push(event_id);
    await turso.execute({ sql: `UPDATE leads SET ${leadsUpdates.join(',')} WHERE event_id=?`, args: leadsArgs });
  }
}

function getEventIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('folga')) return '⛱️';
  if (t.includes('epic sana')) return '🎹🎤🎷';
  if (t.includes('terrazza') || t.includes('tribute') || t.includes('hyatt') || t.includes('art stay') || t.includes('erva') || t.includes('evolution')) return '🎤';
  if (t.includes('curso')) return '🪬';
  if (t.includes('roupa')) return '🥻';
  if (t.includes('sud hall')) return '🟢';
  return '🔵';
}


export async function setupDatabase() {
  try {
    await turso.executeMultiple(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nif TEXT,
        email TEXT,
        telefone TEXT,
        notas TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS artistas_evento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evento_id INTEGER NOT NULL,
        evento_nome TEXT NOT NULL,
        evento_data TEXT NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'DJ',
        fee REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS colaboradores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_artistico TEXT DEFAULT '',
        nome_pessoal TEXT DEFAULT '',
        contacto TEXT DEFAULT '',
        email TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS valores_funcoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        funcao TEXT NOT NULL UNIQUE,
        custo_padrao REAL NOT NULL DEFAULT 0,
        valor_cliente_padrao REAL NOT NULL DEFAULT 0,
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS artist_conflict_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_date TEXT NOT NULL,
        artist_key TEXT NOT NULL,
        artist_name TEXT DEFAULT '',
        note TEXT DEFAULT '',
        dismissed_by TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    try { await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_conflict_overrides_key ON artist_conflict_overrides(event_date, artist_key)"); } catch { }
    await ensureColaboradoresExtendedColumns();
    await ensureValoresFuncoesTable();
    await ensureValoresMasterTable();
    await ensureResidenciasAtivasTable();
    await ensureCommercialColumns();

    const agendaCols = [
      "billing_status TEXT DEFAULT 'Contacto'",
      "cliente_id INTEGER",
      "cliente_nome TEXT DEFAULT ''",
      "modalidade TEXT DEFAULT 'Fatura'",
      "valor_recebido REAL DEFAULT 0",
      "origem_lead_id INTEGER",
      "venue TEXT DEFAULT ''",
      "contacto TEXT DEFAULT ''",
      "notas TEXT DEFAULT ''",
    ];
    for (const col of agendaCols) {
      try { await turso.execute(`ALTER TABLE agenda ADD COLUMN ${col}`); } catch { }
    }

    // Garantir tabela leads com todas as colunas necessárias
    try {
      await turso.execute(`CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        event_date TEXT DEFAULT '',
        value REAL DEFAULT 0,
        status TEXT DEFAULT 'Contacto',
        client_name TEXT DEFAULT '',
        local TEXT DEFAULT '',
        contacto TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        cliente_id INTEGER,
        modalidade TEXT DEFAULT 'Fatura',
        valor_recebido REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
    } catch { }
    const leadsCols = [
      "title TEXT NOT NULL DEFAULT ''",
      "event_date TEXT DEFAULT ''",
      "value REAL DEFAULT 0",
      "status TEXT DEFAULT 'Contacto'",
      "client_name TEXT DEFAULT ''",
      "local TEXT DEFAULT ''",
      "contacto TEXT DEFAULT ''",
      "notas TEXT DEFAULT ''",
      "cliente_id INTEGER",
      "modalidade TEXT DEFAULT 'Fatura'",
      "valor_recebido REAL DEFAULT 0",
      "residencia_id INTEGER",
    ];
    for (const col of leadsCols) {
      try { await turso.execute(`ALTER TABLE leads ADD COLUMN ${col}`); } catch { }
    }

    // ── event_id: adicionar colunas e popular pares existentes ───────────────
    try { await turso.execute("ALTER TABLE agenda ADD COLUMN event_id TEXT DEFAULT ''"); } catch { }
    try { await turso.execute("ALTER TABLE leads  ADD COLUMN event_id TEXT DEFAULT ''"); } catch { }

    // Popular event_id para pares já ligados (origem_lead_id FK)
    // Para cada par agenda↔lead sem event_id, gerar um UUID partilhado
    const unlinkedPairs = await turso.execute(`
      SELECT a.id as agenda_id, a.origem_lead_id as lead_id
      FROM agenda a
      WHERE a.origem_lead_id IS NOT NULL
        AND (a.event_id IS NULL OR a.event_id = '')
    `);
    for (const row of unlinkedPairs.rows as any[]) {
      const eid = uuidv4();
      await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eid, row.agenda_id] });
      await turso.execute({ sql: "UPDATE leads  SET event_id=? WHERE id=?", args: [eid, row.lead_id] });
    }

    // Registos de agenda sem par e sem event_id → gerar event_id individual
    await turso.execute(`
      UPDATE agenda SET event_id = (
        lower(hex(randomblob(4))) || '-' ||
        lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        lower(hex(randomblob(6)))
      )
      WHERE event_id IS NULL OR event_id = ''
    `);
    // Registos de leads sem par e sem event_id → gerar event_id individual
    await turso.execute(`
      UPDATE leads SET event_id = (
        lower(hex(randomblob(4))) || '-' ||
        lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        lower(hex(randomblob(6)))
      )
      WHERE event_id IS NULL OR event_id = ''
    `);

    return { success: true };
  } catch (error) {
    console.error("Erro setup DB:", error);
    return { success: false };
  }
}

export async function loginUser(name: string) {
  try {
    const result = await turso.execute({ sql: "SELECT * FROM team WHERE name = ?", args: [name] });
    if (result.rows.length > 0) return { success: true, user: { ...result.rows[0] } };
    return { success: false, message: "Membro da equipa não encontrado." };
  } catch (error) {
    console.error("Erro auth:", error);
    return { success: false, message: "Erro de ligação ao sistema LLE." };
  }
}

import { unstable_noStore as noStore } from "next/cache";
// ^^^ adicionado para forçar sem cache
export async function getDashboardData(userName: string = 'Admin', clientTodayStr?: string) {
  noStore();
  try {
    // Recua 1 dia no servidor para agenda (garante eventos do dia actual)
    const serverDate = new Date();
    serverDate.setDate(serverDate.getDate() - 1);
    const todayStr = serverDate.toISOString().split("T")[0];

    // Para leads, usa a data local do browser (passada pelo cliente) ou hoje no servidor
    // Filtra directamente no SQL: data >= hoje E não Cancelado
    const leadsFromDate = clientTodayStr || new Date().toISOString().split("T")[0];
    const leadsRes = await turso.execute({
      sql: "SELECT * FROM leads WHERE event_date >= ? AND status != 'Cancelado' ORDER BY event_date ASC",
      args: [leadsFromDate]
    });

    let agendaSql = "SELECT * FROM agenda WHERE status != 'Cancelado' AND event_date >= ? ORDER BY event_date ASC LIMIT 200";
    // Tania e Soraya vêem o calendário completo (igual ao João/Admin)
    // Larissa mantém restrição anterior (só Public)
    if (userName === 'Larissa') agendaSql = "SELECT * FROM agenda WHERE status != 'Cancelado' AND event_date >= ? AND visibility = 'Public' ORDER BY event_date ASC LIMIT 200";

    const agendaAllRes = await turso.execute({ sql: agendaSql, args: [todayStr] });

    // Buscar todos os artistas (nome + tipo) para os eventos do período
    const artistasRes = await turso.execute({
      sql: "SELECT evento_id, nome, tipo FROM artistas_evento ORDER BY evento_id ASC, id ASC",
    });
    const artistasByEvento: Record<number, { nome: string; tipo: string }[]> = {};
    for (const r of artistasRes.rows) {
      const eid = Number(r.evento_id);
      if (!artistasByEvento[eid]) artistasByEvento[eid] = [];
      if (r.nome) artistasByEvento[eid].push({ nome: r.nome as string, tipo: (r.tipo as string) || 'DJ' });
    }

    // Normaliza qualquer formato de data para YYYY-MM-DD
    function normDate(raw: string): string {
      if (!raw) return '';
      const s = raw.trim();
      // DD/MM/YYYY → YYYY-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split('/');
        return `${y}-${m}-${d}`;
      }
      // DD-MM-YYYY → YYYY-MM-DD
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const parts = s.split('-');
        if (parseInt(parts[0]) <= 31 && parseInt(parts[1]) <= 12) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      return s;
    }

    return {
      success: true,
      leads: leadsRes.rows.map((r: any) => ({
        ...r,
        title: r.title || r.project_name || r.event_name || '(sem título)',
        local: r.details ? extractField(r.details, 'Local') : (r.local || ''),
        contacto: r.details ? extractField(r.details, 'Contacto') : (r.contacto || ''),
        notas: r.details ? extractField(r.details, 'Notas') : (r.notas || ''),
        status_icon: r.status_icon || '🔵', value: r.value || 0,
        status: r.status || 'Contacto', // explícito para filtros no frontend
        event_date: normDate(r.event_date || ''),
        _raw_date: r.event_date || '',
      })),
      agendaAll: agendaAllRes.rows.map((r: any) => {
        // Título limpo — sem emoji artificial prefixado
        const eventTitle = (r.event_name as string) || '(sem título)';
        const cleanTitle = eventTitle.replace(/^\p{Emoji}[\p{Emoji}\u200d\s]*/u, '').trim();
        const artistas = artistasByEvento[Number(r.id)] || [];
        return { ...r, title: cleanTitle, hours: r.location || '', location: r.venue || '', staff: r.staff_needed || '', bill: r.client_cachet || 0, artists: r.artists || '', artistas };
      }),
    };
  } catch (error) {
    console.error("Erro Dashboard:", error);
    return { success: false, message: "Erro a carregar dados.", leads: [], agendaAll: [] };
  }
}

export async function getAllAgenda(userName: string = 'Admin') {
  noStore();
  try {
    let sqlQuery = "SELECT * FROM agenda ORDER BY event_date ASC, id ASC";
    // Larissa mantém restrição anterior (só Public); Soraya e Tânia vêem tudo
    if (userName === 'Larissa') sqlQuery = "SELECT * FROM agenda WHERE visibility = 'Public' ORDER BY event_date ASC, id ASC";

    const res = await turso.execute(sqlQuery);
    return {
      success: true,
      data: res.rows.map((r: any) => {
        const eventTitle = r.event_name as string;
        // Guardar título limpo sem emoji automático
        const finalTitle = eventTitle;
        return {
          ...r, id: r.id, title: finalTitle, time_range: r.location || '', venue: r.venue || '',
          tipo: r.staff_needed || '', bill: r.client_cachet || 0,
          cancelled: r.status === 'Cancelado' ? 1 : 0,
          billing_status: r.billing_status || '', cliente_id: r.cliente_id || null,
          cliente_nome: r.cliente_nome || '', modalidade: r.modalidade || 'Fatura',
          origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
          contacto: r.contacto || '', notas: r.notas || '',
          event_id: (r.event_id as string) || '',
          residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
        };
      }),
    };
  } catch (error) {
    console.error("Erro agenda:", error);
    return { success: false, data: [] };
  }
}

export async function createAgendaEvent(data: {
  title: string; date: string; time: string; tipo: string; bill: number;
  billing_status?: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  origem_lead_id?: number | null; venue?: string; contacto?: string; notas?: string; residencia_id?: number | null;
}) {
  try {
    // Se há origem_lead_id, partilhar o event_id da lead; caso contrário gerar novo
    let eventId = uuidv4();
    if (data.origem_lead_id) {
      const leadRow = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [data.origem_lead_id] });
      const existingEid = (leadRow.rows[0] as any)?.event_id;
      if (existingEid) eventId = existingEid;
    }

    await turso.execute({
      sql: "INSERT INTO agenda (event_name, event_date, location, staff_needed, client_cachet, status, visibility, billing_status, cliente_id, cliente_nome, modalidade, origem_lead_id, venue, contacto, notas, event_id, residencia_id) VALUES (?, ?, ?, ?, ?, 'Confirmado', 'Public', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.title, data.date, data.time, data.tipo, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.origem_lead_id ?? null, data.venue || '', data.contacto || '', data.notas || '', eventId, data.residencia_id ?? null],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    const newId = Number(last.rows[0].id);

    // Garantir que a lead também tem este event_id
    if (data.origem_lead_id) {
      await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, data.origem_lead_id] });
      // Migrar artistas da lead (guardados com evento_id negativo) para este evento
      await ensureArtistasColaboradorIdColumn();
      const leadArtistas = await turso.execute({
        sql: "SELECT nome, tipo, fee, colaborador_id FROM artistas_evento WHERE evento_id=?",
        args: [-data.origem_lead_id],
      });
      for (const a of leadArtistas.rows as any[]) {
        await turso.execute({
          sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [newId, data.title, data.date, a.colaborador_id ?? null, a.nome, a.tipo, a.fee],
        });
      }
    }
    return { success: true, id: newId };
  } catch (error) {
    console.error("Erro criar evento:", error);
    return { success: false, message: "Erro ao criar evento.", id: null };
  }
}

export async function updateAgendaEvent(
  id: number,
  data: { title: string; date: string; time: string; tipo: string; bill: number; billing_status?: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string; venue?: string; contacto?: string; notas?: string; residencia_id?: number | null; }
) {
  try {
    await turso.execute({
      sql: "UPDATE agenda SET event_name=?, event_date=?, location=?, staff_needed=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, venue=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
      args: [data.title, data.date, data.time, data.tipo, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.venue || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, id],
    });

    // Obter event_id e origem_lead_id actuais
    const evRow = await turso.execute({ sql: "SELECT event_id, origem_lead_id, event_name, event_date FROM agenda WHERE id=?", args: [id] });
    const evData = evRow.rows[0] as any;
    let leadId = evData?.origem_lead_id ? Number(evData.origem_lead_id) : null;
    let eventId: string = evData?.event_id || '';

    // Auto-link: se ainda não tem FK, tentar encontrar lead com mesmo título+data
    if (!leadId) {
      const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      const match = await turso.execute({
        sql: "SELECT id, event_id FROM leads WHERE event_date=? AND LOWER(TRIM(title))=? AND status != 'Cancelado' LIMIT 1",
        args: [data.date, normTitle(data.title)],
      });
      if (match.rows.length > 0) {
        const matchRow = match.rows[0] as any;
        leadId = Number(matchRow.id);
        await turso.execute({ sql: "UPDATE agenda SET origem_lead_id=? WHERE id=?", args: [leadId, id] });
        // Partilhar event_id: usar o da lead se existir, senão usar o da agenda
        const leadEid = matchRow.event_id || '';
        if (leadEid && !eventId) {
          eventId = leadEid;
          await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, id] });
        } else if (eventId && !leadEid) {
          await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, leadId] });
        }
      }
    }

    // Se não tem event_id ainda, gerar um
    if (!eventId) {
      eventId = uuidv4();
      await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, id] });
    }

    // Propagar todos os campos para todos os registos com o mesmo event_id
    await propagateByEventId(eventId, {
      title: data.title, event_date: data.date, value: data.bill,
      status: data.billing_status || 'Contacto',
      cliente_id: data.cliente_id ?? null, cliente_nome: data.cliente_nome || '',
      modalidade: data.modalidade || 'Fatura',
      local: data.venue || '', contacto: data.contacto || '', notas: data.notas || '',
    });

    // Fallback: se há leadId mas a lead ainda não tem event_id (dados antigos), sync directo por id
    if (leadId) {
      const leadCheck = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [leadId] });
      const leadEid = (leadCheck.rows[0] as any)?.event_id || '';
      if (!leadEid || leadEid !== eventId) {
        // Dar o event_id correcto à lead e fazer sync directo
        await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, leadId] });
        await turso.execute({
          sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, local=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
          args: [data.title, data.date, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.venue || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, leadId],
        });
      }
    }

    return { success: true, leadId };
  } catch (error) {
    console.error("Erro editar evento:", error);
    return { success: false, message: "Erro ao editar evento.", leadId: null };
  }
}

export async function cancelAgendaEvent(id: number): Promise<{ success: boolean; message?: string }> {
  try {
    await turso.execute({ sql: "UPDATE agenda SET status='Cancelado', billing_status='Cancelado' WHERE id=?", args: [id] });
    // Propagar cancelamento para a lead ligada via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE leads SET status='Cancelado' WHERE event_id=?", args: [eid] });
    return { success: true };
  } catch (error) {
    console.error("Erro ao cancelar evento:", error);
    let msg = "Erro desconhecido.";
    if (error instanceof Error) msg = error.message;
    else if (typeof error === "string") msg = error;
    else { try { msg = JSON.stringify(error); } catch { msg = String(error); } }
    return { success: false, message: msg };
  }
}

export async function restoreAgendaEvent(id: number): Promise<{ success: boolean; message?: string }> {
  try {
    await turso.execute({ sql: "UPDATE agenda SET status='Confirmado', billing_status='Confirmado' WHERE id=?", args: [id] });
    // Propagar restauro para a lead ligada via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE leads SET status='Contacto' WHERE event_id=? AND status='Cancelado'", args: [eid] });
    return { success: true };
  } catch (error) {
    console.error("Erro ao repor evento:", error);
    return { success: false, message: error instanceof Error ? error.message : "Erro ao repor evento." };
  }
}

export async function deleteAgendaEvent(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM agenda WHERE id=?", args: [id] });
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── ARTISTAS POR EVENTO ───────────────────────────────────────────────────────

type ArtistaPayload = { nome: string; tipo: string; fee: number; colaborador_id?: number | null };

async function ensureArtistasColaboradorIdColumn() {
  try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }
}

export async function getAllArtistasAgenda(): Promise<{ success: boolean; data: Record<number, { id: number; nome: string; tipo: string; fee: number; colaborador_id: number | null }[]> }> {
  try {
    await ensureArtistasColaboradorIdColumn();
    const res = await turso.execute("SELECT id, evento_id, nome, tipo, fee, colaborador_id FROM artistas_evento ORDER BY evento_id ASC, id ASC");
    const map: Record<number, { id: number; nome: string; tipo: string; fee: number; colaborador_id: number | null }[]> = {};
    for (const r of res.rows as any[]) {
      const eid = Number(r.evento_id);
      if (!map[eid]) map[eid] = [];
      map[eid].push({ id: Number(r.id), nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee), colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id) });
    }
    return { success: true, data: map };
  } catch (error) {
    console.error("Erro getAllArtistasAgenda:", error);
    return { success: false, data: {} };
  }
}

// Sync artistas de um evento de agenda para o lado da lead (evento_id negativo)
export async function syncArtistasParaLead(leadId: number, eventoNome: string, eventoData: string, artistas: ArtistaPayload[]) {
  try {
    await ensureArtistasColaboradorIdColumn();
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [-leadId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [-leadId, eventoNome, eventoData, a.colaborador_id ?? null, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas lead:", error);
    return { success: false };
  }
}

export async function getArtistasEvento(eventoId: number) {
  try {
    await ensureArtistasColaboradorIdColumn();
    const res = await turso.execute({
      sql: "SELECT * FROM artistas_evento WHERE evento_id=? ORDER BY id ASC",
      args: [eventoId],
    });
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id), evento_id: Number(r.evento_id),
        evento_nome: r.evento_nome as string, evento_data: r.evento_data as string,
        colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id),
        nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee),
      }))
    };
  } catch (error) {
    console.error("Erro artistas evento:", error);
    return { success: false, data: [] };
  }
}

export async function syncArtistasEvento(eventoId: number, eventoNome: string, eventoData: string, artistas: ArtistaPayload[]) {
  try {
    await ensureArtistasColaboradorIdColumn();
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [eventoId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [eventoId, eventoNome, eventoData, a.colaborador_id ?? null, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas:", error);
    return { success: false };
  }
}

// Sync artistas de uma lead para o evento de agenda ligado (por origem_lead_id)
export async function syncArtistasParaAgenda(leadId: number, eventoNome: string, eventoData: string, artistas: ArtistaPayload[]) {
  try {
    await ensureArtistasColaboradorIdColumn();
    const linked = await turso.execute({
      sql: "SELECT id FROM agenda WHERE origem_lead_id=?",
      args: [leadId],
    });
    if (!linked.rows.length) return { success: true }; // sem evento ligado, nada a fazer
    const agendaEventId = Number((linked.rows[0] as any).id);
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [agendaEventId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, colaborador_id, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [agendaEventId, eventoNome, eventoData, a.colaborador_id ?? null, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas agenda:", error);
    return { success: false };
  }
}



export async function getAllPagamentos() {
  try {
    const res = await turso.execute(
      "SELECT ae.*, a.status as evento_status, a.client_cachet as evento_cachet FROM artistas_evento ae LEFT JOIN agenda a ON ae.evento_id = a.id ORDER BY ae.evento_data ASC, ae.id ASC"
    );
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id), evento_id: Number(r.evento_id),
        evento_nome: r.evento_nome as string, evento_data: r.evento_data as string,
        colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id),
        nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee),
        evento_status: r.evento_status as string,
        evento_cachet: Number(r.evento_cachet) || 0,
      })),
    };
  } catch (error) {
    console.error("Erro pagamentos:", error);
    return { success: false, data: [] };
  }
}

export async function updatePagamento(id: number, data: { nome: string; tipo: string; fee: number }) {
  try {
    await turso.execute({
      sql: "UPDATE artistas_evento SET nome=?, tipo=?, fee=? WHERE id=?",
      args: [data.nome, data.tipo, data.fee, id],
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function deletePagamento(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function addPagamento(data: { evento_id: number; evento_nome: string; evento_data: string; nome: string; tipo: string; fee: number }) {
  try {
    await turso.execute({
      sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
      args: [data.evento_id, data.evento_nome, data.evento_data, data.nome, data.tipo, data.fee],
    });
    return { success: true };
  } catch { return { success: false }; }
}

// ── LEADS ─────────────────────────────────────────────────────────────────────

export async function getAllLeads() {
  noStore();
  try {
    const res = await turso.execute("SELECT l.*, (SELECT a.id FROM agenda a WHERE a.origem_lead_id = l.id LIMIT 1) as agenda_event_id FROM leads l ORDER BY COALESCE(l.event_date, '9999-99-99') ASC, l.id ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        ...r, id: r.id,
        title: r.title || r.project_name || r.event_name || '(sem título)',
        event_date: r.event_date || '', value: r.value || 0,
        status: r.status || 'Contacto', status_icon: r.status_icon || '',
        local: r.details ? extractField(r.details, 'Local') : (r.local || ''),
        contacto: r.details ? extractField(r.details, 'Contacto') : (r.contacto || ''),
        notas: r.details ? extractField(r.details, 'Notas') : (r.notas || ''),
        cancelled: r.status === 'Cancelado' ? 1 : 0,
        cliente_id: r.cliente_id || null, cliente_nome: (r.client_name as string) || '',
        modalidade: r.modalidade || 'Fatura',
        agenda_event_id: r.agenda_event_id ? Number(r.agenda_event_id) : null,
        event_id: (r.event_id as string) || '',
        residencia_id: r.residencia_id == null ? null : Number(r.residencia_id),
      }))
    };
  } catch (error) {
    console.error("Erro leads:", error);
    return { success: false, data: [] };
  }
}

export async function createLead(data: {
  title: string; event_date: string; value: number; status: string;
  cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  local?: string; contacto?: string; notas?: string; residencia_id?: number | null;
}) {
  try {
    const eventId = uuidv4();
    await turso.execute({
      sql: "INSERT INTO leads (title, event_date, value, status, cliente_id, client_name, modalidade, local, contacto, notas, event_id, residencia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', eventId, data.residencia_id ?? null],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id), event_id: eventId };
  } catch (error) {
    console.error("Erro criar lead:", error);
    return { success: false, message: "Erro ao criar lead." };
  }
}

export async function updateLead(
  id: number,
  data: { title: string; event_date: string; value: number; status: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string; local?: string; contacto?: string; notas?: string; residencia_id?: number | null; }
) {
  try {
    await turso.execute({
      sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, local=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
      args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, id],
    });

    // Garantir que esta lead tem event_id
    const leadRow = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    let eventId: string = (leadRow.rows[0] as any)?.event_id || '';
    if (!eventId) {
      eventId = uuidv4();
      await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, id] });
    }

    // Propagar todos os campos via event_id (inclui agenda ligada)
    await propagateByEventId(eventId, {
      title: data.title, event_date: data.event_date, value: data.value,
      status: data.status, cliente_id: data.cliente_id ?? null,
      cliente_nome: data.cliente_nome || '', modalidade: data.modalidade || 'Fatura',
      local: data.local || '', contacto: data.contacto || '', notas: data.notas || '',
    });

    // Fallback: sync directo para eventos de agenda ligados por origem_lead_id que ainda não têm event_id
    const linkedByFk = await turso.execute({
      sql: "SELECT id, event_id FROM agenda WHERE origem_lead_id=?",
      args: [id],
    });
    for (const row of linkedByFk.rows as any[]) {
      const agEid = (row as any).event_id || '';
      if (!agEid || agEid !== eventId) {
        await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, (row as any).id] });
        await turso.execute({
          sql: "UPDATE agenda SET event_name=?, event_date=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, venue=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
          args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, (row as any).id],
        });
      }
    }

    // Auto-link + sync para eventos antigos sem origem_lead_id (match por data+título)
    const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const unlinked = await turso.execute({
      sql: "SELECT id, event_id FROM agenda WHERE (origem_lead_id IS NULL OR origem_lead_id != ?) AND event_date=? AND LOWER(TRIM(event_name))=?",
      args: [id, data.event_date, normTitle(data.title)],
    });
    for (const row of unlinked.rows as any[]) {
      // Ligar e partilhar event_id
      await turso.execute({
        sql: "UPDATE agenda SET origem_lead_id=?, event_id=?, event_name=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, venue=?, contacto=?, notas=?, residencia_id=? WHERE id=?",
        args: [id, eventId, data.title, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', data.residencia_id ?? null, row.id],
      });
    }

    // Sync artistas: lead (evento_id negativo) → evento de agenda ligado
    const linkedEv = await turso.execute({ sql: "SELECT id FROM agenda WHERE origem_lead_id=?", args: [id] });
    if (linkedEv.rows.length > 0) {
      const agendaEventId = Number((linkedEv.rows[0] as any).id);
      const leadArtistas = await turso.execute({ sql: "SELECT nome, tipo, fee FROM artistas_evento WHERE evento_id=?", args: [-id] });
      if (leadArtistas.rows.length > 0) {
        await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [agendaEventId] });
        for (const a of leadArtistas.rows as any[]) {
          await turso.execute({
            sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
            args: [agendaEventId, data.title, data.event_date, a.nome, a.tipo, a.fee],
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Erro editar lead:", JSON.stringify(error));
    return { success: false, message: String(error) };
  }
}

export async function cancelLead(id: number) {
  try {
    await turso.execute({ sql: "UPDATE leads SET status='Cancelado' WHERE id=?", args: [id] });
    // Propagar cancelamento para evento de agenda ligado via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE agenda SET billing_status='Cancelado', status='Cancelado' WHERE event_id=?", args: [eid] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function restoreLead(id: number) {
  try {
    await turso.execute({ sql: "UPDATE leads SET status='Contacto' WHERE id=?", args: [id] });
    // Propagar restauro para evento de agenda ligado via event_id
    const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    const eid = (row.rows[0] as any)?.event_id;
    if (eid) await turso.execute({ sql: "UPDATE agenda SET status='Confirmado', billing_status='Contacto' WHERE event_id=? AND status='Cancelado'", args: [eid] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function deleteLead(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM leads WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────

export async function getAllClientes() {
  noStore();
  try {
    // Ensure alias column exists
    try { await turso.execute("ALTER TABLE clientes ADD COLUMN alias TEXT DEFAULT ''"); } catch {}
    const res = await turso.execute("SELECT * FROM clientes ORDER BY nome ASC");
    return { success: true, data: res.rows.map((r: any) => ({ ...r })) };
  } catch (error) {
    console.error("Erro clientes:", error);
    return { success: false, data: [] };
  }
}

export async function createCliente(data: { nome: string; nif?: string; email?: string; telefone?: string; notas?: string; alias?: string }) {
  try {
    await turso.execute({
      sql: "INSERT INTO clientes (nome, nif, email, telefone, notas, alias) VALUES (?, ?, ?, ?, ?, ?)",
      args: [data.nome, data.nif || '', data.email || '', data.telefone || '', data.notas || '', data.alias || ''],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar cliente:", error);
    return { success: false, message: "Erro ao criar cliente." };
  }
}

export async function updateCliente(id: number, data: { nome: string; nif?: string; email?: string; telefone?: string; notas?: string; alias?: string }) {
  try {
    await turso.execute({
      sql: "UPDATE clientes SET nome=?, nif=?, email=?, telefone=?, notas=?, alias=? WHERE id=?",
      args: [data.nome, data.nif || '', data.email || '', data.telefone || '', data.notas || '', data.alias || '', id],
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function deleteCliente(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM clientes WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── FATURAÇÃO ─────────────────────────────────────────────────────────────────

export async function getFaturacaoData() {
  try {
    const ESTADOS_FATURACAO = ['Confirmado', 'Em Adjudicação', 'Adjudicado', 'Faturado', 'Pago', 'Cancelado'];
    const placeholders = ESTADOS_FATURACAO.map(() => '?').join(',');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const agendaRes = await turso.execute({
      sql: `SELECT id, event_name, event_date, client_cachet, billing_status, cliente_id, cliente_nome, status, modalidade, COALESCE(valor_recebido, 0) as valor_recebido, origem_lead_id
            FROM agenda
            WHERE billing_status IN (${placeholders})
              AND COALESCE(cliente_nome, '') != ''
              AND (event_date <= ? OR billing_status IN ('Faturado', 'Pago', 'Cancelado'))
            ORDER BY event_date ASC`,
      args: [...ESTADOS_FATURACAO, today],
    });

    const leadsRes = await turso.execute({
      sql: `SELECT id, title, event_date, value, status, cliente_id, client_name, modalidade, COALESCE(valor_recebido, 0) as valor_recebido
            FROM leads
            WHERE status IN (${placeholders})
              AND COALESCE(client_name, '') != ''
              AND (event_date <= ? OR event_date IS NULL OR event_date = '' OR status IN ('Faturado', 'Pago', 'Cancelado'))
            ORDER BY event_date ASC`,
      args: [...ESTADOS_FATURACAO, today],
    });

    const agendaItems = agendaRes.rows.map((r: any) => ({
      id: Number(r.id), origem: 'agenda' as const,
      descricao: r.event_name as string, data: (r.event_date as string) || '',
      valor: Number(r.client_cachet) || 0, billing_status: (r.billing_status as string) || 'Confirmado',
      cliente_id: r.cliente_id ? Number(r.cliente_id) : null, cliente_nome: (r.cliente_nome as string) || '',
      modalidade: (r.modalidade as string) || 'Fatura',
      valor_recebido: Number(r.valor_recebido) || 0,
      origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
    }));

    // Deduplicação Lead → Agenda:
    // Critério primário: origem_lead_id (FK directa — imune a mudanças de título)
    // Critério fallback (leads antigas sem FK): data+título OU data+valor
    function normTitle(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

    const agendaLinkedLeadIds = new Set(agendaItems.filter(i => i.origem_lead_id).map(i => i.origem_lead_id!));
    const agendaTitleKeys = new Set(agendaItems.map(i => `${i.data}||${normTitle(i.descricao)}`));

    // Agenda items com estado terminal (Pago/Faturado) por date+valor — para suprimir leads duplicadas
    const agendaTerminalDateVal = new Set(
      agendaItems
        .filter(i => i.billing_status === 'Pago' || i.billing_status === 'Faturado')
        .filter(i => i.valor > 0)
        .map(i => `${i.data}||${i.valor}`)
    );
    // Todos os agenda date+valor (para dedup geral, independente de estado)
    const agendaAllDateVal = new Set(
      agendaItems
        .filter(i => i.valor > 0)
        .map(i => `${i.data}||${i.valor}`)
    );

    const leadsItems = leadsRes.rows
      .map((r: any) => ({
        id: Number(r.id), origem: 'lead' as const,
        descricao: r.title as string, data: (r.event_date as string) || '',
        valor: Number(r.value) || 0, billing_status: (r.status as string) || 'Confirmado',
        cliente_id: r.cliente_id ? Number(r.cliente_id) : null, cliente_nome: (r.client_name as string) || '',
        modalidade: (r.modalidade as string) || 'Fatura',
        valor_recebido: Number(r.valor_recebido) || 0,
      }))
      .filter(l => {
        // Critério primário: lead já tem evento na agenda com origem_lead_id = l.id
        if (agendaLinkedLeadIds.has(l.id)) return false;
        // Fallback: Excluir lead se já existe evento de Agenda com mesmo título exacto na mesma data
        if (agendaTitleKeys.has(`${l.data}||${normTitle(l.descricao)}`)) return false;
        // Fallback: Excluir lead se já existe evento de Agenda com mesmo date+valor
        if (l.valor > 0 && agendaAllDateVal.has(`${l.data}||${l.valor}`)) return false;
        // Fallback: Excluir lead se evento correspondente na Agenda já está Pago ou Faturado
        if (l.valor > 0 && agendaTerminalDateVal.has(`${l.data}||${l.valor}`)) return false;
        return true;
      });

    const allItems = [...agendaItems, ...leadsItems];

    // Fetch clientes to resolve aliases and normalise grouping keys
    const clientesRes = await turso.execute("SELECT id, nome, alias FROM clientes ORDER BY nome ASC");
    const clientesMap: Record<number, { nome: string; alias: string }> = {};
    for (const c of clientesRes.rows as any[]) {
      clientesMap[Number(c.id)] = { nome: c.nome as string, alias: (c.alias as string) || '' };
    }

    // Group key: prefer cliente_id (immune to typos), fallback to trimmed name
    // Display key: alias if set, otherwise nome
    function groupKey(item: typeof allItems[number]): string {
      if (item.cliente_id) return `id:${item.cliente_id}`;
      return `nome:${item.cliente_nome.trim()}`;
    }
    function displayKey(item: typeof allItems[number]): string {
      if (item.cliente_id && clientesMap[item.cliente_id]) {
        const c = clientesMap[item.cliente_id];
        return c.alias?.trim() || c.nome;
      }
      return item.cliente_nome.trim();
    }

    const grouped: Record<string, typeof allItems> = {};
    const groupedDisplayKey: Record<string, string> = {};
    for (const item of allItems) {
      const key = groupKey(item);
      const display = displayKey(item);
      if (!grouped[key]) { grouped[key] = []; groupedDisplayKey[key] = display; }
      grouped[key].push(item);
    }

    // Re-key by display name for frontend compatibility
    const groupedByDisplay: Record<string, typeof allItems> = {};
    for (const [key, items] of Object.entries(grouped)) {
      const display = groupedDisplayKey[key];
      if (!groupedByDisplay[display]) groupedByDisplay[display] = [];
      groupedByDisplay[display].push(...items);
    }

    return { success: true, grouped: groupedByDisplay };
  } catch (error) {
    console.error("Erro faturação:", error);
    return { success: false, grouped: {} };
  }
}

// Helper: dado um agenda id, devolve o lead_id ligado (por FK ou por auto-link título+data)
async function resolveLinkedLeadId(agendaId: number): Promise<number | null> {
  const row = await turso.execute({ sql: "SELECT origem_lead_id, event_name, event_date FROM agenda WHERE id=?", args: [agendaId] });
  if (!row.rows.length) return null;
  const r = row.rows[0] as any;
  if (r.origem_lead_id) return Number(r.origem_lead_id);
  const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const match = await turso.execute({
    sql: "SELECT id FROM leads WHERE event_date=? AND LOWER(TRIM(title))=? AND status != 'Cancelado' LIMIT 1",
    args: [r.event_date, normTitle(r.event_name || '')],
  });
  if (match.rows.length > 0) {
    const leadId = Number((match.rows[0] as any).id);
    await turso.execute({ sql: "UPDATE agenda SET origem_lead_id=? WHERE id=?", args: [leadId, agendaId] });
    return leadId;
  }
  return null;
}

export async function updateItemBillingStatus(origem: 'agenda' | 'lead', id: number, billing_status: string) {
  try {
    if (origem === 'agenda') {
      await turso.execute({ sql: "UPDATE agenda SET billing_status=? WHERE id=?", args: [billing_status, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid) await propagateByEventId(eid, { status: billing_status });
    } else {
      await turso.execute({ sql: "UPDATE leads SET status=? WHERE id=?", args: [billing_status, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid) await propagateByEventId(eid, { status: billing_status });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro atualizar billing status:", error);
    return { success: false };
  }
}

export async function updateValorRecebido(origem: 'agenda' | 'lead', id: number, valor: number) {
  try {
    if (origem === 'agenda') {
      await turso.execute({ sql: "UPDATE agenda SET valor_recebido=? WHERE id=?", args: [valor, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid) await propagateByEventId(eid, { valor_recebido: valor });
    } else {
      await turso.execute({ sql: "UPDATE leads SET valor_recebido=? WHERE id=?", args: [valor, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid) await propagateByEventId(eid, { valor_recebido: valor });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro atualizar valor recebido:", error);
    return { success: false };
  }
}

// ── COLABORADORES ─────────────────────────────────────────────────────────────

export async function setupColaboradores() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS colaboradores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_artistico TEXT DEFAULT '',
        nome_pessoal TEXT DEFAULT '',
        contacto TEXT DEFAULT '',
        email TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await ensureColaboradoresExtendedColumns();
    // Adicionar coluna colaborador_id a artistas_evento se não existir
    try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }
    return { success: true };
  } catch (error) {
    console.error("Erro setup colaboradores:", error);
    return { success: false };
  }
}

export async function getAllColaboradores() {
  try {
    await ensureColaboradoresExtendedColumns();
    const res = await turso.execute("SELECT * FROM colaboradores ORDER BY COALESCE(NULLIF(nome_artistico, ''), nome) ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: ((r.nome_artistico as string) || (r.nome as string) || '') as string,
        nome_artistico: ((r.nome_artistico as string) || (r.nome as string) || '') as string,
        nome_pessoal: (r.nome_pessoal as string) || '',
        contacto: (r.contacto as string) || '',
        email: (r.email as string) || '',
        iban: (r.iban as string) || '',
        skills: (r.skills as string) || '',
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      }))
    };
  } catch (error) {
    console.error("Erro getAllColaboradores:", error);
    return { success: false, data: [] };
  }
}

export async function createColaborador(data: {
  nome: string; nome_artistico?: string; nome_pessoal?: string; contacto?: string; email?: string; iban?: string;
  skills?: string; notas?: string; ativo?: number;
}) {
  try {
    await ensureColaboradoresExtendedColumns();
    const nomeArtistico = (data.nome_artistico || data.nome || '').trim();
    await turso.execute({
      sql: "INSERT INTO colaboradores (nome, nome_artistico, nome_pessoal, contacto, email, iban, skills, notas, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [nomeArtistico, nomeArtistico, data.nome_pessoal || '', data.contacto || '', data.email || '', data.iban || '', data.skills || '', data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar colaborador:", error);
    return { success: false, message: "Erro ao criar colaborador." };
  }
}

export async function updateColaborador(id: number, data: {
  nome: string; nome_artistico?: string; nome_pessoal?: string; contacto?: string; email?: string; iban?: string;
  skills?: string; notas?: string; ativo?: number;
}) {
  try {
    await ensureColaboradoresExtendedColumns();
    const nomeArtistico = (data.nome_artistico || data.nome || '').trim();
    await turso.execute({
      sql: "UPDATE colaboradores SET nome=?, nome_artistico=?, nome_pessoal=?, contacto=?, email=?, iban=?, skills=?, notas=?, ativo=? WHERE id=?",
      args: [nomeArtistico, nomeArtistico, data.nome_pessoal || '', data.contacto || '', data.email || '', data.iban || '', data.skills || '', data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update colaborador:", error);
    return { success: false };
  }
}

export async function toggleColaboradorAtivo(id: number, ativo: number) {
  try {
    await turso.execute({ sql: "UPDATE colaboradores SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}


type ArtistaPorAssociar = {
  nome: string;
  tipos: string;
  total: number;
  primeira_data: string;
  ultima_data: string;
  fee_medio: number;
};

export async function getArtistasPorAssociar(): Promise<{ success: boolean; data: ArtistaPorAssociar[] }> {
  try {
    await setupColaboradores();
    await ensureArtistasAssociacaoIgnoradosTable();
    const res = await turso.execute(`
      SELECT
        TRIM(nome) as nome,
        GROUP_CONCAT(DISTINCT TRIM(tipo)) as tipos,
        COUNT(*) as total,
        MIN(evento_data) as primeira_data,
        MAX(evento_data) as ultima_data,
        AVG(fee) as fee_medio
      FROM artistas_evento
      WHERE TRIM(COALESCE(nome, '')) <> ''
        AND (colaborador_id IS NULL OR colaborador_id = 0)
        AND NOT EXISTS (
          SELECT 1 FROM artistas_associacao_ignorados ignored
          WHERE ignored.nome_key = LOWER(TRIM(artistas_evento.nome))
        )
      GROUP BY LOWER(TRIM(nome))
      ORDER BY total DESC, nome ASC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        nome: (r.nome as string) || '',
        tipos: (r.tipos as string) || '',
        total: Number(r.total || 0),
        primeira_data: (r.primeira_data as string) || '',
        ultima_data: (r.ultima_data as string) || '',
        fee_medio: Number(r.fee_medio || 0),
      })),
    };
  } catch (error) {
    console.error("Erro getArtistasPorAssociar:", error);
    return { success: false, data: [] };
  }
}

export async function ignorarArtistaPorAssociar(nome: string) {
  try {
    await ensureArtistasAssociacaoIgnoradosTable();
    const nomeLimpo = (nome || '').trim();
    if (!nomeLimpo) return { success: false, message: "Nome obrigatório." };
    await turso.execute({
      sql: "INSERT OR IGNORE INTO artistas_associacao_ignorados (nome_key, nome_original) VALUES (LOWER(TRIM(?)), ?)",
      args: [nomeLimpo, nomeLimpo],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro ignorar artista por associar:", error);
    return { success: false };
  }
}

export async function associarArtistaNomeAColaborador(nome: string, colaboradorId: number) {
  try {
    await setupColaboradores();
    const col = await turso.execute({ sql: "SELECT id FROM colaboradores WHERE id=?", args: [colaboradorId] });
    if (col.rows.length === 0) return { success: false, updated: 0, message: "Colaborador não encontrado." };
    const res = await turso.execute({
      sql: `
        UPDATE artistas_evento
        SET colaborador_id=?
        WHERE TRIM(COALESCE(nome, '')) <> ''
          AND LOWER(TRIM(nome)) = LOWER(TRIM(?))
          AND (colaborador_id IS NULL OR colaborador_id = 0)
      `,
      args: [colaboradorId, nome],
    });
    return { success: true, updated: Number(res.rowsAffected || 0) };
  } catch (error) {
    console.error("Erro associar artista a colaborador:", error);
    return { success: false, updated: 0 };
  }
}

export async function criarColaboradorEAssociarArtista(nome: string, skill?: string) {
  try {
    const nomeLimpo = (nome || '').trim();
    if (!nomeLimpo) return { success: false, message: "Nome obrigatório." };
    const created = await createColaborador({
      nome: nomeLimpo,
      nome_artistico: nomeLimpo,
      nome_pessoal: '',
      skills: (skill || '').trim(),
      ativo: 1,
    });
    if (!created.success || !created.id) return { success: false, message: "Não foi possível criar colaborador." };
    const linked = await associarArtistaNomeAColaborador(nomeLimpo, created.id);
    return { success: true, id: created.id, updated: linked.updated || 0 };
  } catch (error) {
    console.error("Erro criar e associar colaborador:", error);
    return { success: false };
  }
}

// ── VALORES MASTER POR FUNÇÃO ────────────────────────────────────────────────

export async function setupValoresFuncoes() {
  try {
    await ensureValoresFuncoesTable();
    return { success: true };
  } catch (error) {
    console.error("Erro setup valores funções:", error);
    return { success: false };
  }
}

export async function getAllValoresFuncoes() {
  try {
    await ensureValoresFuncoesTable();
    await ensureValoresMasterTable();
    const master = await turso.execute(`
      SELECT * FROM valores_master
      WHERE ativo=1
      ORDER BY CASE WHEN contexto='Normal' THEN 0 ELSE 1 END, CASE WHEN cliente_nome='' THEN 0 ELSE 1 END, servico ASC, id ASC
    `);
    if (master.rows.length > 0) {
      const seen = new Set<string>();
      const data: { id: number; funcao: string; custo_padrao: number; valor_cliente_padrao: number; notas: string; ativo: number }[] = [];
      for (const r of master.rows as any[]) {
        const servico = ((r.servico as string) || '').trim();
        const key = servico.toLowerCase();
        if (!servico || seen.has(key)) continue;
        seen.add(key);
        data.push({
          id: Number(r.id),
          funcao: servico,
          custo_padrao: Number(r.custo_interno || 0),
          valor_cliente_padrao: Number(r.valor_cliente_final || r.valor_parceiro || 0),
          notas: [r.contexto, r.duracao_formato, r.cliente_nome].filter(Boolean).join(' · '),
          ativo: 1,
        });
      }
      return { success: true, data };
    }

    const res = await turso.execute("SELECT * FROM valores_funcoes ORDER BY funcao ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        funcao: (r.funcao as string) || '',
        custo_padrao: Number(r.custo_padrao || 0),
        valor_cliente_padrao: Number(r.valor_cliente_padrao || 0),
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllValoresFuncoes:", error);
    return { success: false, data: [] };
  }
}

export async function createValorFuncao(data: {
  funcao: string; custo_padrao?: number; valor_cliente_padrao?: number; notas?: string; ativo?: number;
}) {
  try {
    await ensureValoresFuncoesTable();
    await turso.execute({
      sql: "INSERT INTO valores_funcoes (funcao, custo_padrao, valor_cliente_padrao, notas, ativo) VALUES (?, ?, ?, ?, ?)",
      args: [data.funcao.trim(), data.custo_padrao || 0, data.valor_cliente_padrao || 0, data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar valor função:", error);
    return { success: false, message: "Erro ao criar valor. A função pode já existir." };
  }
}

export async function updateValorFuncao(id: number, data: {
  funcao: string; custo_padrao?: number; valor_cliente_padrao?: number; notas?: string; ativo?: number;
}) {
  try {
    await ensureValoresFuncoesTable();
    await turso.execute({
      sql: "UPDATE valores_funcoes SET funcao=?, custo_padrao=?, valor_cliente_padrao=?, notas=?, ativo=? WHERE id=?",
      args: [data.funcao.trim(), data.custo_padrao || 0, data.valor_cliente_padrao || 0, data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update valor função:", error);
    return { success: false };
  }
}

export async function toggleValorFuncaoAtivo(id: number, ativo: number) {
  try {
    await ensureValoresFuncoesTable();
    await turso.execute({ sql: "UPDATE valores_funcoes SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}


// ── MASTER DE VALORES COMERCIAL ──────────────────────────────────────────────

export async function setupValoresMaster() {
  try {
    await ensureValoresMasterTable();
    return { success: true };
  } catch (error) {
    console.error("Erro setup valores master:", error);
    return { success: false };
  }
}

export async function getAllValoresMaster() {
  try {
    await ensureValoresMasterTable();
    const res = await turso.execute(`
      SELECT * FROM valores_master
      ORDER BY ativo DESC, COALESCE(NULLIF(cliente_nome, ''), 'zzzz') ASC, servico ASC, contexto ASC, duracao_formato ASC, id ASC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        servico: (r.servico as string) || '',
        duracao_formato: (r.duracao_formato as string) || '',
        contexto: (r.contexto as string) || 'Normal',
        cliente_nome: (r.cliente_nome as string) || '',
        custo_interno: Number(r.custo_interno || 0),
        valor_parceiro: Number(r.valor_parceiro || 0),
        valor_cliente_final: Number(r.valor_cliente_final || 0),
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllValoresMaster:", error);
    return { success: false, data: [] };
  }
}

export async function createValorMaster(data: {
  servico: string; duracao_formato?: string; contexto?: string; cliente_nome?: string;
  custo_interno?: number; valor_parceiro?: number; valor_cliente_final?: number; notas?: string; ativo?: number;
}) {
  try {
    await ensureValoresMasterTable();
    await turso.execute({
      sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_cliente_final, notas, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.servico.trim(), data.duracao_formato || '', data.contexto || 'Normal', data.cliente_nome || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_cliente_final || 0, data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar valor master:", error);
    return { success: false, message: "Erro ao criar valor master." };
  }
}

export async function updateValorMaster(id: number, data: {
  servico: string; duracao_formato?: string; contexto?: string; cliente_nome?: string;
  custo_interno?: number; valor_parceiro?: number; valor_cliente_final?: number; notas?: string; ativo?: number;
}) {
  try {
    await ensureValoresMasterTable();
    await turso.execute({
      sql: "UPDATE valores_master SET servico=?, duracao_formato=?, contexto=?, cliente_nome=?, custo_interno=?, valor_parceiro=?, valor_cliente_final=?, notas=?, ativo=? WHERE id=?",
      args: [data.servico.trim(), data.duracao_formato || '', data.contexto || 'Normal', data.cliente_nome || '', data.custo_interno || 0, data.valor_parceiro || 0, data.valor_cliente_final || 0, data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update valor master:", error);
    return { success: false };
  }
}

export async function toggleValorMasterAtivo(id: number, ativo: number) {
  try {
    await ensureValoresMasterTable();
    await turso.execute({ sql: "UPDATE valores_master SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}


type ServicoPorCriarNaMaster = {
  servico: string;
  total: number;
  primeira_data: string;
  ultima_data: string;
  fee_medio: number;
};

export async function getServicosPorCriarNaMaster(): Promise<{ success: boolean; data: ServicoPorCriarNaMaster[] }> {
  try {
    await ensureValoresMasterTable();
    const res = await turso.execute(`
      SELECT
        TRIM(a.tipo) as servico,
        COUNT(*) as total,
        MIN(a.evento_data) as primeira_data,
        MAX(a.evento_data) as ultima_data,
        AVG(a.fee) as fee_medio
      FROM artistas_evento a
      WHERE TRIM(COALESCE(a.tipo, '')) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM valores_master vm
          WHERE LOWER(TRIM(vm.servico)) = LOWER(TRIM(a.tipo))
        )
      GROUP BY LOWER(TRIM(a.tipo))
      ORDER BY total DESC, servico ASC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        servico: (r.servico as string) || '',
        total: Number(r.total || 0),
        primeira_data: (r.primeira_data as string) || '',
        ultima_data: (r.ultima_data as string) || '',
        fee_medio: Number(r.fee_medio || 0),
      })),
    };
  } catch (error) {
    console.error("Erro getServicosPorCriarNaMaster:", error);
    return { success: false, data: [] };
  }
}

export async function criarValorMasterAPartirServico(servico: string, custoInterno?: number) {
  try {
    await ensureValoresMasterTable();
    const nome = (servico || '').trim();
    if (!nome) return { success: false, message: "Serviço obrigatório." };
    const exists = await turso.execute({
      sql: "SELECT id FROM valores_master WHERE LOWER(TRIM(servico)) = LOWER(TRIM(?)) LIMIT 1",
      args: [nome],
    });
    if (exists.rows.length > 0) return { success: true, id: Number((exists.rows[0] as any).id), alreadyExists: true };
    await turso.execute({
      sql: "INSERT INTO valores_master (servico, duracao_formato, contexto, cliente_nome, custo_interno, valor_parceiro, valor_cliente_final, notas, ativo) VALUES (?, '', 'Normal', '', ?, 0, 0, ?, 1)",
      args: [nome, Number(custoInterno || 0), 'Criado a partir dos serviços já usados em Agenda/Leads. Rever valores.'],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id), alreadyExists: false };
  } catch (error) {
    console.error("Erro criarValorMasterAPartirServico:", error);
    return { success: false };
  }
}

// ── RESIDÊNCIAS ATIVAS ───────────────────────────────────────────────────────

export async function setupResidenciasAtivas() {
  try {
    await ensureResidenciasAtivasTable();
    return { success: true };
  } catch (error) {
    console.error("Erro setup residências ativas:", error);
    return { success: false };
  }
}

export async function getAllResidenciasAtivas() {
  try {
    await ensureResidenciasAtivasTable();
    const res = await turso.execute(`
      SELECT * FROM residencias_ativas
      ORDER BY ativo DESC, cliente_nome ASC, local ASC, nome ASC, id ASC
    `);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: (r.nome as string) || '',
        cliente_id: r.cliente_id == null ? null : Number(r.cliente_id),
        cliente_nome: (r.cliente_nome as string) || '',
        local: (r.local as string) || '',
        servico: (r.servico as string) || 'DJ',
        duracao_formato: (r.duracao_formato as string) || '',
        custo_interno: Number(r.custo_interno || 0),
        valor_cliente: Number(r.valor_cliente || 0),
        performer_padrao_id: r.performer_padrao_id == null ? null : Number(r.performer_padrao_id),
        performer_padrao_nome: (r.performer_padrao_nome as string) || '',
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllResidenciasAtivas:", error);
    return { success: false, data: [] };
  }
}

export async function createResidenciaAtiva(data: {
  nome: string; cliente_id?: number | null; cliente_nome?: string; local?: string; servico?: string; duracao_formato?: string;
  custo_interno?: number; valor_cliente?: number; performer_padrao_id?: number | null; performer_padrao_nome?: string; notas?: string; ativo?: number;
}) {
  try {
    await ensureResidenciasAtivasTable();
    await turso.execute({
      sql: "INSERT INTO residencias_ativas (nome, cliente_id, cliente_nome, local, servico, duracao_formato, custo_interno, valor_cliente, performer_padrao_id, performer_padrao_nome, notas, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.nome.trim(), data.cliente_id ?? null, data.cliente_nome || '', data.local || '', data.servico || 'DJ', data.duracao_formato || '', data.custo_interno || 0, data.valor_cliente || 0, data.performer_padrao_id ?? null, data.performer_padrao_nome || '', data.notas || '', data.ativo ?? 1],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar residência ativa:", error);
    return { success: false, message: "Erro ao criar residência." };
  }
}

export async function updateResidenciaAtiva(id: number, data: {
  nome: string; cliente_id?: number | null; cliente_nome?: string; local?: string; servico?: string; duracao_formato?: string;
  custo_interno?: number; valor_cliente?: number; performer_padrao_id?: number | null; performer_padrao_nome?: string; notas?: string; ativo?: number;
}) {
  try {
    await ensureResidenciasAtivasTable();
    await turso.execute({
      sql: "UPDATE residencias_ativas SET nome=?, cliente_id=?, cliente_nome=?, local=?, servico=?, duracao_formato=?, custo_interno=?, valor_cliente=?, performer_padrao_id=?, performer_padrao_nome=?, notas=?, ativo=? WHERE id=?",
      args: [data.nome.trim(), data.cliente_id ?? null, data.cliente_nome || '', data.local || '', data.servico || 'DJ', data.duracao_formato || '', data.custo_interno || 0, data.valor_cliente || 0, data.performer_padrao_id ?? null, data.performer_padrao_nome || '', data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update residência ativa:", error);
    return { success: false };
  }
}

export async function toggleResidenciaAtiva(id: number, ativo: number) {
  try {
    await ensureResidenciasAtivasTable();
    await turso.execute({ sql: "UPDATE residencias_ativas SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}

// ── SYNC INICIAL: agenda ganha, propaga para leads ────────────────────────────
// Chamado ao abrir Agenda ou Leads. Percorre todos os pares ligados e corrige
// qualquer diferença — agenda é a fonte de verdade neste sync inicial.
// Após esta passagem os dados ficam alinhados e o sync normal trata do resto.
export async function syncAllExistingData() {
  try {
    // Buscar todos os eventos de agenda que têm origem_lead_id
    const pairs = await turso.execute(`
      SELECT
        a.id            as agenda_id,
        a.event_id      as agenda_eid,
        a.origem_lead_id as lead_id,
        a.event_name    as a_title,
        a.event_date    as a_date,
        a.client_cachet as a_value,
        a.billing_status as a_status,
        a.cliente_id    as a_cliente_id,
        a.cliente_nome  as a_cliente_nome,
        a.modalidade    as a_modalidade,
        a.venue         as a_venue,
        a.contacto      as a_contacto,
        a.notas         as a_notas,
        l.event_id      as lead_eid,
        l.title         as l_title,
        l.event_date    as l_date,
        l.value         as l_value,
        l.status        as l_status,
        l.cliente_id    as l_cliente_id,
        l.client_name   as l_cliente_nome,
        l.modalidade    as l_modalidade,
        l.local         as l_venue,
        l.contacto      as l_contacto,
        l.notas         as l_notas
      FROM agenda a
      INNER JOIN leads l ON l.id = a.origem_lead_id
      WHERE a.origem_lead_id IS NOT NULL
    `);

    let synced = 0;

    for (const row of pairs.rows as any[]) {
      // Garantir event_id partilhado
      let eid: string = row.agenda_eid || row.lead_eid || '';
      if (!eid) {
        eid = uuidv4();
      }
      // Sempre actualizar event_id nos dois lados (idempotente se já igual)
      if (row.agenda_eid !== eid) {
        await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eid, row.agenda_id] });
      }
      if (row.lead_eid !== eid) {
        await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eid, row.lead_id] });
      }

      // Verificar se há alguma diferença (agenda é fonte de verdade)
      const needsSync =
        row.a_title        !== row.l_title       ||
        row.a_date         !== row.l_date        ||
        String(row.a_value || 0) !== String(row.l_value || 0) ||
        (row.a_status      || '') !== (row.l_status      || '') ||
        (row.a_cliente_id  ?? null) != (row.l_cliente_id ?? null) ||
        (row.a_cliente_nome|| '') !== (row.l_cliente_nome|| '') ||
        (row.a_modalidade  || '') !== (row.l_modalidade  || '') ||
        (row.a_venue       || '') !== (row.l_venue       || '') ||
        (row.a_contacto    || '') !== (row.l_contacto    || '') ||
        (row.a_notas       || '') !== (row.l_notas       || '');

      if (needsSync) {
        await turso.execute({
          sql: `UPDATE leads SET
            title=?, event_date=?, value=?, status=?,
            cliente_id=?, client_name=?, modalidade=?,
            local=?, contacto=?, notas=?
            WHERE id=?`,
          args: [
            row.a_title, row.a_date, row.a_value, row.a_status,
            row.a_cliente_id ?? null, row.a_cliente_nome || '', row.a_modalidade || 'Fatura',
            row.a_venue || '', row.a_contacto || '', row.a_notas || '',
            row.lead_id,
          ],
        });
        synced++;
      }
    }

    // Registos sem par: garantir que têm event_id individual
    await turso.execute(`
      UPDATE agenda SET event_id = (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))
      ) WHERE event_id IS NULL OR event_id = ''
    `);
    await turso.execute(`
      UPDATE leads SET event_id = (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))),2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))
      ) WHERE event_id IS NULL OR event_id = ''
    `);

    return { success: true, synced, total: pairs.rows.length };
  } catch (error) {
    console.error("Erro syncAllExistingData:", error);
    return { success: false, synced: 0, total: 0 };
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ALERTAS DE TROCA — mesmo artista no mesmo dia
// ═══════════════════════════════════════════════════════════════════════════

function normalizeConflictArtistName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function ensureArtistConflictOverrides() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS artist_conflict_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_date TEXT NOT NULL,
      artist_key TEXT NOT NULL,
      artist_name TEXT DEFAULT '',
      note TEXT DEFAULT '',
      dismissed_by TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  try { await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_conflict_overrides_key ON artist_conflict_overrides(event_date, artist_key)"); } catch { }
}

export async function getArtistConflictOverrides() {
  noStore();
  try {
    await ensureArtistConflictOverrides();
    const res = await turso.execute("SELECT * FROM artist_conflict_overrides WHERE ativo=1 ORDER BY event_date ASC, artist_name ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        event_date: (r.event_date as string) || '',
        artist_key: (r.artist_key as string) || '',
        artist_name: (r.artist_name as string) || '',
        note: (r.note as string) || '',
        dismissed_by: (r.dismissed_by as string) || '',
      })),
    };
  } catch (error) {
    console.error("Erro getArtistConflictOverrides:", error);
    return { success: false, data: [] };
  }
}

export async function dismissArtistConflict(data: { event_date: string; artist_name: string; note?: string; dismissed_by?: string }) {
  try {
    await ensureArtistConflictOverrides();
    const artistKey = normalizeConflictArtistName(data.artist_name);
    if (!data.event_date || !artistKey) return { success: false, message: "Dados inválidos." };
    await turso.execute({
      sql: "DELETE FROM artist_conflict_overrides WHERE event_date=? AND artist_key=?",
      args: [data.event_date, artistKey],
    });
    await turso.execute({
      sql: `INSERT INTO artist_conflict_overrides
        (event_date, artist_key, artist_name, note, dismissed_by, ativo, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      args: [data.event_date, artistKey, data.artist_name || '', data.note || '', data.dismissed_by || ''],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro dismissArtistConflict:", error);
    return { success: false, message: "Erro ao retirar alerta." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MATERIAIS — catálogo de equipamento + controlo de saídas/entradas
// ═══════════════════════════════════════════════════════════════════════════

export async function setupMateriais() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS materiais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria TEXT DEFAULT '',
        imagem TEXT DEFAULT '',
        quantidade_total INTEGER NOT NULL DEFAULT 1,
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS material_movimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER NOT NULL,
        material_nome TEXT NOT NULL DEFAULT '',
        material_imagem TEXT DEFAULT '',
        quantidade INTEGER NOT NULL DEFAULT 1,
        quantidade_devolvida INTEGER NOT NULL DEFAULT 0,
        origem TEXT NOT NULL DEFAULT 'Loja',
        origem_detalhe TEXT DEFAULT '',
        evento TEXT DEFAULT '',
        responsavel TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        data_saida TEXT DEFAULT (datetime('now')),
        data_volta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const materialCols = [
      "dono TEXT DEFAULT 'LLE'",
      "local_habitual TEXT DEFAULT 'Loja'",
      "consumivel INTEGER DEFAULT 0",
      "stock_minimo INTEGER DEFAULT 0",
      "precisa_comprar INTEGER DEFAULT 0",
      "motivo_compra TEXT DEFAULT ''",
      "quantidade_comprar INTEGER DEFAULT 0",
      "notas_compra TEXT DEFAULT ''",
    ];
    for (const col of materialCols) {
      try { await turso.execute(`ALTER TABLE materiais ADD COLUMN ${col}`); } catch { }
    }

    const movimentoCols = [
      "evento_id INTEGER",
      "dono_material TEXT DEFAULT ''",
      "quem_levou TEXT DEFAULT ''",
      "estado_regresso TEXT DEFAULT ''",
      "quantidade_consumida INTEGER DEFAULT 0",
      "precisa_comprar INTEGER DEFAULT 0",
      "motivo_compra TEXT DEFAULT ''",
      "quantidade_comprar INTEGER DEFAULT 0",
      "quem_confirmou_regresso TEXT DEFAULT ''",
      "notas_regresso TEXT DEFAULT ''",
    ];
    for (const col of movimentoCols) {
      try { await turso.execute(`ALTER TABLE material_movimentos ADD COLUMN ${col}`); } catch { }
    }
    return { success: true };
  } catch (error) {
    console.error("Erro setup materiais:", error);
    return { success: false };
  }
}

// Lista leve de eventos da agenda para selecionar no picker de materiais
export async function getEventosParaMateriais() {
  try {
    const res = await turso.execute(
      "SELECT id, event_name, event_date, status FROM agenda WHERE status != 'Cancelado' ORDER BY event_date ASC"
    );
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        title: (r.event_name as string) || '',
        date: (r.event_date as string) || '',
      })),
    };
  } catch (error) {
    console.error("Erro getEventosParaMateriais:", error);
    return { success: false, data: [] };
  }
}

export async function getAllMateriais() {
  try {
    await setupMateriais();
    const res = await turso.execute("SELECT * FROM materiais ORDER BY nome ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: r.nome as string,
        categoria: (r.categoria as string) || '',
        imagem: (r.imagem as string) || '',
        quantidade_total: Number(r.quantidade_total) || 0,
        dono: (r.dono as string) || 'LLE',
        local_habitual: (r.local_habitual as string) || 'Loja',
        consumivel: r.consumivel === 1 || r.consumivel === true ? 1 : 0,
        stock_minimo: Number(r.stock_minimo) || 0,
        precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
        motivo_compra: (r.motivo_compra as string) || '',
        quantidade_comprar: Number(r.quantidade_comprar) || 0,
        notas_compra: (r.notas_compra as string) || '',
        notas: (r.notas as string) || '',
        ativo: r.ativo === 1 || r.ativo === true ? 1 : 0,
      })),
    };
  } catch (error) {
    console.error("Erro getAllMateriais:", error);
    return { success: false, data: [] };
  }
}

export async function createMaterial(data: {
  nome: string; categoria?: string; imagem?: string; quantidade_total?: number; notas?: string;
  dono?: string; local_habitual?: string; consumivel?: number; stock_minimo?: number;
  precisa_comprar?: number; motivo_compra?: string; quantidade_comprar?: number; notas_compra?: string;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: `INSERT INTO materiais
        (nome, categoria, imagem, quantidade_total, dono, local_habitual, consumivel, stock_minimo, precisa_comprar, motivo_compra, quantidade_comprar, notas_compra, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.nome, data.categoria || '', data.imagem || '', data.quantidade_total ?? 1,
        data.dono || 'LLE', data.local_habitual || 'Loja', data.consumivel ?? 0, data.stock_minimo ?? 0,
        data.precisa_comprar ?? 0, data.motivo_compra || '', data.quantidade_comprar ?? 0, data.notas_compra || '', data.notas || '',
      ],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar material:", error);
    return { success: false, message: "Erro ao criar material." };
  }
}

export async function updateMaterial(id: number, data: {
  nome: string; categoria?: string; imagem?: string; quantidade_total?: number; notas?: string;
  dono?: string; local_habitual?: string; consumivel?: number; stock_minimo?: number;
  precisa_comprar?: number; motivo_compra?: string; quantidade_comprar?: number; notas_compra?: string;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: `UPDATE materiais SET
        nome=?, categoria=?, imagem=?, quantidade_total=?, dono=?, local_habitual=?, consumivel=?, stock_minimo=?,
        precisa_comprar=?, motivo_compra=?, quantidade_comprar=?, notas_compra=?, notas=?
        WHERE id=?`,
      args: [
        data.nome, data.categoria || '', data.imagem || '', data.quantidade_total ?? 1,
        data.dono || 'LLE', data.local_habitual || 'Loja', data.consumivel ?? 0, data.stock_minimo ?? 0,
        data.precisa_comprar ?? 0, data.motivo_compra || '', data.quantidade_comprar ?? 0, data.notas_compra || '', data.notas || '', id,
      ],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update material:", error);
    return { success: false };
  }
}

export async function updateMaterialCompraStatus(id: number, data: {
  precisa_comprar: number; motivo_compra?: string; quantidade_comprar?: number; notas_compra?: string;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: "UPDATE materiais SET precisa_comprar=?, motivo_compra=?, quantidade_comprar=?, notas_compra=? WHERE id=?",
      args: [data.precisa_comprar, data.motivo_compra || '', data.quantidade_comprar ?? 0, data.notas_compra || '', id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro updateMaterialCompraStatus:", error);
    return { success: false };
  }
}

export async function toggleMaterialAtivo(id: number, ativo: number) {
  try {
    await turso.execute({ sql: "UPDATE materiais SET ativo=? WHERE id=?", args: [ativo, id] });
    return { success: true };
  } catch { return { success: false }; }
}

export async function getMovimentosMateriais() {
  try {
    await setupMateriais();
    const res = await turso.execute("SELECT * FROM material_movimentos ORDER BY data_saida DESC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        material_id: Number(r.material_id),
        material_nome: (r.material_nome as string) || '',
        material_imagem: (r.material_imagem as string) || '',
        quantidade: Number(r.quantidade) || 0,
        quantidade_devolvida: Number(r.quantidade_devolvida) || 0,
        quantidade_consumida: Number(r.quantidade_consumida) || 0,
        origem: (r.origem as string) || 'Loja',
        origem_detalhe: (r.origem_detalhe as string) || '',
        dono_material: (r.dono_material as string) || '',
        quem_levou: (r.quem_levou as string) || (r.responsavel as string) || '',
        evento: (r.evento as string) || '',
        evento_id: r.evento_id !== null && r.evento_id !== undefined ? Number(r.evento_id) : null,
        responsavel: (r.responsavel as string) || '',
        notas: (r.notas as string) || '',
        estado_regresso: (r.estado_regresso as string) || '',
        precisa_comprar: r.precisa_comprar === 1 || r.precisa_comprar === true ? 1 : 0,
        motivo_compra: (r.motivo_compra as string) || '',
        quantidade_comprar: Number(r.quantidade_comprar) || 0,
        quem_confirmou_regresso: (r.quem_confirmou_regresso as string) || '',
        notas_regresso: (r.notas_regresso as string) || '',
        data_saida: (r.data_saida as string) || '',
        data_volta: (r.data_volta as string) || null,
      })),
    };
  } catch (error) {
    console.error("Erro getMovimentosMateriais:", error);
    return { success: false, data: [] };
  }
}

export async function registarSaidaMaterial(data: {
  material_id: number; material_nome: string; material_imagem?: string;
  quantidade: number; origem: string; origem_detalhe?: string;
  dono_material?: string; quem_levou?: string;
  evento?: string; evento_id?: number | null; responsavel?: string; notas?: string;
}) {
  try {
    await setupMateriais();
    await turso.execute({
      sql: `INSERT INTO material_movimentos
        (material_id, material_nome, material_imagem, quantidade, quantidade_devolvida, quantidade_consumida, origem, origem_detalhe, dono_material, quem_levou, evento, evento_id, responsavel, notas, data_saida)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        data.material_id, data.material_nome, data.material_imagem || '',
        data.quantidade, data.origem, data.origem_detalhe || '',
        data.dono_material || '', data.quem_levou || data.responsavel || '',
        data.evento || '', data.evento_id ?? null, data.responsavel || '', data.notas || '',
      ],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro registar saída material:", error);
    return { success: false, message: "Erro ao registar saída." };
  }
}

export async function registarVoltaMaterial(id: number, quantidade_devolvida: number, quantidade_total: number, detalhes?: {
  quantidade_consumida?: number;
  estado_regresso?: string;
  precisa_comprar?: number;
  motivo_compra?: string;
  quantidade_comprar?: number;
  quem_confirmou_regresso?: string;
  notas_regresso?: string;
}) {
  try {
    await setupMateriais();
    const quantidadeConsumida = Math.max(0, detalhes?.quantidade_consumida ?? 0);
    const fechado = quantidade_devolvida + quantidadeConsumida >= quantidade_total;
    await turso.execute({
      sql: `UPDATE material_movimentos SET
        quantidade_devolvida=?, quantidade_consumida=?, data_volta=?, estado_regresso=?, precisa_comprar=?, motivo_compra=?, quantidade_comprar=?, quem_confirmou_regresso=?, notas_regresso=?
        WHERE id=?`,
      args: [
        quantidade_devolvida,
        quantidadeConsumida,
        fechado ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        detalhes?.estado_regresso || (fechado ? 'OK' : 'Parcial'),
        detalhes?.precisa_comprar ?? 0,
        detalhes?.motivo_compra || '',
        detalhes?.quantidade_comprar ?? 0,
        detalhes?.quem_confirmou_regresso || '',
        detalhes?.notas_regresso || '',
        id,
      ],
    });

    if (detalhes?.precisa_comprar) {
      const row = await turso.execute({ sql: "SELECT material_id FROM material_movimentos WHERE id=?", args: [id] });
      const materialId = Number((row.rows[0] as any)?.material_id || 0);
      if (materialId) {
        await turso.execute({
          sql: "UPDATE materiais SET precisa_comprar=1, motivo_compra=?, quantidade_comprar=?, notas_compra=? WHERE id=?",
          args: [detalhes.motivo_compra || '', detalhes.quantidade_comprar ?? 0, detalhes.notas_regresso || '', materialId],
        });
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Erro registar volta material:", error);
    return { success: false };
  }
}

export async function deleteMovimentoMaterial(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM material_movimentos WHERE id=?", args: [id] });
    return { success: true };
  } catch { return { success: false }; }
}
