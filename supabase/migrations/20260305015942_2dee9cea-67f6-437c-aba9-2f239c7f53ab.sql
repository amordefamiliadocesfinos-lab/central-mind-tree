-- Migrate old funnel_status values to new ones
UPDATE contacts SET funnel_status = 'contato_realizado' WHERE funnel_status = 'orcamento_enviado';
UPDATE contacts SET funnel_status = 'proposta_enviada' WHERE funnel_status = 'em_negociacao';
UPDATE contacts SET funnel_status = 'fechado' WHERE funnel_status = 'cliente';
UPDATE contacts SET funnel_status = 'perdido' WHERE funnel_status = 'perdido';
UPDATE contacts SET funnel_status = 'negociacao' WHERE funnel_status = 'pos_venda';

-- Update default
ALTER TABLE contacts ALTER COLUMN funnel_status SET DEFAULT 'novo_lead';