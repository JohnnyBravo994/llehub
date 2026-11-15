// @ts-nocheck
// ✅ ADICIONAR ESTAS FUNÇÕES em app/actions.ts
// Estas são versões otimizadas com filtros de data e paginação

// ⚡ LEADS PAGINADO COM FILTRO DE DATA
export async function getLeadsPaginated(
  page: number = 1,
  pageSize: number = 100,
  filters?: { startDate?: string; endDate?: string; status?: string; search?: string }
) {
  noStore();
  try {
    const offset = (page - 1) * pageSize;
    let whereClause = '';
    const args: any[] = [];

    if (filters?.startDate) {
      whereClause = "WHERE event_date >= ?";
      args.push(filters.startDate);
    }

    if (filters?.endDate) {
      whereClause = whereClause 
        ? whereClause + " AND event_date <= ?" 
        : "WHERE event_date <= ?";
      args.push(filters.endDate);
    }

    if (filters?.status && filters.status !== 'all') {
      whereClause = whereClause 
        ? whereClause + " AND status = ?" 
        : "WHERE status = ?";
      args.push(filters.status);
    }

    if (filters?.search) {
      const search = `%${filters.search}%`;
      whereClause = whereClause 
        ? whereClause + " AND (event_name LIKE ? OR cliente_nome LIKE ? OR venue LIKE ?)" 
        : "WHERE (event_name LIKE ? OR cliente_nome LIKE ? OR venue LIKE ?)";
      args.push(search, search, search);
    }

    // Contar total
    const countRes = await turso.execute({
      sql: `SELECT COUNT(*) as total FROM leads ${whereClause}`,
      args,
    });
    const total = (countRes.rows[0] as any).total || 0;

    // Query com apenas colunas necessárias
    const dataArgs = [...args, pageSize, offset];
    const sqlQuery = `
      SELECT 
        id, event_name, event_date, value, status, cancelled, cliente_nome, 
        modalidade, cliente_id, agenda_event_id, event_id,
        tipo_comercial, servico_comercial, valor_contexto
      FROM leads
      ${whereClause}
      ORDER BY event_date DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const res = await turso.execute({ sql: sqlQuery, args: dataArgs });

    const data = res.rows.map((r: any) => ({
      id: r.id,
      title: r.event_name || '',
      event_date: r.event_date || '',
      value: Number(r.value) || 0,
      status: r.status || '',
      cancelled: r.cancelled || 0,
      cliente_nome: r.cliente_nome || '',
      modalidade: r.modalidade || '',
      cliente_id: r.cliente_id || null,
      agenda_event_id: r.agenda_event_id || null,
      event_id: r.event_id || '',
      tipo_comercial: r.tipo_comercial || '',
      servico_comercial: r.servico_comercial || '',
      valor_contexto: r.valor_contexto || '',
    }));

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Erro leads paginado:", error);
    return { success: false, data: [], total: 0, page: 1, pageSize: 100, totalPages: 0 };
  }
}

// ⚡ MATERIAIS PAGINADO COM FILTRO
export async function getMateriasPaginado(
  page: number = 1,
  pageSize: number = 50,
  filters?: { search?: string; ativo?: number }
) {
  noStore();
  try {
    const offset = (page - 1) * pageSize;
    let whereClause = '';
    const args: any[] = [];

    if (filters?.ativo !== undefined) {
      whereClause = "WHERE ativo = ?";
      args.push(filters.ativo);
    }

    if (filters?.search) {
      const search = `%${filters.search}%`;
      whereClause = whereClause 
        ? whereClause + " AND (nome LIKE ? OR categorias LIKE ?)" 
        : "WHERE (nome LIKE ? OR categorias LIKE ?)";
      args.push(search, search);
    }

    // Contar total
    const countRes = await turso.execute({
      sql: `SELECT COUNT(*) as total FROM materiais ${whereClause}`,
      args,
    });
    const total = (countRes.rows[0] as any).total || 0;

    // Query com apenas colunas necessárias
    const dataArgs = [...args, pageSize, offset];
    const sqlQuery = `
      SELECT 
        id, nome, categorias, quantidade_total, quantidade_disponivel, 
        preco_unitario, preco_dia, detalhes, ativo
      FROM materiais
      ${whereClause}
      ORDER BY nome ASC
      LIMIT ? OFFSET ?
    `;

    const res = await turso.execute({ sql: sqlQuery, args: dataArgs });

    const data = res.rows.map((r: any) => ({
      id: r.id,
      nome: r.nome || '',
      categorias: r.categorias || '',
      quantidade_total: Number(r.quantidade_total) || 0,
      quantidade_disponivel: Number(r.quantidade_disponivel) || 0,
      preco_unitario: Number(r.preco_unitario) || 0,
      preco_dia: Number(r.preco_dia) || 0,
      detalhes: r.detalhes || '',
      ativo: Number(r.ativo) || 1,
    }));

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Erro materiais paginado:", error);
    return { success: false, data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}

// ⚡ ARTISTAS DE EVENTO SÓ COM COLUNAS NECESSÁRIAS (otimizado)
export async function getArtistasEventoOptimized(eventoId: number) {
  try {
    await ensureArtistasColaboradorIdColumn();
    const res = await turso.execute({
      sql: `
        SELECT id, nome, tipo, fee, colaborador_id 
        FROM artistas_evento 
        WHERE evento_id = ? 
        ORDER BY id ASC
      `,
      args: [eventoId],
    });
    
    const data = (res.rows as any[]).map(r => ({
      id: Number(r.id),
      nome: r.nome as string,
      tipo: r.tipo as string,
      fee: Number(r.fee),
      colaborador_id: r.colaborador_id == null ? null : Number(r.colaborador_id),
    }));
    
    return { success: true, data };
  } catch (error) {
    console.error("Erro artistas evento:", error);
    return { success: false, data: [] };
  }
}

// ⚡ MOVIMENTOS MATERIAIS PAGINADO (para tracking de saídas/devoluções)
export async function getMovimentosMateriasPaginado(
  page: number = 1,
  pageSize: number = 50,
  filters?: { startDate?: string; endDate?: string; material_id?: number }
) {
  noStore();
  try {
    const offset = (page - 1) * pageSize;
    let whereClause = '';
    const args: any[] = [];

    if (filters?.startDate) {
      whereClause = "WHERE data_saida >= ?";
      args.push(filters.startDate);
    }

    if (filters?.endDate) {
      whereClause = whereClause 
        ? whereClause + " AND data_saida <= ?" 
        : "WHERE data_saida <= ?";
      args.push(filters.endDate);
    }

    if (filters?.material_id) {
      whereClause = whereClause 
        ? whereClause + " AND material_id = ?" 
        : "WHERE material_id = ?";
      args.push(filters.material_id);
    }

    // Contar total
    const countRes = await turso.execute({
      sql: `SELECT COUNT(*) as total FROM movimentos_materiais ${whereClause}`,
      args,
    });
    const total = (countRes.rows[0] as any).total || 0;

    // Query
    const dataArgs = [...args, pageSize, offset];
    const sqlQuery = `
      SELECT 
        id, material_id, evento_id, tipo_movimento, quantidade, 
        data_saida, data_volta, detalhes
      FROM movimentos_materiais
      ${whereClause}
      ORDER BY data_saida DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const res = await turso.execute({ sql: sqlQuery, args: dataArgs });

    const data = res.rows.map((r: any) => ({
      id: r.id,
      material_id: Number(r.material_id),
      evento_id: Number(r.evento_id),
      tipo_movimento: r.tipo_movimento as string,
      quantidade: Number(r.quantidade),
      data_saida: r.data_saida as string,
      data_volta: r.data_volta || null,
      detalhes: r.detalhes || '',
    }));

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Erro movimentos materiais paginado:", error);
    return { success: false, data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  }
}
