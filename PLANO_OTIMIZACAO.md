# 🚀 PLANO DE OTIMIZAÇÃO - LAZY LOADING POR MÊS

## Problema Atual
- **Carrega TUDO** quando abre a agenda (todos os eventos, leads, artistas, etc.)
- Cada edição demora porque está a trabalhar com datasets gigantes
- Sem filtros de data nas queries

## Solução: Lazy Loading por Período

### 📋 Prioridade 1: AGENDA (Maior Impacto)

#### PASSO 1: Adicionar as funções otimizadas em `app/actions.ts`
1. Copiar as funções de `FUNCOES_OTIMIZADAS.ts`
2. Adicionar `getLeadsPaginated()` - para carregar leads do mês
3. Adicionar `getMateriasPaginado()` - para materiais (se usarem)
4. Adicionar `getMovimentosMateriasPaginado()` - para histórico

#### PASSO 2: Refatorar `app/agenda/page.tsx`
1. **Adicionar estado de cache** (após linha ~260):
```typescript
const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
const [loadingMonth, setLoadingMonth] = useState("");
const [monthCache, setMonthCache] = useState<Record<string, AgendaEvent[]>>({});
const [leadsCache, setLeadsCache] = useState<Record<string, Lead[]>>({});
```

2. **Nova função loadMonthData()** (substituir load):
   - Carregar apenas eventos do mês selecionado
   - Com filtro: `startDate` e `endDate`
   - Usar `getAgendaPaginated()` ao invés de `getAllAgenda()`
   - Guardar em cache (`monthCache`)
   - Se já carregou, usar cache (instantâneo)

3. **Modificar onClick dos meses** (linhas ~1139, ~1357):
   - Antes: `onClick={() => setSelectedMonth(ym)}`
   - Depois: `onClick={() => { setSelectedMonth(ym); loadMonthData(ym); }}`

4. **Remover getAllArtistasAgenda() do load inicial**
   - Isso carrega TODOS os artistas de TODOS os eventos
   - Carregar apenas quando renderizar o mês

#### PASSO 3: Implementar estados de loading
- Mostrar spinner enquanto carrega o mês
- Texto: "Carregando eventos de [mês]..."
- Cache permite alternância instantânea entre meses já carregados

---

### 📋 Prioridade 2: LEADS

#### PASSO 1: Criar função paginada
- `getLeadsPaginated()` já existe em `FUNCOES_OTIMIZADAS.ts`
- Adicionar em `app/actions.ts`

#### PASSO 2: Otimizar `app/leads/page.tsx`
- Usar `getLeadsPaginated()` ao invés de `getAllLeads()`
- Adicionar filtros:
  - **Data**: mostrar leads do mês selecionado
  - **Status**: permitir filtrar por status
  - **Busca**: texto rápido
- Paginação: 50-100 leads por página

---

### 📋 Prioridade 3: MATERIAIS

#### PASSO 1: Otimizar `app/materiais/page.tsx`
- Usar `getMateriasPaginado()` ao invés de `getAllMateriais()`
- Adicionar:
  - Busca por nome/categoria
  - Filtro: Ativos vs Inativos
  - Paginação

#### PASSO 2: Otimizar histórico de movimentos
- Usar `getMovimentosMateriasPaginado()`
- Com filtros de data
- Paginar por data de saída

---

## ⚡ BENEFÍCIOS ESPERADOS

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| **Tempo de Carregamento** | 3-5s | 0.5-1s | 80% mais rápido ⚡ |
| **Memória Usada** | 100+ MB | 10-20 MB | 80% menos 📉 |
| **Resposta UI** | Lenta/Travamentos | Instantânea | Fluida ✨ |
| **Mudança de Mês** | 0.3s (filtro local) | 0s (cache) | Instantânea 🚀 |
| **Editar Evento** | 2-3s | 0.2-0.5s | 5x mais rápido |

---

## 🔧 IMPLEMENTAÇÃO DETALHADA

### Agenda/page.tsx - Estrutura Final

