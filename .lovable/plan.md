# Integração do Painel Central — Rotina como centro de execução

## Objetivo
1. Fazer a **Rotina** ser o hub de execução: qualquer módulo (Digital, CRM, Financeiro, Produção, Foco, Tarefas) pode enviar uma atividade para ela via botão **"Adicionar à Rotina"**.
2. Cada **Método de Trabalho (MT)** ganha uma **Área de Trabalho** própria, destacando os módulos prioritários daquela função — sem esconder os demais.

---

## Parte 1 — Botão "Adicionar à Rotina" (universal)

Novo componente compartilhado `AddToRoutineButton` + dialog `AddToRoutineDialog`.

Campos do dialog:
- **Título** (pré-preenchido a partir do item de origem: tarefa, lead, pedido, ideia, lançamento)
- **Usuário responsável** (dropdown `app_users`)
- **Método de Trabalho** (dropdown `routine_mts`, opcional — só para agrupar)
- **Data + Horário** (date + time picker)
- **Duração** (min)
- **Recorrência** (nenhuma / diária / semanal / mensal — dias da semana quando semanal)
- **Alerta** (sem alerta / no horário / 5 / 15 / 30 min antes)
- **Foco** (trabalho_profundo, atendimento, criativo, admin, pausa)

Comportamento:
- Cria linha em `routine_blocks` para a data escolhida (e clona nas próximas N ocorrências quando recorrente — limitar a 12 para não explodir).
- Marca `notes` com origem (`origem: crm/lead/<id>`, `origem: financial/entry/<id>` etc.) para rastreio.
- Ao concluir o bloco na Rotina, opcionalmente marcar a tarefa/pedido de origem como feito (fase 2, fora deste plano).

Pontos de inserção do botão (fase 1):
- CRM: `ContactCard` (menu de ações) e `LeadDetailDrawer`
- Financeiro: `FinancialEntriesList` (menu do lançamento)
- Produção: `OrderCard` / `OrderEditDialog`
- Digital: card de ideia (menu de ações)
- Foco: item da fila
- Tarefas: `TasksDialog` / linha da tarefa

Todos usam o mesmo componente — sem duplicação.

---

## Parte 2 — MT complementa, não sobrescreve

Já existe `MTPickerDialog` que aplica o cronograma base do MT. Ajuste:
- Ao aplicar um MT, **preservar** blocos existentes que tenham `notes` contendo `origem:` (vieram de outros módulos).
- Só substituir os blocos "base" do MT anterior.

Implementação: no `useRoutine.autoPlanDay` (ou onde o MT é aplicado), filtrar antes de deletar:
```ts
.not('notes', 'ilike', '%origem:%')
```

---

## Parte 3 — Área de Trabalho por MT

Nova coluna em `routine_mts`:
- `priority_modules text[]` — lista de rotas priorizadas (ex.: `['/dashboard','/financeiro']`)

Editor: adicionar seção no `MTManagerDialog` — checkboxes com todos os módulos disponíveis:
`Dashboard, CRM, Digital, Financeiro, Produção, Operações, Foco, Rotina, Tarefas, Rotas, Reuniões, Planejamento, Metas, Atendimento`.

Presets padrão (aplicados só se `priority_modules` estiver vazio):
- **Gestão** → Dashboard, Metas, Financeiro, Reuniões
- **Comercial** → CRM, Atendimento, Digital, Financeiro
- **Produção** → Operações, Produção, Estoque (Operações), Rotas

Exibição:
- Novo componente `MTWorkspaceBar` renderizado no topo do `Index`/Dashboard e opcionalmente no header global — mostra ícones grandes dos módulos prioritários do MT ativo do dia.
- MT ativo = MT do bloco em andamento, ou o mais usado no dia, ou o padrão do usuário.
- Todos os outros módulos continuam acessíveis pelo menu/rotas normais — só não ficam em destaque.

---

## Alterações técnicas

### Banco
Migration:
```sql
ALTER TABLE public.routine_mts
  ADD COLUMN IF NOT EXISTS priority_modules text[] DEFAULT '{}'::text[];
```

### Arquivos novos
- `src/components/routine/AddToRoutineButton.tsx`
- `src/components/routine/AddToRoutineDialog.tsx`
- `src/components/routine/MTWorkspaceBar.tsx`
- `src/hooks/useActiveMT.ts` (retorna o MT ativo do momento)

### Arquivos editados
- `src/hooks/useRoutine.ts` — helper `addBlockFromModule({source, ...})` + recorrência + preservação de blocos com `origem:`
- `src/components/routine/MTManagerDialog.tsx` — editor de `priority_modules`
- `src/components/routine/MTPickerDialog.tsx` — passar flag "preservar externos"
- `src/pages/Index.tsx` (ou Dashboard) — renderizar `MTWorkspaceBar`
- Inserção do `AddToRoutineButton` em: `ContactCard`, `LeadDetailDrawer`, `FinancialEntriesList`, `OrderCard`/`OrderEditDialog`, card de ideia digital, `TasksDialog`, item da fila do Foco.

### Fora do escopo desta iteração
- Marcar item de origem como concluído quando o bloco é concluído (fase 2).
- Reagendamento automático quando um módulo altera a data da tarefa fonte.
- Modo "workspace fullscreen" por MT (fase 2).

---

## Ordem de execução
1. Migration `priority_modules`.
2. `AddToRoutineDialog` + hook `useRoutine.addBlockFromModule`.
3. `AddToRoutineButton` e integração nos 6 pontos listados.
4. Ajuste do `MTPickerDialog`/`autoPlanDay` para preservar `origem:`.
5. Editor `priority_modules` no `MTManagerDialog`.
6. `useActiveMT` + `MTWorkspaceBar` no Index.

Confirma esse plano? Posso ajustar pontos de inserção, presets de MT ou remover a recorrência automática se preferir manter simples.
