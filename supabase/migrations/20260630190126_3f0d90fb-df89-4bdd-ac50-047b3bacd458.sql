
CREATE TABLE IF NOT EXISTS public.routine_mts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  name text NOT NULL,
  description text,
  target_role text,
  icon text,
  color text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_mts TO anon, authenticated;
GRANT ALL ON public.routine_mts TO service_role;

ALTER TABLE public.routine_mts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on routine_mts" ON public.routine_mts FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER routine_mts_set_updated BEFORE UPDATE ON public.routine_mts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_routine_mts_area ON public.routine_mts(area);

-- Seed: Comercial / Atendimento / Marketing (Amor de Família baseline)
INSERT INTO public.routine_mts (area, name, description, target_role, icon, color, is_default, order_index, blocks) VALUES
('comercial', 'MT Comercial / Atendimento / Marketing', 'Cronograma diário para quem opera vendas, atendimento e marketing (modelo Amor de Família).', 'Atendente / Vendedor / Social Media', '💬', '#3B82F6', true, 1,
'[
  {"start":"09:30","end":"10:00","title":"Abertura do Dia (WhatsApp & CRM)","focus":"atendimento","block_type":"admin","duration_minutes":30,"notes":"MT: Comercial","checklist":[{"text":"Abrir o WhatsApp","done":false},{"text":"Abrir o CRM","done":false},{"text":"Verificar quem respondeu","done":false},{"text":"Ver os pedidos do dia","done":false}]},
  {"start":"10:00","end":"11:30","title":"Prospecção Ativa (100 Clientes)","focus":"atendimento","block_type":"foco","duration_minutes":90,"notes":"MT: Comercial","checklist":[{"text":"Enviar mensagens para 100 clientes","done":false},{"text":"Atualizar o CRM conforme cada resposta","done":false},{"text":"Responder quem retornar","done":false}]},
  {"start":"11:30","end":"12:30","title":"Orçamentos e Fechamento de Pedidos","focus":"atendimento","block_type":"foco","duration_minutes":60,"notes":"MT: Comercial","checklist":[{"text":"Fazer orçamentos","done":false},{"text":"Fechar pedidos","done":false},{"text":"Tirar dúvidas dos clientes","done":false}]},
  {"start":"12:30","end":"13:30","title":"Almoço","focus":"pausa","block_type":"pausa","duration_minutes":60,"notes":"Pausa","checklist":[]},
  {"start":"13:30","end":"15:00","title":"Produção de Conteúdo","focus":"trabalho_profundo","block_type":"foco","duration_minutes":90,"notes":"MT: Marketing","checklist":[{"text":"Criar posts","done":false},{"text":"Fazer stories","done":false},{"text":"Escrever legendas","done":false},{"text":"Criar artes de promoção","done":false}]},
  {"start":"15:00","end":"16:00","title":"Edição e Organização de Mídia","focus":"trabalho_profundo","block_type":"foco","duration_minutes":60,"notes":"MT: Marketing","checklist":[{"text":"Editar fotos/vídeos","done":false},{"text":"Organizar pastas","done":false}]},
  {"start":"16:00","end":"17:00","title":"Follow-up de Clientes","focus":"atendimento","block_type":"foco","duration_minutes":60,"notes":"MT: Comercial","checklist":[{"text":"Retomar conversas pendentes","done":false},{"text":"Atualizar CRM","done":false}]},
  {"start":"17:00","end":"18:00","title":"Fechamento do Dia","focus":"atendimento","block_type":"admin","duration_minutes":60,"notes":"MT: Gestão","checklist":[{"text":"Conferir se ficou algum cliente sem resposta","done":false},{"text":"Atualizar relatório do dia","done":false},{"text":"Finalizar o expediente","done":false}]}
]'::jsonb),

