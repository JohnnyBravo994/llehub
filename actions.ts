"use server";

import { createClient } from "@libsql/client";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function extractField(details: string, field: string): string {
  if (!details) return '';
  const regex = new RegExp(`${field}:\\s*([^|]+)`);
  const match = details.match(regex);
  return match ? match[1].trim() : '';
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── SYNC CENTRAL por event_id ─────────────────────────────────────────────────────────
async function propagateByEventId(event_id: string, fields: {
  title?: string; event_date?: string; value?: number; status?: string;
  cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  local?: string; contacto?: string; notas?: string;
  valor_recebido?: number;
}) {
  if (!event_id || event_id.trim() === '') return;
  const f = fields;

  const agendaUpdates: string[] = [];
  const agendaArgs: (string | number | null)[] = [];
  if (f.title !== undefined) { agendaUpdates.push('event_name=?'); agendaArgs.push(f.title); }
  if (f.event_date !== undefined) { agendaUpdates.push('event_date=?'); agendaArgs.push(f.event_date); }
  if (f.value !== undefined) { agendaUpdates.push('client_cachet=?'); agendaArgs.push(f.value); }
  if (f.status !== undefined) { agendaUpdates.push('billing_status=?'); agendaArgs.push(f.status); }
  if (f.cliente_id !== undefined) { agendaUpdates.push('cliente_id=?'); agendaArgs.push(f.cliente_id ?? null); }
  if (f.cliente_nome !== undefined) { agendaUpdates.push('cliente_nome=?'); agendaArgs.push(f.cliente_nome); }
  if (f.modalidade !== undefined) { agendaUpdates.push('modalidade=?'); agendaArgs.push(f.modalidade); }
  if (f.local !== undefined) { agendaUpdates.push('venue=?'); agendaArgs.push(f.local); }
  if (f.contacto !== undefined) { agendaUpdates.push('contacto=?'); agendaArgs.push(f.contacto); }
  if (f.notas !== undefined) { agendaUpdates.push('notas=?'); agendaArgs.push(f.notas); }
  if (f.valor_recebido !== undefined) { agendaUpdates.push('valor_recebido=?'); agendaArgs.push(f.valor_recebido); }
  if (agendaUpdates.length > 0) {
    agendaArgs.push(event_id);
    await turso.execute({ sql: `UPDATE agenda SET ${agendaUpdates.join(',')} WHERE event_id=?`, args: agendaArgs });
  }

  const leadsUpdates: string[] = [];
  const leadsArgs: (string | number | null)[] = [];
  if (f.title !== undefined) { leadsUpdates.push('title=?'); leadsArgs.push(f.title); }
  if (f.event_date !== undefined) { leadsUpdates.push('event_date=?'); leadsArgs.push(f.event_date); }
  if (f.value !== undefined) { leadsUpdates.push('value=?'); leadsArgs.push(f.value); }
  if (f.status !== undefined) { leadsUpdates.push('status=?'); leadsArgs.push(f.status); }
  if (f.cliente_id !== undefined) { leadsUpdates.push('cliente_id=?'); leadsArgs.push(f.cliente_id ?? null); }
  if (f.cliente_nome !== undefined) { leadsUpdates.push('client_name=?'); leadsArgs.push(f.cliente_nome); }
  if (f.modalidade !== undefined) { leadsUpdates.push('modalidade=?'); leadsArgs.push(f.modalidade); }
  if (f.local !== undefined) { leadsUpdates.push('local=?'); leadsArgs.push(f.local); }
  if (f.contacto !== undefined) { leadsUpdates.push('contacto=?'); leadsArgs.push(f.contacto); }
  if (f.notas !== undefined) { leadsUpdates.push('notas=?'); leadsArgs.push(f.notas); }
  if (f.valor_recebido !== undefined) { leadsUpdates.push('valor_recebido=?'); leadsArgs.push(f.valor_recebido); }
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
        alias TEXT DEFAULT '',
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
        colaborador_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS colaboradores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        contacto TEXT DEFAULT '',
        email TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

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
        event_id TEXT DEFAULT '',
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
    ];
    for (const col of leadsCols) {
      try { await turso.execute(`ALTER TABLE leads ADD COLUMN ${col}`); } catch { }
    }

    try { await turso.execute("ALTER TABLE agenda ADD COLUMN event_id TEXT DEFAULT ''"); } catch { }
    try { await turso.execute("ALTER TABLE leads  ADD COLUMN event_id TEXT DEFAULT ''"); } catch { }

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

export async function getDashboardData(userName: string = 'Admin', clientTodayStr?: string) {
  noStore();
  try {
    const serverDate = new Date();
    serverDate.setDate(serverDate.getDate() - 1);
    const todayStr = serverDate.toISOString().split("T")[0];
    const leadsFromDate = clientTodayStr || new Date().toISOString().split("T")[0];

    const leadsRes = await turso.execute({
      sql: "SELECT * FROM leads WHERE event_date >= ? AND status != 'Cancelado' ORDER BY event_date ASC",
      args: [leadsFromDate]
    });

    let agendaSql = "SELECT * FROM agenda WHERE status != 'Cancelado' AND event_date >= ? ORDER BY event_date ASC LIMIT 200";
    if (userName === 'Larissa') agendaSql = "SELECT * FROM agenda WHERE status != 'Cancelado' AND event_date >= ? AND visibility = 'Public' ORDER BY event_date ASC LIMIT 200";

    const agendaAllRes = await turso.execute({ sql: agendaSql, args: [todayStr] });

    const artistasRes = await turso.execute({
      sql: "SELECT evento_id, nome, tipo FROM artistas_evento ORDER BY evento_id ASC, id ASC",
    });
    const artistasByEvento: Record<number, { nome: string; tipo: string }[]> = {};
    for (const r of artistasRes.rows) {
      const eid = Number(r.evento_id);
      if (!artistasByEvento[eid]) artistasByEvento[eid] = [];
      if (r.nome) artistasByEvento[eid].push({ nome: r.nome as string, tipo: (r.tipo as string) || 'DJ' });
    }

    function normDate(raw: string): string {
      if (!raw) return '';
      const s = raw.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; }
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const parts = s.split('-');
        if (parseInt(parts[0]) <= 31 && parseInt(parts[1]) <= 12) return `${parts[2]}-${parts[1]}-${parts[0]}`;
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
        status: r.status || 'Contacto',
        event_date: normDate(r.event_date || ''),
        _raw_date: r.event_date || '',
      })),
      agendaAll: agendaAllRes.rows.map((r: any) => {
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
  try {
    let sqlQuery = "SELECT * FROM agenda ORDER BY event_date ASC, id ASC";
    if (userName === 'Larissa') sqlQuery = "SELECT * FROM agenda WHERE visibility = 'Public' ORDER BY event_date ASC, id ASC";
    const res = await turso.execute(sqlQuery);
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        ...r, id: r.id, title: r.event_name, time_range: r.location || '', venue: r.venue || '',
        tipo: r.staff_needed || '', bill: r.client_cachet || 0,
        cancelled: r.status === 'Cancelado' ? 1 : 0,
        billing_status: r.billing_status || '', cliente_id: r.cliente_id || null,
        cliente_nome: r.cliente_nome || '', modalidade: r.modalidade || 'Fatura',
        origem_lead_id: r.origem_lead_id ? Number(r.origem_lead_id) : null,
        contacto: r.contacto || '', notas: r.notas || '',
        event_id: (r.event_id as string) || '',
      })),
    };
  } catch (error) {
    console.error("Erro agenda:", error);
    return { success: false, data: [] };
  }
}

