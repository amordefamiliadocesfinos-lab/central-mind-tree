import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Loader2, Search, MessageCircle, Plus, X, ChevronRight, ChevronDown, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { usePlatforms } from '@/hooks/usePlatforms';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { ContactOrdersList } from '@/components/crm/ContactOrdersList';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Contact } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { useContactsWithOrders } from '@/hooks/useContactsWithOrders';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  onSave: (data: Partial<Contact>) => Promise<void>;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const TAXPAYER_TYPES = [
  { value: '1', label: '1 - Contribuinte ICMS' },
  { value: '2', label: '2 - Contribuinte isento' },
  { value: '9', label: '9 - Não contribuinte' },
];

const MOBILE_CARRIERS = ['Vivo', 'Claro', 'Tim', 'Oi', 'Outros'];

const MARITAL_STATUS = [
  'Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'Separado(a)', 'União Estável'
];

const GENDERS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
];

const CONTACT_SUBTYPES = [
  { value: 'revendedor', label: 'Revendedor' },
  { value: 'cliente_final', label: 'Cliente Final' },
  { value: 'atacado', label: 'Atacado' },
];

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: ContactFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [addressTab, setAddressTab] = useState('geral');
  const [showDetails, setShowDetails] = useState(false);
  const { addEntry } = useContactHistory();
  const navigate = useNavigate();
  const { activePlatforms } = usePlatforms();
  const { hasOrders } = useContactsWithOrders();
  
  const [form, setForm] = useState<Partial<Contact>>({
    name: '',
    fantasy_name: '',
    code: '',
    type: 'cliente',
    person_type: 'fisica',
    document: '',
    customer_since: new Date().toISOString().split('T')[0],
    taxpayer_type: '9',
    state_registration: '',
    rg: '',
    issuing_agency: '',
    zip_code: '',
    state: '',
    city: '',
    neighborhood: '',
    address: '',
    address_number: '',
    address_complement: '',
    billing_zip_code: '',
    billing_state: '',
    billing_city: '',
    billing_neighborhood: '',
    billing_address: '',
    billing_number: '',
    billing_complement: '',
    contact_info: '',
    phone: '',
    landline: '',
    fax: '',
    mobile: '',
    mobile_carrier: '',
    email: '',
    nfe_email: '',
    website: '',
    skype: '',
    whatsapp: '',
    next_visit: '',
    avg_load_percentage: undefined,
    marital_status: '',
    profession: '',
    gender: '',
    birth_date: '',
    birthplace: '',
    father_name: '',
    father_cpf: '',
    mother_name: '',
    mother_cpf: '',
    contact_type: '',
    salesperson: '',
    default_operation_nature: '',
    credit_limit_type: 'unlimited',
    credit_limit_value: undefined,
    payment_condition: '',
    category: '',
    notes: '',
    next_action_text: '',
    next_action_date: '',
    is_active: true,
  });

  useEffect(() => {
    if (contact) {
      setForm({ ...contact });
      // Auto-expand details if contact has detail fields filled
      const hasDetails = contact.document || contact.rg || contact.email || contact.person_type === 'juridica';
      setShowDetails(!!hasDetails);
    } else {
      setForm({
        name: '', fantasy_name: '', code: '', type: 'cliente', person_type: 'fisica',
        document: '', customer_since: new Date().toISOString().split('T')[0], taxpayer_type: '9',
        state_registration: '', rg: '', issuing_agency: '', zip_code: '', state: '',
        city: '', neighborhood: '', address: '', address_number: '', address_complement: '',
        billing_zip_code: '', billing_state: '', billing_city: '', billing_neighborhood: '',
        billing_address: '', billing_number: '', billing_complement: '', contact_info: '',
        phone: '', landline: '', fax: '', mobile: '', mobile_carrier: '', email: '',
        nfe_email: '', website: '', skype: '', whatsapp: '', next_visit: '',
        avg_load_percentage: undefined, marital_status: '', profession: '', gender: '',
        birth_date: '', birthplace: '', father_name: '', father_cpf: '', mother_name: '',
        mother_cpf: '', contact_type: '', salesperson: '', default_operation_nature: '',
        credit_limit_type: 'unlimited', credit_limit_value: undefined, payment_condition: '',
        category: '', notes: '', next_action_text: '', next_action_date: '', is_active: true,
      });
      setShowDetails(false);
    }
  }, [contact, open]);

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setLoading(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (error) {
      // handled in hook
    } finally {
      setLoading(false);
    }
  };

  const handleCepSearch = async (cep: string, isBilling = false) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      if (isBilling) {
        setForm(prev => ({ ...prev, billing_zip_code: cleanCep, billing_state: data.uf, billing_city: data.localidade, billing_neighborhood: data.bairro, billing_address: data.logradouro }));
      } else {
        setForm(prev => ({ ...prev, zip_code: cleanCep, state: data.uf, city: data.localidade, neighborhood: data.bairro, address: data.logradouro }));
      }
    } catch { toast.error('Erro ao buscar CEP'); }
  };

  const updateField = (field: keyof Contact, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleWhatsAppClick = async () => {
    const phone = form.whatsapp || form.mobile || form.phone;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      const message = encodeURIComponent(
        'Olá, tudo bem?\nAqui é da Amor de Família Doces Finos e Artesanais.\nEstou entrando em contato para saber se posso ajudar com seu pedido ou orçamento.'
      );
      if (contact?.id) {
        await addEntry(contact.id, 'whatsapp', '💬 Contato realizado via WhatsApp', new Date().toISOString());
      }
      window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>
            {contact ? 'Editar' : 'Novo'} Contato
          </DialogTitle>
          <div className="flex items-center gap-2">
            {contact && ['negociacao', 'proposta_enviada', 'contato_realizado'].includes(contact.funnel_status) && (
              <Button
                variant="outline"
                className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  const params = new URLSearchParams({
                    tab: 'orders',
                    newOrder: 'true',
                    contactId: contact.id,
                    contactName: contact.name || '',
                    contactPhone: contact.phone || contact.whatsapp || contact.mobile || '',
                    contactEmail: contact.email || '',
                    ...(contact.notes ? { contactNotes: contact.notes } : {}),
                  });
                  onOpenChange(false);
                  navigate(`/operacoes?${params.toString()}`);
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Converter em Pedido
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* === ESSENCIAL === */}
          <section className="space-y-4">
            <div className="flex items-start gap-4">
              <ContactAvatar
                photoUrl={form.photo_url}
                name={form.name}
                size="lg"
                editable
                onPhotoChange={(url) => updateField('photo_url', url)}
              />
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} placeholder="Nome do contato" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo de Contato</Label>
                    <Select value={form.contact_type || ''} onValueChange={(v) => updateField('contact_type', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_SUBTYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente/Forn.</Label>
                    <Select value={form.type || 'cliente'} onValueChange={(v) => updateField('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Classificação do Cliente</Label>
                  <Select value={form.client_classification || ''} onValueChange={(v) => updateField('client_classification' as any, v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vip">🟢 Cliente VIP</SelectItem>
                      <SelectItem value="alto_potencial">🔵 Cliente Alto Potencial</SelectItem>
                      <SelectItem value="medio">🟡 Cliente Médio</SelectItem>
                      <SelectItem value="baixo_potencial">⚪ Cliente Baixo Potencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  WhatsApp
                </Label>
                <div className="relative">
                  <Input id="whatsapp" value={form.whatsapp || ''} onChange={(e) => updateField('whatsapp', e.target.value)} placeholder="(00) 00000-0000" />
                  {form.whatsapp && (
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 text-green-600 hover:text-green-700" onClick={handleWhatsAppClick}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cidade / Bairro</Label>
                <div className="flex gap-2">
                  <Input value={form.city || ''} onChange={(e) => updateField('city', e.target.value)} placeholder="Cidade" className="flex-1" />
                  <Input value={form.neighborhood || ''} onChange={(e) => updateField('neighborhood', e.target.value)} placeholder="Bairro" className="flex-1" />
                </div>
              </div>
            </div>

            {/* Próxima Ação */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próxima Ação</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input 
                  value={form.next_action_text || ''} 
                  onChange={(e) => updateField('next_action_text' as any, e.target.value)} 
                  placeholder="Ex: Ligar para confirmar pedido"
                />
                <Input 
                  type="datetime-local" 
                  value={form.next_action_date ? (() => { try { const d = parseISO(form.next_action_date); return format(d, "yyyy-MM-dd'T'HH:mm"); } catch { return ''; } })() : ''}
                  onChange={(e) => updateField('next_action_date' as any, e.target.value ? new Date(e.target.value).toISOString() : '')}
                />
              </div>
            </div>

            {/* Próximo Contato */}
            <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">📞 Próximo Contato</Label>
              <Input 
                type="datetime-local" 
                value={form.next_contact_date ? (() => { try { const d = parseISO(form.next_contact_date); return format(d, "yyyy-MM-dd'T'HH:mm"); } catch { return ''; } })() : ''}
                onChange={(e) => updateField('next_contact_date' as any, e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
              <p className="text-[10px] text-muted-foreground">Agende quando entrar em contato novamente com este cliente</p>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2} placeholder="Observações gerais..." />
            </div>
          </section>

          {/* === MAIS DETALHES (colapsável) === */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground hover:text-foreground">
                <span>Mais detalhes (CPF, endereço, financeiro...)</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-2">
              {/* Dados Cadastrais */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Dados cadastrais</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fantasia</Label>
                    <Input value={form.fantasy_name || ''} onChange={(e) => updateField('fantasy_name', e.target.value)} placeholder="Nome fantasia" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Código</Label>
                    <Input value={form.code || ''} onChange={(e) => updateField('code', e.target.value)} placeholder="Código interno" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de Pessoa</Label>
                    <Select value={form.person_type || 'fisica'} onValueChange={(v) => updateField('person_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fisica">Pessoa Física</SelectItem>
                        <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>{form.person_type === 'juridica' ? 'CNPJ' : 'CPF'}</Label>
                    <Input value={form.document || ''} onChange={(e) => updateField('document', e.target.value)} placeholder={form.person_type === 'juridica' ? '00.000.000/0000-00' : '000.000.000-00'} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>RG</Label>
                    <Input value={form.rg || ''} onChange={(e) => updateField('rg', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Órgão Emissor</Label>
                    <Input value={form.issuing_agency || ''} onChange={(e) => updateField('issuing_agency', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente desde</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.customer_since ? format(parseISO(form.customer_since), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={form.customer_since ? parseISO(form.customer_since) : undefined} onSelect={(date) => updateField('customer_since', date?.toISOString().split('T')[0])} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>Contribuinte</Label>
                    <Select value={form.taxpayer_type || '9'} onValueChange={(v) => updateField('taxpayer_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TAXPAYER_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Inscrição Estadual</Label>
                    <Input value={form.state_registration || ''} onChange={(e) => updateField('state_registration', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendedor</Label>
                    <Input value={form.salesperson || ''} onChange={(e) => updateField('salesperson', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Contato */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Contato</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={form.phone || ''} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Celular</Label>
                    <Input value={form.mobile || ''} onChange={(e) => updateField('mobile', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fone fixo</Label>
                    <Input value={form.landline || ''} onChange={(e) => updateField('landline', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>E-Mail NFe</Label>
                    <Input type="email" value={form.nfe_email || ''} onChange={(e) => updateField('nfe_email', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input value={form.website || ''} onChange={(e) => updateField('website', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Operadora</Label>
                    <Select value={form.mobile_carrier || ''} onValueChange={(v) => updateField('mobile_carrier', v)}>
                      <SelectTrigger><SelectValue placeholder="Operadora" /></SelectTrigger>
                      <SelectContent>
                        {MOBILE_CARRIERS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Próxima visita</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.next_visit ? format(parseISO(form.next_visit), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={form.next_visit ? parseISO(form.next_visit) : undefined} onSelect={(date) => updateField('next_visit', date?.toISOString().split('T')[0])} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Endereço</h3>
                <Tabs value={addressTab} onValueChange={setAddressTab}>
                  <TabsList>
                    <TabsTrigger value="geral">Geral</TabsTrigger>
                    <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
                  </TabsList>
                  <TabsContent value="geral" className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label>CEP</Label>
                        <div className="relative">
                          <Input value={form.zip_code || ''} onChange={(e) => updateField('zip_code', e.target.value)} onBlur={(e) => handleCepSearch(e.target.value)} placeholder="00000-000" />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => handleCepSearch(form.zip_code || '')}><Search className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>UF</Label>
                        <Select value={form.state || ''} onValueChange={(v) => updateField('state', v)}>
                          <SelectTrigger><SelectValue placeholder="UF..." /></SelectTrigger>
                          <SelectContent>{BRAZILIAN_STATES.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input value={form.city || ''} onChange={(e) => updateField('city', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input value={form.neighborhood || ''} onChange={(e) => updateField('neighborhood', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Endereço</Label>
                        <Input value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input value={form.address_number || ''} onChange={(e) => updateField('address_number', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input value={form.address_complement || ''} onChange={(e) => updateField('address_complement', e.target.value)} />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="cobranca" className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label>CEP</Label>
                        <div className="relative">
                          <Input value={form.billing_zip_code || ''} onChange={(e) => updateField('billing_zip_code', e.target.value)} onBlur={(e) => handleCepSearch(e.target.value, true)} placeholder="00000-000" />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => handleCepSearch(form.billing_zip_code || '', true)}><Search className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>UF</Label>
                        <Select value={form.billing_state || ''} onValueChange={(v) => updateField('billing_state', v)}>
                          <SelectTrigger><SelectValue placeholder="UF..." /></SelectTrigger>
                          <SelectContent>{BRAZILIAN_STATES.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cidade</Label>
                        <Input value={form.billing_city || ''} onChange={(e) => updateField('billing_city', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bairro</Label>
                        <Input value={form.billing_neighborhood || ''} onChange={(e) => updateField('billing_neighborhood', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Endereço</Label>
                        <Input value={form.billing_address || ''} onChange={(e) => updateField('billing_address', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Número</Label>
                        <Input value={form.billing_number || ''} onChange={(e) => updateField('billing_number', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Complemento</Label>
                        <Input value={form.billing_complement || ''} onChange={(e) => updateField('billing_complement', e.target.value)} />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>

              {/* Dados Adicionais */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Dados adicionais</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label>Estado civil</Label>
                    <Select value={form.marital_status || ''} onValueChange={(v) => updateField('marital_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{MARITAL_STATUS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Profissão</Label>
                    <Input value={form.profession || ''} onChange={(e) => updateField('profession', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sexo</Label>
                    <Select value={form.gender || ''} onValueChange={(v) => updateField('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{GENDERS.map(g => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data Nascimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.birth_date ? format(parseISO(form.birth_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={form.birth_date ? parseISO(form.birth_date) : undefined} onSelect={(date) => updateField('birth_date', date?.toISOString().split('T')[0])} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label>Naturalidade</Label>
                    <Input value={form.birthplace || ''} onChange={(e) => updateField('birthplace', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome do Pai</Label>
                    <Input value={form.father_name || ''} onChange={(e) => updateField('father_name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome da Mãe</Label>
                    <Input value={form.mother_name || ''} onChange={(e) => updateField('mother_name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Situação</Label>
                    <Select value={form.is_active ? 'ativo' : 'inativo'} onValueChange={(v) => updateField('is_active', v === 'ativo')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Financeiro</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Limite de crédito</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={form.credit_limit_type === 'unlimited'} onCheckedChange={(checked) => updateField('credit_limit_type', checked ? 'unlimited' : 'custom')} />
                        <span className="text-sm">Ilimitado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={form.credit_limit_type === 'zero'} onCheckedChange={(checked) => updateField('credit_limit_type', checked ? 'zero' : 'unlimited')} />
                        <span className="text-sm">Limite zero</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Condição de pagamento</Label>
                      <Input value={form.payment_condition || ''} onChange={(e) => updateField('payment_condition', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <Select value={form.category || ''} onValueChange={(v) => updateField('category', v)}>
                        <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_categoria">Sem categoria</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="novo">Novo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Canais de Venda */}
              <section>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Canais de Venda (Jornada)</h3>
                <p className="text-xs text-muted-foreground mb-2">Rastreie por quais canais este cliente chegou até você.</p>
                {(() => {
                  const channels: Array<{ platform_id: string; added_at: string }> = (form.sales_channels as any) || [];
                  const getPlatformInfo = (id: string) => activePlatforms.find(p => p.id === id);
                  const addChannel = (platformId: string) => {
                    const updated = [...channels, { platform_id: platformId, added_at: new Date().toISOString() }];
                    updateField('sales_channels' as any, updated);
                  };
                  const removeChannel = (index: number) => {
                    const updated = channels.filter((_, i) => i !== index);
                    updateField('sales_channels' as any, updated);
                  };
                  return (
                    <div className="space-y-2">
                      {channels.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {channels.map((ch, i) => {
                            const p = getPlatformInfo(ch.platform_id);
                            return (
                              <div key={i} className="flex items-center">
                                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
                                <Badge variant="secondary" className="text-xs gap-1 pr-1">
                                  <span>{p?.icon || '📱'}</span>
                                  <span>{p?.name || 'Canal'}</span>
                                  <button onClick={() => removeChannel(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <Select value="__none__" onValueChange={(v) => { if (v !== '__none__') addChannel(v); }}>
                        <SelectTrigger className="w-[220px]"><SelectValue placeholder="+ Adicionar canal..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">+ Adicionar canal...</SelectItem>
                          {activePlatforms.map(p => (<SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}
              </section>
            </CollapsibleContent>
          </Collapsible>

          {/* Pedidos do Cliente */}
          {contact && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                Pedidos do Cliente
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <ContactOrdersList contactId={contact.id} onClose={() => onOpenChange(false)} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Timeline */}
          {contact && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                Timeline
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <ContactTimeline contactId={contact.id} createdAt={contact.created_at} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