```typescript
// Estado
const [selectedMonth, setSelectedMonth] = useState("2024-07");
const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
const [monthCache, setMonthCache] = useState<Record<string, AgendaEvent[]>>({});
const [loadingMonth, setLoadingMonth] = useState("");

// Function: Carregar mês (lazy loading)
const loadMonthData = useCallback(async (monthStr: string) => {
  // 1. Se já carregou, usar cache
  if (loadedMonths.has(monthStr)) {
    setEvents(monthCache[monthStr] || []);
    return;
  }

  // 2. Se não, fazer query com filtro de data
  setLoadingMonth(monthStr);
  
  const [y, m] = monthStr.split("-").map(Number);
  const startDate = `${monthStr}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const endDate = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

  // 3. Query apenas este mês
  const agendaRes = await getAgendaPaginated("Admin", 1, 500, {
    startDate,
    endDate
  });

  // 4. Guardar em cache
  if (agendaRes.success) {
    setMonthCache(prev => ({ ...prev, [monthStr]: agendaRes.data }));
    setEvents(agendaRes.data);
    setLoadedMonths(prev => new Set([...prev, monthStr]));
  }

  setLoadingMonth("");
}, [loadedMonths, monthCache]);

// Tab de mês - click
onClick={() => { 
  setSelectedMonth(ym); 
  loadMonthData(ym);  // 👈 Carrega mês
}}

// useEffect - carrega mês actual ao iniciar
useEffect(() => {
  // ... setup user/sync ...
  const today = new Date();
  const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  loadMonthData(monthStr);
}, [loadMonthData]);
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Agenda
- [ ] Adicionar `getAgendaPaginated()` em actions.ts
- [ ] Adicionar `getLeadsPaginated()` em actions.ts
- [ ] Adicionar estado de cache em agenda/page.tsx
- [ ] Implementar `loadMonthData()` function
- [ ] Modificar onClick dos meses
- [ ] Testar lazy loading
- [ ] Verificar performance (DevTools)

### Leads
- [ ] Usar `getLeadsPaginated()` ao invés de `getAllLeads()`
- [ ] Adicionar filtros de data
- [ ] Adicionar paginação

### Materiais
- [ ] Usar `getMateriasPaginado()`
- [ ] Adicionar busca

### Validação
- [ ] Tudo funciona sem erros
- [ ] Nenhuma query sem filtro de data
- [ ] Cache funciona (alternância rápida)
- [ ] Build produção passa ✅

---

## 📊 QUERIES ANTES vs DEPOIS

### ❌ ANTES (Slow)
```sql
-- getAllAgenda() - carrega TUDO
SELECT * FROM agenda ORDER BY event_date DESC LIMIT 500;
-- Resultado: ~500 eventos, TODAS as colunas, TODOS os meses
-- Tempo: 2-3s

-- getAllArtistasAgenda() - TODOS os artistas
SELECT * FROM artistas_evento ORDER BY evento_id ASC;
-- Resultado: 5000+ artistas
-- Tempo: 1-2s

-- getAllLeads() - TODOS os leads
SELECT * FROM leads;
-- Resultado: 10000+ leads
-- Tempo: 2-3s

-- Total: ~6-8s + Memory: 100+ MB 😫
```

### ✅ DEPOIS (Fast)
```sql
-- getAgendaPaginated() - SÓ este mês
SELECT id, event_name, event_date, ... FROM agenda 
WHERE event_date >= '2024-07-01' AND event_date <= '2024-07-31'
ORDER BY event_date ASC LIMIT 500;
-- Resultado: ~30-50 eventos (deste mês)
-- Tempo: 0.1-0.2s

-- Artistas SÓ dos eventos deste mês
-- Tempo: 0.05s

-- getLeadsPaginated() - SÓ este mês
SELECT ... FROM leads 
WHERE event_date >= '2024-07-01' AND event_date <= '2024-07-31'
LIMIT 100;
-- Resultado: ~10-20 leads (deste mês)
-- Tempo: 0.1s

-- Total: ~0.5s + Memory: 10-20 MB 🚀
```

---

## 🎯 PRÓXIMAS MELHORIAS (Fase 2)

1. **Prefetch**: Carregar mês seguinte silenciosamente
2. **Infinite scroll**: Para leads/materiais
3. **Search indexing**: Para buscas mais rápidas
4. **Compressão**: Gzip responses
5. **CDN**: Para assets estáticos

---

## 🆘 SUPORTE

Se encontrar problemas:
1. Verificar console (F12) para erros
2. Limpar cache do navegador (Ctrl+Shift+Del)
3. Verificar `.env.local` tem variáveis de ambiente corretas
4. Testar queries diretamente no banco (Turso)