export async function createAgendaEvent(data: {
  title: string; date: string; time: string; tipo: string; bill: number;
  billing_status?: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string;
  origem_lead_id?: number | null; venue?: string; contacto?: string; notas?: string;
}) {
  try {
    let eventId = uuidv4();
    if (data.origem_lead_id) {
      const leadRow = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [data.origem_lead_id] });
      const existingEid = (leadRow.rows[0] as any)?.event_id;
      if (existingEid && existingEid.trim() !== '') eventId = existingEid;
    }

    await turso.execute({
      sql: "INSERT INTO agenda (event_name, event_date, location, staff_needed, client_cachet, status, visibility, billing_status, cliente_id, cliente_nome, modalidade, origem_lead_id, venue, contacto, notas, event_id) VALUES (?, ?, ?, ?, ?, 'Confirmado', 'Public', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.title, data.date, data.time, data.tipo, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.origem_lead_id ?? null, data.venue || '', data.contacto || '', data.notas || '', eventId],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    const newId = Number(last.rows[0].id);

    if (data.origem_lead_id) {
      await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, data.origem_lead_id] });
      const leadArtistas = await turso.execute({ sql: "SELECT nome, tipo, fee FROM artistas_evento WHERE evento_id=?", args: [-data.origem_lead_id] });
      for (const a of leadArtistas.rows as any[]) {
        await turso.execute({
          sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
          args: [newId, data.title, data.date, a.nome, a.tipo, a.fee],
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
  data: { title: string; date: string; time: string; tipo: string; bill: number; billing_status?: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string; venue?: string; contacto?: string; notas?: string; }
) {
  try {
    await turso.execute({
      sql: "UPDATE agenda SET event_name=?, event_date=?, location=?, staff_needed=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, venue=?, contacto=?, notas=? WHERE id=?",
      args: [data.title, data.date, data.time, data.tipo, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.venue || '', data.contacto || '', data.notas || '', id],
    });

    const evRow = await turso.execute({ sql: "SELECT event_id, origem_lead_id, event_name, event_date FROM agenda WHERE id=?", args: [id] });
    const evData = evRow.rows[0] as any;
    let leadId = evData?.origem_lead_id ? Number(evData.origem_lead_id) : null;
    let eventId: string = evData?.event_id || '';

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
        const leadEid = matchRow.event_id || '';
        if (leadEid && leadEid.trim() !== '' && !eventId) {
          eventId = leadEid;
          await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, id] });
        } else if (eventId && (!leadEid || leadEid.trim() === '')) {
          await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, leadId] });
        }
      }
    }

    if (!eventId || eventId.trim() === '') {
      eventId = uuidv4();
      await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, id] });
    }

    await propagateByEventId(eventId, {
      title: data.title, event_date: data.date, value: data.bill,
      status: data.billing_status || 'Contacto',
      cliente_id: data.cliente_id ?? null, cliente_nome: data.cliente_nome || '',
      modalidade: data.modalidade || 'Fatura',
      local: data.venue || '', contacto: data.contacto || '', notas: data.notas || '',
    });

    if (leadId) {
      const leadCheck = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [leadId] });
      const leadEid = (leadCheck.rows[0] as any)?.event_id || '';
      if (!leadEid || leadEid.trim() === '' || leadEid !== eventId) {
        await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, leadId] });
        await turso.execute({
          sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, local=?, contacto=?, notas=? WHERE id=?",
          args: [data.title, data.date, data.bill, data.billing_status || 'Contacto', data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.venue || '', data.contacto || '', data.notas || '', leadId],
        });
      }
    }

    return { success: true, leadId };
  } catch (error) {
    console.error("Erro editar evento:", error);
    return { success: false, message: "Erro ao editar evento.", leadId: null };
  }
}

