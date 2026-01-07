-- Tabela de categorias financeiras
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pagar', 'receber', 'ambos')),
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contas bancárias/caixas
CREATE TABLE public.financial_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('caixa', 'banco', 'cartao')),
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  bank_name TEXT,
  agency TEXT,
  account_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela unificada de lançamentos (pagar e receber)
CREATE TABLE public.financial_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pagar', 'receber')),
  description TEXT NOT NULL,
  value NUMERIC NOT NULL,
  value_paid NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  payment_date DATE,
  category_id UUID REFERENCES public.financial_categories(id),
  account_id UUID REFERENCES public.financial_accounts(id),
  contact_id UUID REFERENCES public.contacts(id),
  order_id UUID REFERENCES public.orders(id),
  document_number TEXT,
  notes TEXT,
  is_conciliated BOOLEAN NOT NULL DEFAULT false,
  conciliated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações (baixas parciais/totais)
CREATE TABLE public.financial_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id),
  value NUMERIC NOT NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_financial_entries_type ON public.financial_entries(type);
CREATE INDEX idx_financial_entries_due_date ON public.financial_entries(due_date);
CREATE INDEX idx_financial_entries_status ON public.financial_entries(value, value_paid);
CREATE INDEX idx_financial_movements_entry ON public.financial_movements(entry_id);

-- Enable RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (ajustar conforme autenticação)
CREATE POLICY "Allow all on financial_categories" ON public.financial_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on financial_accounts" ON public.financial_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on financial_entries" ON public.financial_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on financial_movements" ON public.financial_movements FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar saldo da conta
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Atualiza saldo: + para receber, - para pagar
    UPDATE public.financial_accounts 
    SET current_balance = current_balance + (
      CASE 
        WHEN (SELECT type FROM public.financial_entries WHERE id = NEW.entry_id) = 'receber' THEN NEW.value
        ELSE -NEW.value
      END
    ),
    updated_at = now()
    WHERE id = NEW.account_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.financial_accounts 
    SET current_balance = current_balance - (
      CASE 
        WHEN (SELECT type FROM public.financial_entries WHERE id = OLD.entry_id) = 'receber' THEN OLD.value
        ELSE -OLD.value
      END
    ),
    updated_at = now()
    WHERE id = OLD.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_balance_on_movement
AFTER INSERT OR DELETE ON public.financial_movements
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- Trigger para atualizar value_paid no lançamento
CREATE OR REPLACE FUNCTION public.update_entry_value_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.financial_entries 
    SET value_paid = COALESCE((
      SELECT SUM(value) FROM public.financial_movements WHERE entry_id = NEW.entry_id
    ), 0),
    updated_at = now()
    WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.financial_entries 
    SET value_paid = COALESCE((
      SELECT SUM(value) FROM public.financial_movements WHERE entry_id = OLD.entry_id
    ), 0),
    updated_at = now()
    WHERE id = OLD.entry_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_value_paid_on_movement
AFTER INSERT OR UPDATE OR DELETE ON public.financial_movements
FOR EACH ROW EXECUTE FUNCTION public.update_entry_value_paid();

-- Inserir categorias padrão
INSERT INTO public.financial_categories (name, type) VALUES
  ('Vendas', 'receber'),
  ('Serviços', 'receber'),
  ('Outros Recebimentos', 'receber'),
  ('Fornecedores', 'pagar'),
  ('Salários', 'pagar'),
  ('Aluguel', 'pagar'),
  ('Impostos', 'pagar'),
  ('Utilidades', 'pagar'),
  ('Outros Pagamentos', 'pagar');

-- Inserir conta padrão
INSERT INTO public.financial_accounts (name, type, initial_balance, current_balance) VALUES
  ('Caixa Principal', 'caixa', 0, 0);