import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ContactAddressPicker, type ContactAddress } from './ContactAddressPicker';
import type { DeliveryStop } from '@/hooks/useDeliveryRoutes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (data: Partial<DeliveryStop>) => Promise<void> | void;
}

const emptyForm = {
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
};

export function AddStopDialog({ open, onOpenChange, onAdd }: Props) {
  const [tab, setTab] = useState<'cliente' | 'manual'>('cliente');
  const [contact, setContact] = useState<ContactAddress | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Quando seleciona um cliente, pré-preenche os campos do formulário
  useEffect(() => {
    if (contact) {
      setForm((prev) => ({
        ...prev,
        customer_name: contact.name || '',
        phone: contact.whatsapp || contact.phone || '',
        address: contact.address || '',
        address_number: contact.address_number || '',
        neighborhood: contact.neighborhood || '',
        city: contact.city || '',
        state: contact.state || '',
        zip_code: contact.zip_code || '',
        complement: contact.address_complement || '',
      }));
    }
  }, [contact]);

  const reset = () => {
    setContact(null);
    setForm(emptyForm);
    setTab('cliente');
  };

  const handleAdd = async () => {
    if (!form.address.trim()) return;
    await onAdd({
      contact_id: contact?.id || null,
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
    reset();
    onOpenChange(false);
  };

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar parada</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as any);
            if (v === 'manual') setContact(null);
            if (v === 'cliente') setForm(emptyForm);
          }}
        >
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="cliente">Cliente cadastrado</TabsTrigger>
            <TabsTrigger value="manual">Endereço avulso</TabsTrigger>
          </TabsList>

          <TabsContent value="cliente" className="space-y-3 pt-3">
            <div>
              <Label className="mb-1.5 block">Cliente</Label>
              <ContactAddressPicker value={contact} onSelect={setContact} />
            </div>

            {contact && (
              <AddressFields form={form} update={update} prefilled />
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-3">
            <AddressFields form={form} update={update} showCustomerName />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!form.address.trim() || (tab === 'cliente' && !contact)}
          >
            Adicionar parada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddressFields({
  form,
  update,
  showCustomerName = false,
  prefilled = false,
}: {
  form: typeof emptyForm;
  update: (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  showCustomerName?: boolean;
  prefilled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {prefilled && (
        <p className="col-span-2 text-[11px] text-muted-foreground">
          Campos preenchidos automaticamente a partir do cadastro. Você pode editar se precisar.
        </p>
      )}
      {showCustomerName && (
        <div className="col-span-2">
          <Label>Nome do destinatário</Label>
          <Input value={form.customer_name} onChange={update('customer_name')} />
        </div>
      )}
      <div>
        <Label>Telefone</Label>
        <Input value={form.phone} onChange={update('phone')} placeholder="(11) 99999-9999" />
      </div>
      <div>
        <Label>CEP</Label>
        <Input value={form.zip_code} onChange={update('zip_code')} placeholder="00000-000" />
      </div>
      <div className="col-span-2">
        <Label>Endereço *</Label>
        <Input value={form.address} onChange={update('address')} placeholder="Rua, avenida..." />
      </div>
      <div>
        <Label>Número</Label>
        <Input value={form.address_number} onChange={update('address_number')} />
      </div>
      <div>
        <Label>Complemento</Label>
        <Input value={form.complement} onChange={update('complement')} placeholder="Apto, sala..." />
      </div>
      <div>
        <Label>Bairro</Label>
        <Input value={form.neighborhood} onChange={update('neighborhood')} />
      </div>
      <div>
        <Label>Cidade</Label>
        <Input value={form.city} onChange={update('city')} />
      </div>
      <div>
        <Label>Estado</Label>
        <Input value={form.state} onChange={update('state')} maxLength={2} placeholder="SP" />
      </div>
      <div className="col-span-2">
        <Label>Ponto de referência</Label>
        <Input
          value={form.reference_point}
          onChange={update('reference_point')}
          placeholder="Ex: ao lado da padaria"
        />
      </div>
      <div className="col-span-2">
        <Label>Observação</Label>
        <Textarea value={form.notes} onChange={update('notes')} rows={2} />
      </div>
    </div>
  );
}