export async function cancelAgendaEvent(id: number) {
  try {
    await turso.execute({ sql: "UPDATE agenda SET status='Cancelado' WHERE id=?", args: [id] });
    try {
      const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid && eid.trim() !== '') {
        await turso.execute({ sql: "UPDATE leads SET status='Cancelado' WHERE event_id=?", args: [eid] });
      }
    } catch (propErr) {
      console.error("Cancel propagate warning:", propErr);
    }
    return { success: true };
  } catch (error) {
    console.error("cancelAgendaEvent error:", error);
    return { success: false, message: String(error) };
  }
}

export async function restoreAgendaEvent(id: number) {
  try {
    await turso.execute({ sql: "UPDATE agenda SET status='Confirmado' WHERE id=?", args: [id] });
    try {
      const row = await turso.execute({ sql: "SELECT event_id FROM agenda WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid && eid.trim() !== '') {
        await turso.execute({ sql: "UPDATE leads SET status='Contacto' WHERE event_id=? AND status='Cancelado'", args: [eid] });
      }
    } catch (propErr) {
      console.error("Restore propagate warning:", propErr);
    }
    return { success: true };
  } catch (error) {
    console.error("restoreAgendaEvent error:", error);
    return { success: false, message: String(error) };
  }
}

export async function deleteAgendaEvent(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM agenda WHERE id=?", args: [id] });
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [id] });
    return { success: true };
  } catch (error) {
    console.error("deleteAgendaEvent error:", error);
    return { success: false, message: String(error) };
  }
}

