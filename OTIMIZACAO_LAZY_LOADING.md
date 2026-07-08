// ✅ VERSÃO OTIMIZADA - SUBSTITUIR o useEffect e load function em agenda/page.tsx
// Muda de carregar TUDO para lazy loading por mês

// 1. ADICIONAR ESTADO DE CACHE (adicionar após outros useState's, aprox. linha 260):
const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
const [loadingMonth, setLoadingMonth] = useState("");
const [monthCache, setMonthCache] = useState<Record<string, AgendaEvent[]>>({});
const [leadsCache, setLeadsCache] = useState<Record<string, Lead[]>>({});

// 2. SUBSTITUIR a função load() (aprox. linha 316):
const load = useCallback(async () => {
  // Carregar data global (não muda)
  const [cr, colr, vr, vmr, rr, cor] = await Promise.all([
    getAllClientes(),
    getAllColaboradores(),
    getAllValoresFuncoes(),
    getAllValoresMaster(),
    getAllResidenciasAtivas(),
    getArtistConflictOverrides(),
  ]);
  if (cr.success) setClientes(cr.data as Cliente[]);
  if (colr.success) setColaboradores(colr.data as Colaborador[]);
  if (vr.success) setValoresFuncoes(vr.data as ValorFuncao[]);
  if (vmr.success) setValoresMaster(vmr.data as ValorMaster[]);
  if (rr.success) setResidenciasAtivas((rr.data as ResidenciaAtiva[]).filter(r => r.ativo === 1));
  if (cor.success) setConflictOverrides(cor.data as ConflictOverride[]);
  
  setLoading(false);
}, []);

// 3. NOVA FUNÇÃO: Carregar mês específico (adicionar antes do useEffect, aprox. linha 360):
const loadMonthData = useCallback(async (monthStr: string) => {
  if (loadedMonths.has(monthStr)) {
    // Já carregado, usar cache
    setEvents(monthCache[monthStr] || []);
    return;
  }

  setLoadingMonth(monthStr);
  
  try {
    const [y, m] = monthStr.split("-").map(Number);
    const startDate = `${monthStr}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const endDate = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

    // Carregar eventos do mês com filtro de data
    const [agendaRes, artistasRes, leadsRes] = await Promise.all([
      getAgendaPaginated("Admin", 1, 500, { startDate, endDate }),
      getAllArtistasAgenda(),
      getAllLeads(),
    ]);

    if (agendaRes.success) {
      const monthEvents = agendaRes.data as AgendaEvent[];
      setMonthCache(prev => ({ ...prev, [monthStr]: monthEvents }));
      setEvents(monthEvents);

      // Filtrar e preparar leads
      if (leadsRes.success) {
        const stripEmoji = (s: string) => s.replace(/[\p{Emoji}\u200d\ufe0f]+/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
        const confirmed = (leadsRes.data as Lead[]).filter(l => {
          if (!CONFIRMED_STATUSES.includes(l.status || "") || !l.event_date) return false;
          if (!l.event_date.startsWith(monthStr)) return false; // Apenas deste mês
          
          const leadTitle = stripEmoji(l.title);
          const leadValue = l.value || 0;
          const hasLinkedEvent = monthEvents.some(e => e.origem_lead_id === l.id);
          if (hasLinkedEvent) return false;
          
          const isDuplicate = monthEvents.some(e => {
            if (e.event_date !== l.event_date) return false;
            const agendaTitle = stripEmoji(e.title || "");
            const titleMatch = agendaTitle.includes(leadTitle.slice(0, 12)) || leadTitle.includes(agendaTitle.slice(0, 12));
            const valueMatch = leadValue > 0 && Number(e.bill) === leadValue;
            return titleMatch || valueMatch;
          });
          return !isDuplicate;
        });
        setLeadsCache(prev => ({ ...prev, [monthStr]: confirmed }));
        setConfirmedLeads(confirmed);
      }

      // Preparar artistas map
      if (artistasRes.success) {
        setArtistasMap(Object.fromEntries(
          Object.entries(artistasRes.data as Record<number, any[]>).map(([k, v]) => [
            k,
            v
              .filter(a => monthEvents.some(e => e.id === Number(k))) // Apenas artistas deste mês
              .map((a: any) => ({ ...a, colaborador_id: a.colaborador_id ?? null, fee: String(a.fee ?? "") }))
          ])
        ));
      }

      setLoadedMonths(prev => new Set([...prev, monthStr]));
    }
  } catch (error) {
    console.error(`Erro carregando mês ${monthStr}:`, error);
  } finally {
    setLoadingMonth("");
  }
}, [loadedMonths, monthCache]);

// 4. SUBSTITUIR useEffect (aprox. linha 362):
useEffect(() => {
  const u = localStorage.getItem("lle_user");
  if (!u) { router.push("/"); return; }
  const parsed = JSON.parse(u);
  setUserName(parsed.name);
  setUserRole(parsed.role || "admin");
  
  if (!sessionStorage.getItem("lle_sync_done")) {
    syncAllExistingData().then(r => {
      if (r.success) sessionStorage.setItem("lle_sync_done", "1");
    });
  }
  
  load();
  loadMateriais();
  
  // Carregar mês atual
  const today = new Date();
  const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  loadMonthData(monthStr);
  
  setTimeout(() => setMounted(true), 100);
}, [load, loadMateriais, loadMonthData]);

// 5. MODIFICAR click dos meses (aprox. linha 1139 e 1357):
// ANTES: onClick={() => setSelectedMonth(ym)}
// DEPOIS: onClick={() => { setSelectedMonth(ym); loadMonthData(ym); }}

// 6. REMOVER ou COMENTAR o getAllArtistasAgenda() do load inicial
// Na linha 317, remover: getAllArtistasAgenda()