('gestao', 'MT Gestão / CEO', 'Rotina estratégica para gestor/CEO: visão geral, decisões, acompanhamento de times e prioridades.', 'CEO / Gerente / Diretor', '👔', '#A855F7', true, 2,
'[
  {"start":"08:30","end":"09:00","title":"Revisão Estratégica do Dia","focus":"trabalho_profundo","block_type":"admin","duration_minutes":30,"notes":"MT: Gestão","checklist":[{"text":"Conferir KPIs do dia anterior","done":false},{"text":"Revisar agenda do dia","done":false},{"text":"Definir 3 prioridades","done":false}]},
  {"start":"09:00","end":"09:30","title":"Check-in com Times","focus":"reuniao","block_type":"reuniao","duration_minutes":30,"notes":"MT: Gestão","checklist":[{"text":"Alinhar metas com Comercial","done":false},{"text":"Alinhar com Operacional","done":false},{"text":"Alinhar com Marketing","done":false}]},
  {"start":"09:30","end":"11:00","title":"Trabalho Profundo (Estratégia)","focus":"trabalho_profundo","block_type":"foco","duration_minutes":90,"notes":"MT: Gestão","checklist":[{"text":"Planejamento mensal/trimestral","done":false},{"text":"Análise financeira","done":false},{"text":"Tomada de decisão chave","done":false}]},
  {"start":"11:00","end":"12:00","title":"Reuniões Externas / Parcerias","focus":"reuniao","block_type":"reuniao","duration_minutes":60,"notes":"MT: Gestão","checklist":[{"text":"Reunião com parceiros","done":false},{"text":"Negociações estratégicas","done":false}]},
  {"start":"12:00","end":"13:30","title":"Almoço","focus":"pausa","block_type":"pausa","duration_minutes":90,"notes":"Pausa","checklist":[]},
  {"start":"13:30","end":"15:00","title":"Acompanhamento Operacional","focus":"atendimento","block_type":"admin","duration_minutes":90,"notes":"MT: Gestão","checklist":[{"text":"Revisar pedidos do dia","done":false},{"text":"Revisar estoque/produção","done":false},{"text":"Apoiar gargalos","done":false}]},
  {"start":"15:00","end":"16:30","title":"Desenvolvimento de Pessoas","focus":"reuniao","block_type":"reuniao","duration_minutes":90,"notes":"MT: Gestão","checklist":[{"text":"Feedback 1:1","done":false},{"text":"Treinamento de equipe","done":false}]},
  {"start":"16:30","end":"17:30","title":"Análise de Resultados","focus":"trabalho_profundo","block_type":"foco","duration_minutes":60,"notes":"MT: Gestão","checklist":[{"text":"Dashboard financeiro","done":false},{"text":"CRM e funil","done":false},{"text":"Indicadores operacionais","done":false}]},
  {"start":"17:30","end":"18:00","title":"Fechamento e Planejamento de Amanhã","focus":"trabalho_profundo","block_type":"admin","duration_minutes":30,"notes":"MT: Gestão","checklist":[{"text":"Revisar entregas do dia","done":false},{"text":"Definir prioridades de amanhã","done":false},{"text":"Mensagem de fechamento ao time","done":false}]}
]'::jsonb),

('operacional', 'MT Operacional / Produção', 'Rotina para responsável da produção: organização, execução, controle de qualidade e estoque.', 'Operacional / Produção', '🏭', '#F97316', true, 3,
'[
  {"start":"08:00","end":"08:30","title":"Abertura e Conferência","focus":"trabalho_profundo","block_type":"admin","duration_minutes":30,"notes":"MT: Operacional","checklist":[{"text":"Conferir ordens de produção do dia","done":false},{"text":"Conferir estoque de insumos","done":false},{"text":"Organizar bancadas","done":false}]},
  {"start":"08:30","end":"10:30","title":"Bloco de Produção 1","focus":"trabalho_profundo","block_type":"foco","duration_minutes":120,"notes":"MT: Operacional","checklist":[{"text":"Executar ordem prioritária","done":false},{"text":"Registrar produção no sistema","done":false}]},
  {"start":"10:30","end":"10:45","title":"Pausa","focus":"pausa","block_type":"pausa","duration_minutes":15,"notes":"Pausa","checklist":[]},
  {"start":"10:45","end":"12:00","title":"Bloco de Produção 2","focus":"trabalho_profundo","block_type":"foco","duration_minutes":75,"notes":"MT: Operacional","checklist":[{"text":"Continuar ordens","done":false},{"text":"Controle de qualidade","done":false}]},
  {"start":"12:00","end":"13:30","title":"Almoço","focus":"pausa","block_type":"pausa","duration_minutes":90,"notes":"Pausa","checklist":[]},
  {"start":"13:30","end":"15:30","title":"Bloco de Produção 3","focus":"trabalho_profundo","block_type":"foco","duration_minutes":120,"notes":"MT: Operacional","checklist":[{"text":"Finalizar ordens prioritárias","done":false},{"text":"Embalagem","done":false}]},
  {"start":"15:30","end":"16:30","title":"Conferência de Qualidade","focus":"trabalho_profundo","block_type":"foco","duration_minutes":60,"notes":"MT: Operacional","checklist":[{"text":"Checar acabamento","done":false},{"text":"Etiquetagem","done":false},{"text":"Separar para entrega","done":false}]},
  {"start":"16:30","end":"17:30","title":"Movimentação de Estoque","focus":"atendimento","block_type":"admin","duration_minutes":60,"notes":"MT: Operacional","checklist":[{"text":"Atualizar entradas/saídas","done":false},{"text":"Conferência física x sistema","done":false}]},
  {"start":"17:30","end":"18:00","title":"Fechamento do Dia","focus":"trabalho_profundo","block_type":"admin","duration_minutes":30,"notes":"MT: Operacional","checklist":[{"text":"Registrar pendências","done":false},{"text":"Organizar área de trabalho","done":false},{"text":"Planejar produção de amanhã","done":false}]}
]'::jsonb);