// ── ARTISTAS POR EVENTO ───────────────────────────────────────────────────────

export async function getAllArtistasAgenda(): Promise<{ success: boolean; data: Record<number, { id: number; nome: string; tipo: string; fee: number }[]> }> {
  try {
    const res = await turso.execute("SELECT id, evento_id, nome, tipo, fee FROM artistas_evento ORDER BY evento_id ASC, id ASC");
    const map: Record<number, { id: number; nome: string; tipo: string; fee: number }[]> = {};
    for (const r of res.rows as any[]) {
      const eid = Number(r.evento_id);
      if (!map[eid]) map[eid] = [];
      map[eid].push({ id: Number(r.id), nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee) });
    }
    return { success: true, data: map };
  } catch (error) {
    console.error("Erro getAllArtistasAgenda:", error);
    return { success: false, data: {} };
  }
}

export async function syncArtistasParaLead(leadId: number, eventoNome: string, eventoData: string, artistas: { nome: string; tipo: string; fee: number }[]) {
  try {
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [-leadId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
        args: [-leadId, eventoNome, eventoData, a.nome.trim(), a.tipo, a.fee],
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
    const res = await turso.execute({ sql: "SELECT * FROM artistas_evento WHERE evento_id=? ORDER BY id ASC", args: [eventoId] });
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id), evento_id: Number(r.evento_id),
        evento_nome: r.evento_nome as string, evento_data: r.evento_data as string,
        nome: r.nome as string, tipo: r.tipo as string, fee: Number(r.fee),
      }))
    };
  } catch (error) {
    console.error("Erro artistas evento:", error);
    return { success: false, data: [] };
  }
}

