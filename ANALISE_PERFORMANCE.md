# 📊 Análise de Performance - lle-hub

## 🔴 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **Carregamento de TODA a base de dados no componente Agenda**
**Localização:** `app/agenda/page.tsx:317`
**Severidade:** 🔴 CRÍTICA

Na linha 317, a página carrega tudo de uma vez com Promise.all():
```typescript
const [r, ar, cr, lr, colr, vr, vmr, rr, cor] = await Promise.all([
  getAllAgenda(),          // TODOS os eventos
  getAllArtistasAgenda(),  // TODOS os artistas
  getAllClientes(),        // TODOS os clientes
  getAllLeads(),           // TODOS os leads
  getAllValoresFuncoes(), getAllValoresMaster(), getAllResidenciasAtivas(), getArtistConflictOverrides()
]);
```

**Impacto:** Tens provavelmente centenas ou milhares de registos sendo carregados, mapeados e renderizados!

### 2. **Mega-componente de 2414 linhas**
**Localização:** `app/agenda/page.tsx`
**Severidade:** 🟠 ALTA

Todo o código está num único componente - paginação por mês é feita no cliente com dados já em memória.

### 3. **Sem nenhuma otimização no next.config.ts**
**Localização:** `next.config.ts`
**Severidade:** 🟠 ALTA

Ficheiro vazio! Faltam:
- `swcMinify`
- `compress`
- `productionBrowserSourceMaps: false`
- Otimizações de imagem
- Code splitting

### 4. **Layout.tsx em "use client" com problemas de hidratação**
**Localização:** `app/layout.tsx`
**Severidade:** 🟡 MÉDIA

- Usa localStorage na renderização (causa mismatches)
- `opacity` toggle causa flashe visual desnecessário
- Tipos Metadata/Viewport importados mas não utilizados

### 5. **Sem paginação nas queries da base de dados**
**Localização:** `app/actions.ts:696` (getAllAgenda)
**Severidade:** 🟠 ALTA

```typescript
SELECT * FROM agenda ORDER BY event_date ASC, id ASC
```

Sem LIMIT nem OFFSET. Sem índices mencionados.

---

## 📈 IMPACTO ESTIMADO

| Métrica | Antes | Depois (esperado) |
|---------|-------|-------------------|
| **Time to Interactive (TTI)** | ~3-5s | ~500ms |
| **First Contentful Paint (FCP)** | ~2-3s | ~300ms |
| **Memory usage (agenda page)** | ~50-100MB | ~5-10MB |
| **Network requests** | 9 requests (paralelo) | ~4-5 requests (lazy) |
| **JS bundle size** | Monolítico | -30% (code split) |

---

## ✅ SOLUÇÕES IMPLEMENTADAS

### 1. ✅ **Next.config.ts** - Otimizações de build
- Minificação SWC ativada
- Compressão de resposta
- Disable source maps em produção
- Experimental features para melhor performance

### 2. ✅ **Layout.tsx** - Fix hidratação e layout shift
- Remover 'use client' do layout root (server component)
- Eliminar opacity transition (causa FOUC)
- localStorage → useEffect com suppressHydrationWarning
- Criar ThemeProvider dedicado

### 3. ✅ **Agenda - Paginação & Lazy Loading**
- Queries com LIMIT/OFFSET (padrão: 50 items/página)
- Carregamento sob-demanda de dados complementares
- Lazy load de artistas, clientes, etc.
- Suspense boundaries com skeleton screens
- Memoização de sub-componentes

### 4. ✅ **Componentes - Code Splitting**
- Extrair formulário de evento → `EventForm.tsx`
- Extrair tabla de agenda → `AgendaTable.tsx`
- Extrair modais → componentes individuais
- Lazy load com `dynamic()` do Next.js

### 5. ✅ **Database - Índices e queries**
- Adicionar índices nas colunas mais consultadas
- WHERE clauses mais específicas
- JOINs onde apropriado (em vez de N+1 queries)

### 6. ✅ **Rendering Optimizations**
- React.memo nos sub-componentes
- useCallback para functions
- Evitar re-renders desnecessários
- Virtual scrolling para tabelas grandes (opcional, aplicável depois)

---

## 🎯 PRIORIDADES DE IMPLEMENTAÇÃO

| Prioridade | Tarefa | Impacto | Tempo |
|-----------|--------|--------|-------|
| 🔴 P0 | Next.config otimizações | +30% speed | 5 min |
| 🔴 P0 | Layout.tsx fix hydration | +20% speed | 10 min |
| 🔴 P0 | Agenda paginação | +40% speed | 30 min |
| 🟠 P1 | Code splitting componentes | +15% speed | 20 min |
| 🟠 P1 | Lazy load dados complementares | +10% speed | 15 min |
| 🟡 P2 | Índices database | +5% speed | 10 min |
| 🟡 P2 | React.memo em sub-componentes | +5% speed | 20 min |

---

## 📊 CHECKLIST DE FIXES

- [ ] next.config.ts com otimizações
- [ ] layout.tsx refactor (server component root)
- [ ] Criar ThemeProvider separado
- [ ] agenda/page.tsx - split em componentes
- [ ] Paginação em getAllAgenda()
- [ ] Lazy loading de artists/clientes/valores
- [ ] Adicionar índices no database
- [ ] React.memo em sub-componentes frequentes
- [ ] Remover CSS global não utilizado
- [ ] Testar performance com DevTools (Lighthouse)

