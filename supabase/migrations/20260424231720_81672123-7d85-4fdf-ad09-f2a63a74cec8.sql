-- Tabela de Notas Fiscais
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT,
  invoice_type TEXT NOT NULL DEFAULT 'NFe', -- NFe, NFCe, NFSe
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, pronta, emitida, cancelada
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  customer_name TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  issue_date DATE,
  access_key TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_invoices_order ON public.invoices(order_id);
CREATE INDEX idx_invoices_contact ON public.invoices(contact_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);