export async function syncArtistasEvento(eventoId: number, eventoNome: string, eventoData: string, artistas: { nome: string; tipo: string; fee: number }[]) {
  try {
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [eventoId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
        args: [eventoId, eventoNome, eventoData, a.nome.trim(), a.tipo, a.fee],
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Erro sync artistas:", error);
    return { success: false };
  }
}

export async function syncArtistasParaAgenda(leadId: number, eventoNome: string, eventoData: string, artistas: { nome: string; tipo: string; fee: number }[]) {
  try {
    const linked = await turso.execute({ sql: "SELECT id FROM agenda WHERE origem_lead_id=?", args: [leadId] });
    if (!linked.rows.length) return { success: true };
    const agendaEventId = Number((linked.rows[0] as any).id);
    await turso.execute({ sql: "DELETE FROM artistas_evento WHERE evento_id=?", args: [agendaEventId] });
    for (const a of artistas) {
      if (!a.nome.trim()) continue;
      await turso.execute({
        sql: "INSERT INTO artistas_evento (evento_id, evento_nome, evento_data, nome, tipo, fee) VALUES (?, ?, ?, ?, ?, ?)",
        args: [agendaEventId, eventoNome, eventoData, a.nome.trim(), a.tipo, a.fee],
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
    await turso.execute({ sql: "UPDATE artistas_evento SET nome=?, tipo=?, fee=? WHERE id=?", args: [data.nome, data.tipo, data.fee, id] });
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
  local?: string; contacto?: string; notas?: string;
}) {
  try {
    const eventId = uuidv4();
    await turso.execute({
      sql: "INSERT INTO leads (title, event_date, value, status, cliente_id, client_name, modalidade, local, contacto, notas, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', eventId],
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
  data: { title: string; event_date: string; value: number; status: string; cliente_id?: number | null; cliente_nome?: string; modalidade?: string; local?: string; contacto?: string; notas?: string; }
) {
  try {
    await turso.execute({
      sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, local=?, contacto=?, notas=? WHERE id=?",
      args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', id],
    });

    const leadRow = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
    let eventId: string = (leadRow.rows[0] as any)?.event_id || '';
    if (!eventId || eventId.trim() === '') {
      eventId = uuidv4();
      await turso.execute({ sql: "UPDATE leads SET event_id=? WHERE id=?", args: [eventId, id] });
    }

    await propagateByEventId(eventId, {
      title: data.title, event_date: data.event_date, value: data.value,
      status: data.status, cliente_id: data.cliente_id ?? null,
      cliente_nome: data.cliente_nome || '', modalidade: data.modalidade || 'Fatura',
      local: data.local || '', contacto: data.contacto || '', notas: data.notas || '',
    });

    const linkedByFk = await turso.execute({ sql: "SELECT id, event_id FROM agenda WHERE origem_lead_id=?", args: [id] });
    for (const row of linkedByFk.rows as any[]) {
      const agEid = (row as any).event_id || '';
      if (!agEid || agEid.trim() === '' || agEid !== eventId) {
        await turso.execute({ sql: "UPDATE agenda SET event_id=? WHERE id=?", args: [eventId, (row as any).id] });
        await turso.execute({
          sql: "UPDATE agenda SET event_name=?, event_date=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, venue=?, contacto=?, notas=? WHERE id=?",
          args: [data.title, data.event_date, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', (row as any).id],
        });
      }
    }

    const normTitle = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const unlinked = await turso.execute({
      sql: "SELECT id, event_id FROM agenda WHERE (origem_lead_id IS NULL OR origem_lead_id != ?) AND event_date=? AND LOWER(TRIM(event_name))=?",
      args: [id, data.event_date, normTitle(data.title)],
    });
    for (const row of unlinked.rows as any[]) {
      await turso.execute({
        sql: "UPDATE agenda SET origem_lead_id=?, event_id=?, event_name=?, client_cachet=?, billing_status=?, cliente_id=?, cliente_nome=?, modalidade=?, venue=?, contacto=?, notas=? WHERE id=?",
        args: [id, eventId, data.title, data.value, data.status, data.cliente_id ?? null, data.cliente_nome || '', data.modalidade || 'Fatura', data.local || '', data.contacto || '', data.notas || '', row.id],
      });
    }

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
    try {
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid && eid.trim() !== '') {
        await turso.execute({ sql: "UPDATE agenda SET billing_status='Cancelado', status='Cancelado' WHERE event_id=?", args: [eid] });
      }
    } catch (propErr) {
      console.error("Cancel lead propagate warning:", propErr);
    }
    return { success: true };
  } catch (error) {
    console.error("cancelLead error:", error);
    return { success: false, message: String(error) };
  }
}

export async function restoreLead(id: number) {
  try {
    await turso.execute({ sql: "UPDATE leads SET status='Contacto' WHERE id=?", args: [id] });
    try {
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid && eid.trim() !== '') {
        await turso.execute({ sql: "UPDATE agenda SET status='Confirmado', billing_status='Contacto' WHERE event_id=? AND status='Cancelado'", args: [eid] });
      }
    } catch (propErr) {
      console.error("Restore lead propagate warning:", propErr);
    }
    return { success: true };
  } catch (error) {
    console.error("restoreLead error:", error);
    return { success: false, message: String(error) };
  }
}

export async function deleteLead(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM leads WHERE id=?", args: [id] });
    return { success: true };
  } catch (error) {
    console.error("deleteLead error:", error);
    return { success: false, message: String(error) };
  }
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────

export async function getAllClientes() {
  try {
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
  } catch (error) {
    console.error("updateCliente error:", error);
    return { success: false, message: String(error) };
  }
}

export async function deleteCliente(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM clientes WHERE id=?", args: [id] });
    return { success: true };
  } catch (error) {
    console.error("deleteCliente error:", error);
    return { success: false, message: String(error) };
  }
}

// ── FATURAÇÃO ─────────────────────────────────────────────────────────────────

export async function getFaturacaoData() {
  try {
    // Cancelado removido — quando se cancela, desaparece da faturação
    const ESTADOS_FATURACAO = ['Confirmado', 'Em Adjudicação', 'Adjudicado', 'Faturado', 'Pago'];
    const placeholders = ESTADOS_FATURACAO.map(() => '?').join(',');
    const today = new Date().toISOString().slice(0, 10);

    const agendaRes = await turso.execute({
      sql: `SELECT id, event_name, event_date, client_cachet, billing_status, cliente_id, cliente_nome, status, modalidade, COALESCE(valor_recebido, 0) as valor_recebido, origem_lead_id
            FROM agenda
            WHERE billing_status IN (${placeholders})
              AND COALESCE(cliente_nome, '') != ''
              AND (event_date <= ? OR billing_status IN ('Faturado', 'Pago'))
              AND billing_status != 'Cancelado'
            ORDER BY event_date ASC`,
      args: [...ESTADOS_FATURACAO, today],
    });

    const leadsRes = await turso.execute({
      sql: `SELECT id, title, event_date, value, status, cliente_id, client_name, modalidade, COALESCE(valor_recebido, 0) as valor_recebido
            FROM leads
            WHERE status IN (${placeholders})
              AND COALESCE(client_name, '') != ''
              AND (event_date <= ? OR event_date IS NULL OR event_date = '' OR status IN ('Faturado', 'Pago'))
              AND status != 'Cancelado'
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

    function normTitle(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }
    const agendaLinkedLeadIds = new Set(agendaItems.filter(i => i.origem_lead_id).map(i => i.origem_lead_id!));
    const agendaTitleKeys = new Set(agendaItems.map(i => `${i.data}||${normTitle(i.descricao)}`));
    const agendaTerminalDateVal = new Set(agendaItems.filter(i => i.billing_status === 'Pago' || i.billing_status === 'Faturado').filter(i => i.valor > 0).map(i => `${i.data}||${i.valor}`));
    const agendaAllDateVal = new Set(agendaItems.filter(i => i.valor > 0).map(i => `${i.data}||${i.valor}`));

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
        if (agendaLinkedLeadIds.has(l.id)) return false;
        if (agendaTitleKeys.has(`${l.data}||${normTitle(l.descricao)}`)) return false;
        if (l.valor > 0 && agendaAllDateVal.has(`${l.data}||${l.valor}`)) return false;
        if (l.valor > 0 && agendaTerminalDateVal.has(`${l.data}||${l.valor}`)) return false;
        return true;
      });

    const allItems = [...agendaItems, ...leadsItems];

    const clientesRes = await turso.execute("SELECT id, nome, alias FROM clientes ORDER BY nome ASC");
    const clientesMap: Record<number, { nome: string; alias: string }> = {};
    for (const c of clientesRes.rows as any[]) {
      clientesMap[Number(c.id)] = { nome: c.nome as string, alias: (c.alias as string) || '' };
    }

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
      if (eid && eid.trim() !== '') await propagateByEventId(eid, { status: billing_status });
    } else {
      await turso.execute({ sql: "UPDATE leads SET status=? WHERE id=?", args: [billing_status, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid && eid.trim() !== '') await propagateByEventId(eid, { status: billing_status });
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
      if (eid && eid.trim() !== '') await propagateByEventId(eid, { valor_recebido: valor });
    } else {
      await turso.execute({ sql: "UPDATE leads SET valor_recebido=? WHERE id=?", args: [valor, id] });
      const row = await turso.execute({ sql: "SELECT event_id FROM leads WHERE id=?", args: [id] });
      const eid = (row.rows[0] as any)?.event_id;
      if (eid && eid.trim() !== '') await propagateByEventId(eid, { valor_recebido: valor });
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
        contacto TEXT DEFAULT '',
        email TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        notas TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    try { await turso.execute("ALTER TABLE artistas_evento ADD COLUMN colaborador_id INTEGER"); } catch { }
    return { success: true };
  } catch (error) {
    console.error("Erro setup colaboradores:", error);
    return { success: false };
  }
}

export async function getAllColaboradores() {
  try {
    const res = await turso.execute("SELECT * FROM colaboradores ORDER BY nome ASC");
    return {
      success: true,
      data: res.rows.map((r: any) => ({
        id: Number(r.id),
        nome: r.nome as string,
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

export async function createColaborador(data: { nome: string; contacto?: string; email?: string; iban?: string; skills?: string; notas?: string }) {
  try {
    await turso.execute({
      sql: "INSERT INTO colaboradores (nome, contacto, email, iban, skills, notas) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [data.nome, data.contacto || '', data.email || '', data.iban || '', data.skills || '', data.notas || ''],
    });
    const last = await turso.execute("SELECT last_insert_rowid() as id");
    return { success: true, id: Number(last.rows[0].id) };
  } catch (error) {
    console.error("Erro criar colaborador:", error);
    return { success: false, message: "Erro ao criar colaborador." };
  }
}

export async function updateColaborador(id: number, data: { nome: string; contacto?: string; email?: string; iban?: string; skills?: string; notas?: string; ativo?: number }) {
  try {
    await turso.execute({
      sql: "UPDATE colaboradores SET nome=?, contacto=?, email=?, iban=?, skills=?, notas=?, ativo=? WHERE id=?",
      args: [data.nome, data.contacto || '', data.email || '', data.iban || '', data.skills || '', data.notas || '', data.ativo ?? 1, id],
    });
    return { success: true };
  } catch (error) {
    console.error("Erro update colaborador:", error);
    return { success: false, message: "Erro ao atualizar colaborador." };
  }
}

export async function deleteColaborador(id: number) {
  try {
    await turso.execute({ sql: "DELETE FROM colaboradores WHERE id=?", args: [id] });
    return { success: true };
  } catch (error) {
    console.error("Erro delete colaborador:", error);
    return { success: false, message: "Erro ao eliminar colaborador." };
  }
}

// ── SYNC ALL EXISTING DATA ────────────────────────────────────────────────────
export async function syncAllExistingData() {
  try {
    const agendaRes = await turso.execute(`
      SELECT a.id, a.event_id, a.origem_lead_id, a.event_name, a.event_date, a.client_cachet, a.billing_status,
             a.cliente_id, a.cliente_nome, a.modalidade, a.venue, a.contacto, a.notas, a.valor_recebido
      FROM agenda a
      WHERE a.origem_lead_id IS NOT NULL
    `);

    for (const row of agendaRes.rows as any[]) {
      const leadId = row.origem_lead_id;
      const eid = row.event_id;
      if (!leadId || !eid || eid.trim() === '') continue;

      const leadRow = await turso.execute({ sql: "SELECT * FROM leads WHERE id=?", args: [leadId] });
      if (!leadRow.rows.length) continue;
      const lead = leadRow.rows[0] as any;

      if (!lead.title || lead.title.trim() === '') {
        await turso.execute({
          sql: "UPDATE leads SET title=?, event_date=?, value=?, status=?, cliente_id=?, client_name=?, modalidade=?, local=?, contacto=?, notas=? WHERE id=?",
          args: [row.event_name, row.event_date, row.client_cachet, row.billing_status, row.cliente_id, row.cliente_nome, row.modalidade, row.venue, row.contacto, row.notas, leadId],
        });
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Erro syncAllExistingData:", error);
    return { success: false, message: "Erro no sync de dados." };
  }
}