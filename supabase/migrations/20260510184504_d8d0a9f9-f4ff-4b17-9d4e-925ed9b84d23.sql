-- 1) Novos campos no contato para "Saúde do Cliente"
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lifetime_value numeric(20,10) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_orders_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_purchase_date date,
  ADD COLUMN IF NOT EXISTS last_payment_date date;

-- 2) Trigger: pedido muda status -> sincroniza contato + timeline
CREATE OR REPLACE FUNCTION public.sync_contact_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  v_contact_id := NEW.contact_id;
  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só age quando o status muda
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'entregue' OR NEW.status = 'concluido' THEN
    UPDATE public.contacts
       SET funnel_status = CASE
             WHEN funnel_status IN ('cliente_ativo','vip') THEN funnel_status
             ELSE 'cliente_ativo'
           END,
           last_purchase_date = COALESCE(NEW.delivery_date, NEW.order_date, CURRENT_DATE),
           updated_at = now()
     WHERE id = v_contact_id;

    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
    VALUES (v_contact_id, 'order_delivered', 'venda',
            'Pedido ' || COALESCE(NEW.order_number, NEW.id::text) || ' entregue', now());
  ELSIF NEW.status = 'cancelado' THEN
    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
    VALUES (v_contact_id, 'order_cancelled', 'observacao',
            'Pedido ' || COALESCE(NEW.order_number, NEW.id::text) || ' cancelado', now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_on_order_change ON public.orders;
CREATE TRIGGER trg_sync_contact_on_order_change
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_on_order_change();

-- 3) Trigger: pagamento (financial_movements) quitou um pedido -> atualiza KPIs do contato
CREATE OR REPLACE FUNCTION public.sync_contact_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry record;
  v_order_contact uuid;
  v_total_paid numeric(20,10);
BEGIN
  SELECT * INTO v_entry FROM public.financial_entries WHERE id = NEW.entry_id;
  IF v_entry.id IS NULL OR v_entry.type <> 'receber' OR v_entry.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT contact_id INTO v_order_contact FROM public.orders WHERE id = v_entry.order_id;
  IF v_order_contact IS NULL THEN
    RETURN NEW;
  END IF;

  -- Total já pago neste lançamento (após o trigger update_entry_value_paid)
  SELECT COALESCE(SUM(value),0) INTO v_total_paid
    FROM public.financial_movements WHERE entry_id = v_entry.id;

  -- Só conta como "pedido pago" quando quita
  IF v_total_paid >= v_entry.value THEN
    UPDATE public.contacts
       SET lifetime_value = COALESCE(lifetime_value,0) + v_entry.value,
           paid_orders_count = COALESCE(paid_orders_count,0) + 1,
           last_payment_date = COALESCE(NEW.movement_date, CURRENT_DATE),
           client_classification = CASE
             WHEN COALESCE(paid_orders_count,0) + 1 >= 5
                  AND (client_classification IS NULL OR client_classification <> 'vip')
               THEN 'vip'
             ELSE client_classification
           END,
           updated_at = now()
     WHERE id = v_order_contact;

    INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
    VALUES (v_order_contact, 'payment_received', 'venda',
            'Pagamento confirmado: R$ ' || v_entry.value::text, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_on_payment ON public.financial_movements;
CREATE TRIGGER trg_sync_contact_on_payment
AFTER INSERT ON public.financial_movements
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_on_payment();

-- 4) Index úteis
CREATE INDEX IF NOT EXISTS idx_orders_contact_status ON public.orders(contact_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_order ON public.financial_entries(order_id);