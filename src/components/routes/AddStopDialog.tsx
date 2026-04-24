import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ContactAutocomplete } from '@/components/operations/ContactAutocomplete';
import type { DeliveryStop } from '@/hooks/useDeliveryRoutes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (data: Partial<DeliveryStop>) => Promise<void> | void;
}

export function AddStopDialog({ open, onOpenChange, onAdd }: Props) {
  const [tab, setTab] = useState<'cliente' | 'manual'>('cliente');
  const [contact, setContact] = useState<any>(null);
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    address_number: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    complement: '',
    reference_point: '',
    notes: '',
  });

  const reset = () => {
    setContact(null);
    setForm({
      customer_name: '', phone: '', address: '', address_number: '', neighborhood: '',
      city: '', state: '', zip_code: '', complement: '', reference_point: '', notes: '',
    });
  };

  const handleAdd = async () => {
    if (tab === 'cliente' && contact) {
      await onAdd({
        contact_id: contact.id,
        customer_name: contact.name,
        phone: contact.whatsapp || contact.phone || null,
        address: contact.address || form.address || 'Endereço não informado',
        address_number: contact.address_number || null,
        neighborhood: contact.neighborhood || null,
        city: contact.city || null,
        state: contact.state || null,
        zip_code: contact.zip_code || null,
        complement: contact.address_complement || null,
        reference_point: form.reference_point || null,
        notes: form.notes || null,
      });
    } else {
      if (!form.address.trim()) return;
      await onAdd({
        customer_name: form.customer_name || null,
        phone: form.phone || null,
        address: form.address,
        address_number: form.address_number || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        complement: form.complement || null,
        reference_point: form.reference_point || null,
        notes: form.notes || null,
      });
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar parada</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="cliente">Cliente cadastrado</TabsTrigger>
            <TabsTrigger value="manual">Endereço avulso</TabsTrigger>
          </TabsList>

          <TabsContent value="cliente" className="space-y-3 pt-3">
            <ContactAutocomplete
              onSelect={(c) => setContact(c)}
              placeholder="Buscar cliente pelo nome, CPF/CNPJ..."
            />
            {contact && (
              <div className="text-xs text-muted-foreground space-y-0.5 p-3 rounded-md bg-muted">
                <p><span className="font-medium text-foreground">Endereço:</span> {contact.address || '—'}</p>
                <p><span className="font-medium text-foreground">Cidade:</span> {contact.city || '—'} / {contact.state || '—'}</p>
                <p><span className="font-medium text-foreground">Telefone:</span> {contact.whatsapp || contact.phone || '—'}</p>
                {!contact.address && (
                  <p className="text-amber-600 dark:text-amber-400 mt-2">⚠️ Cliente sem endereço cadastrado. Use a aba Manual.</p>
                )}
              </div>
            )}
            <div>
              <Label>Ponto de referência</Label>
              <Input
                value={form.reference_point}
                onChange={(e) => setForm({ ...form, reference_point: e.target.value })}
                placeholder="Ex: ao lado da padaria"
              />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome do destinatário</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Endereço *</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Rua, avenida..."
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
              </div>
              <div className="col-span-2">
                <Label>Ponto de referência</Label>
                <Input value={form.reference_point} onChange={(e) => setForm({ ...form, reference_point: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observação</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleAdd}
            disabled={(tab === 'cliente' && !contact) || (tab === 'manual' && !form.address.trim())}
          >
            Adicionar parada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
