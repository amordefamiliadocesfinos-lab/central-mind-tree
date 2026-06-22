## Diagnóstico

Após analisar o código, identifiquei **4 gargalos principais** que explicam o travamento depois de chegar a ~2000 contatos:

### 1. Carrega TODOS os contatos de uma vez (`useContacts.ts`)
- `fetchContacts()` faz paginação no Supabase mas junta tudo em `setContacts(all)` → 2000 objetos com **80+ colunas cada** em memória.
- O `<select *>` traz campos pesados que nunca aparecem no card (endereço, dados fiscais, pais, etc.).

### 2. Refetch total a cada mutação
- `createContact`, `updateContact` e `deleteContact` chamam `await fetchContacts()` no final.
- Editar 1 contato re-baixa os 2000 do banco e re-renderiza tudo.

### 3. Renderização sem virtualização
- `KommoFunnelView` e a lista geral renderizam **todos** os `<ContactCard>` (484 linhas cada, com framer-motion, badges, hooks aninhados) simultaneamente.
- Com 2000 cards, o React tem que montar milhares de nós → trava scroll e clique no mobile.

### 4. Hooks paralelos pesados na página
- `Contatos.tsx` carrega ao mesmo tempo: `useContacts`, `useContactsWithOrders`, `useContactHistory`, `useNoResponseDetection`, `useContactChecklist`, `useDailyMetrics`, `useLeadScore`, `useContactTags`, `useContactNextTasks`. Vários iteram sobre a lista inteira.

---

## Plano de otimização (em ordem de impacto)

### Etapa 1 — Aliviar o fetch (impacto imediato)
**`src/hooks/useContacts.ts`**
- Trocar `select('*')` por um `select` enxuto com apenas os campos usados em listagem/kanban (nome, funil, temperatura, datas, telefone, whatsapp, foto, valor_estimado, classificação, tags-fk). Reduz payload em ~70%.
- Criar uma função separada `fetchContactFull(id)` para quando o usuário abrir o drawer/edição (busca os 80 campos só daquele contato).
- Substituir `await fetchContacts()` em create/update/delete por **atualização local do array** (`setContacts(prev => …)`). Mantém um `fetchContacts()` manual como fallback de "recarregar".

### Etapa 2 — Virtualização da lista (impacto visível no scroll)
- Adicionar `@tanstack/react-virtual` (leve, já compatível com o stack).
- **Kanban** (`KommoFunnelView`): virtualizar cada coluna do funil — renderiza só os ~10 cards visíveis por coluna em vez de centenas.
- **Lista/tabela**: virtualizar as linhas com altura fixa.

### Etapa 3 — Memoização e split de componente
- `ContactCard` envolvido em `React.memo` com comparador raso por `id + updated_at`. Hoje cada re-render do pai re-monta todos os cards.
- Mover hooks pesados (`useNoResponseDetection`, `useLeadScore`, `useContactNextTasks`) para dentro de subcomponentes lazy do card, ou calcular uma única vez no pai com `useMemo` indexado por id.
- Debounce no input de busca (300ms) para não filtrar 2000 itens a cada tecla.

### Etapa 4 — Índices no banco (para futuras consultas filtradas)
Quando passarmos a buscar paginado/filtrado no servidor (etapa 5), garantir índices em:
- `contacts(is_active, funnel_status)`
- `contacts(is_active, name)`
- `contacts(updated_at desc)`

### Etapa 5 (opcional, se ainda lento após 1-4) — Paginação server-side
- Carregar 100 contatos por vez com `range()` + busca/filtros indo direto para o Postgres.
- Indicado se a base crescer para 5k+.

---

## O que farei primeiro (se aprovar)
Implemento **Etapas 1, 2 e 3** em uma rodada — já elimina o travamento atual com 2000 contatos sem mudar fluxo de uso. Etapas 4 e 5 ficam como próximo passo se ainda houver lentidão.

## Detalhes técnicos
- Lib nova: `@tanstack/react-virtual` (~3KB, sem dependências extras).
- Sem mudanças de schema nem migrações nesta primeira rodada.
- Tipagem do `Contact` permanece — apenas os campos não selecionados virão `undefined` na lista (já são todos opcionais).
