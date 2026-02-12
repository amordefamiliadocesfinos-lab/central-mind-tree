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
import { CalendarIcon, Loader2, Search, MessageCircle, Plus, X, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePlatforms } from '@/hooks/usePlatforms';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Contact } from '@/hooks/useContacts';
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

const MOBILE_CARRIERS = [
  'Vivo', 'Claro', 'Tim', 'Oi', 'Outros'
];

const MARITAL_STATUS = [
  'Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'Separado(a)', 'União Estável'
];

const GENDERS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
];

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: ContactFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [addressTab, setAddressTab] = useState('geral');
  const { activePlatforms } = usePlatforms();
  
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
    is_active: true,
  });

  useEffect(() => {
    if (contact) {
      setForm({ ...contact });
    } else {
      setForm({
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
        is_active: true,
      });
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
      // Error is handled in the hook
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
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      if (isBilling) {
        setForm(prev => ({
          ...prev,
          billing_zip_code: cleanCep,
          billing_state: data.uf,
          billing_city: data.localidade,
          billing_neighborhood: data.bairro,
          billing_address: data.logradouro,
        }));
      } else {
        setForm(prev => ({
          ...prev,
          zip_code: cleanCep,
          state: data.uf,
          city: data.localidade,
          neighborhood: data.bairro,
          address: data.logradouro,
        }));
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    }
  };

  const updateField = (field: keyof Contact, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleWhatsAppClick = () => {
    const phone = form.whatsapp || form.mobile || form.phone;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>
            {contact ? 'Editar' : 'Novo'} Cliente ou Fornecedor
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogHeader>

        <div className="text-sm text-muted-foreground text-right">
          (*) Campos obrigatórios
        </div>

        <div className="space-y-6">
          {/* Dados Cadastrais */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Dados cadastrais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={form.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fantasy_name">Fantasia</Label>
                <Input
                  id="fantasy_name"
                  value={form.fantasy_name || ''}
                  onChange={(e) => updateField('fantasy_name', e.target.value)}
                  placeholder="Nome fantasia"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={form.code || ''}
                  onChange={(e) => updateField('code', e.target.value)}
                  placeholder="Código interno"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Pessoa</Label>
                <Select 
                  value={form.person_type || 'fisica'} 
                  onValueChange={(v) => updateField('person_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Pessoa Física</SelectItem>
                    <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document">
                  {form.person_type === 'juridica' ? 'CNPJ' : 'CPF'}
                </Label>
                <Input
                  id="document"
                  value={form.document || ''}
                  onChange={(e) => updateField('document', e.target.value)}
                  placeholder={form.person_type === 'juridica' ? '00.000.000/0000-00' : '000.000.000-00'}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Cliente desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.customer_since 
                        ? format(parseISO(form.customer_since), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.customer_since ? parseISO(form.customer_since) : undefined}
                      onSelect={(date) => updateField('customer_since', date?.toISOString().split('T')[0])}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Contribuinte</Label>
                <Select 
                  value={form.taxpayer_type || '9'} 
                  onValueChange={(v) => updateField('taxpayer_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAXPAYER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="state_registration">Inscrição Estadual</Label>
                <Input
                  id="state_registration"
                  value={form.state_registration || ''}
                  onChange={(e) => updateField('state_registration', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input
                  id="rg"
                  value={form.rg || ''}
                  onChange={(e) => updateField('rg', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="issuing_agency">Órgão Emissor</Label>
                <Input
                  id="issuing_agency"
                  value={form.issuing_agency || ''}
                  onChange={(e) => updateField('issuing_agency', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Endereço</h3>
            
            <Tabs value={addressTab} onValueChange={setAddressTab}>
              <TabsList>
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
              </TabsList>
              
              <TabsContent value="geral" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">CEP</Label>
                    <div className="relative">
                      <Input
                        id="zip_code"
                        value={form.zip_code || ''}
                        onChange={(e) => updateField('zip_code', e.target.value)}
                        onBlur={(e) => handleCepSearch(e.target.value)}
                        placeholder="00000-000"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => handleCepSearch(form.zip_code || '')}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Select 
                      value={form.state || ''} 
                      onValueChange={(v) => updateField('state', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={form.city || ''}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      value={form.neighborhood || ''}
                      onChange={(e) => updateField('neighborhood', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1 space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={form.address || ''}
                      onChange={(e) => updateField('address', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_number">Número</Label>
                    <Input
                      id="address_number"
                      value={form.address_number || ''}
                      onChange={(e) => updateField('address_number', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_complement">Complemento</Label>
                    <Input
                      id="address_complement"
                      value={form.address_complement || ''}
                      onChange={(e) => updateField('address_complement', e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="cobranca" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing_zip_code">CEP</Label>
                    <div className="relative">
                      <Input
                        id="billing_zip_code"
                        value={form.billing_zip_code || ''}
                        onChange={(e) => updateField('billing_zip_code', e.target.value)}
                        onBlur={(e) => handleCepSearch(e.target.value, true)}
                        placeholder="00000-000"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => handleCepSearch(form.billing_zip_code || '', true)}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Select 
                      value={form.billing_state || ''} 
                      onValueChange={(v) => updateField('billing_state', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="billing_city">Cidade</Label>
                    <Input
                      id="billing_city"
                      value={form.billing_city || ''}
                      onChange={(e) => updateField('billing_city', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="billing_neighborhood">Bairro</Label>
                    <Input
                      id="billing_neighborhood"
                      value={form.billing_neighborhood || ''}
                      onChange={(e) => updateField('billing_neighborhood', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1 space-y-2">
                    <Label htmlFor="billing_address">Endereço</Label>
                    <Input
                      id="billing_address"
                      value={form.billing_address || ''}
                      onChange={(e) => updateField('billing_address', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="billing_number">Número</Label>
                    <Input
                      id="billing_number"
                      value={form.billing_number || ''}
                      onChange={(e) => updateField('billing_number', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="billing_complement">Complemento</Label>
                    <Input
                      id="billing_complement"
                      value={form.billing_complement || ''}
                      onChange={(e) => updateField('billing_complement', e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </section>

          {/* Contato */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Contato</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact_info">Informações do contato</Label>
                <Input
                  id="contact_info"
                  value={form.contact_info || ''}
                  onChange={(e) => updateField('contact_info', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="landline">Fone</Label>
                  <Input
                    id="landline"
                    value={form.landline || ''}
                    onChange={(e) => updateField('landline', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={form.fax || ''}
                    onChange={(e) => updateField('fax', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mobile">Celular</Label>
                  <Input
                    id="mobile"
                    value={form.mobile || ''}
                    onChange={(e) => updateField('mobile', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Operadora</Label>
                  <Select 
                    value={form.mobile_carrier || ''} 
                    onValueChange={(v) => updateField('mobile_carrier', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Operadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOBILE_CARRIERS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp
                  </Label>
                  <div className="relative">
                    <Input
                      id="whatsapp"
                      value={form.whatsapp || ''}
                      onChange={(e) => updateField('whatsapp', e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                    {form.whatsapp && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        className="absolute right-0 top-0 text-green-600 hover:text-green-700"
                        onClick={handleWhatsAppClick}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nfe_email">E-Mail para envio da NFe</Label>
                  <Input
                    id="nfe_email"
                    type="email"
                    value={form.nfe_email || ''}
                    onChange={(e) => updateField('nfe_email', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="website">WebSite</Label>
                  <Input
                    id="website"
                    value={form.website || ''}
                    onChange={(e) => updateField('website', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Próxima visita</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.next_visit 
                          ? format(parseISO(form.next_visit), 'dd/MM/yyyy', { locale: ptBR })
                          : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.next_visit ? parseISO(form.next_visit) : undefined}
                        onSelect={(date) => updateField('next_visit', date?.toISOString().split('T')[0])}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </section>

          {/* Dados Adicionais */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Dados adicionais</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Estado civil</Label>
                <Select 
                  value={form.marital_status || ''} 
                  onValueChange={(v) => updateField('marital_status', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_STATUS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profession">Profissão</Label>
                <Input
                  id="profession"
                  value={form.profession || ''}
                  onChange={(e) => updateField('profession', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select 
                  value={form.gender || ''} 
                  onValueChange={(v) => updateField('gender', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Data Nascimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.birth_date 
                        ? format(parseISO(form.birth_date), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.birth_date ? parseISO(form.birth_date) : undefined}
                      onSelect={(date) => updateField('birth_date', date?.toISOString().split('T')[0])}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="birthplace">Naturalidade</Label>
                <Input
                  id="birthplace"
                  value={form.birthplace || ''}
                  onChange={(e) => updateField('birthplace', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="father_name">Nome do Pai</Label>
                <Input
                  id="father_name"
                  value={form.father_name || ''}
                  onChange={(e) => updateField('father_name', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="father_cpf">CPF do Pai</Label>
                <Input
                  id="father_cpf"
                  value={form.father_cpf || ''}
                  onChange={(e) => updateField('father_cpf', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mother_name">Nome da Mãe</Label>
                <Input
                  id="mother_name"
                  value={form.mother_name || ''}
                  onChange={(e) => updateField('mother_name', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mother_cpf">CPF da Mãe</Label>
                <Input
                  id="mother_cpf"
                  value={form.mother_cpf || ''}
                  onChange={(e) => updateField('mother_cpf', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="contact_type">Tipo de Contato</Label>
                <Input
                  id="contact_type"
                  value={form.contact_type || ''}
                  onChange={(e) => updateField('contact_type', e.target.value)}
                  placeholder="Adicionar contato"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select 
                  value={form.is_active ? 'ativo' : 'inativo'} 
                  onValueChange={(v) => updateField('is_active', v === 'ativo')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="salesperson">Vendedor</Label>
                <Input
                  id="salesperson"
                  value={form.salesperson || ''}
                  onChange={(e) => updateField('salesperson', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Financeiro */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Financeiro</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Limite de crédito</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.credit_limit_type === 'unlimited'}
                      onCheckedChange={(checked) => updateField('credit_limit_type', checked ? 'unlimited' : 'custom')}
                    />
                    <span className="text-sm">Ilimitado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.credit_limit_type === 'zero'}
                      onCheckedChange={(checked) => updateField('credit_limit_type', checked ? 'zero' : 'unlimited')}
                    />
                    <span className="text-sm">Limite zero</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_condition">Condição de pagamento</Label>
                  <Input
                    id="payment_condition"
                    value={form.payment_condition || ''}
                    onChange={(e) => updateField('payment_condition', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={form.category || ''} 
                    onValueChange={(v) => updateField('category', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
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
            <h3 className="text-lg font-semibold mb-4">Canais de Venda (Jornada)</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Rastreie por quais canais/plataformas este cliente chegou até você. Ex: Google → Instagram → WhatsApp
            </p>
            
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
                <div className="space-y-3">
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
                              <button onClick={() => removeChannel(i)} className="ml-0.5 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Select value="__none__" onValueChange={(v) => { if (v !== '__none__') addChannel(v); }}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="+ Adicionar canal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">+ Adicionar canal...</SelectItem>
                      {activePlatforms.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
          </section>

          {/* Observações */}
          <section>
            <h3 className="text-lg font-semibold mb-4">Observações</h3>
            <Textarea
              value={form.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
              placeholder="Observações gerais sobre o contato..."
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
