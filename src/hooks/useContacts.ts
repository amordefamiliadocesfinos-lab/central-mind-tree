import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Contact {
  id: string;
  name: string;
  fantasy_name?: string;
  code?: string;
  type: string; // 'cliente' | 'fornecedor' | 'ambos'
  person_type?: string; // 'fisica' | 'juridica'
  document?: string; // CPF or CNPJ
  customer_since?: string;
  taxpayer_type?: string;
  state_registration?: string;
  rg?: string;
  issuing_agency?: string;
  
  // Address
  zip_code?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  
  // Billing address
  billing_zip_code?: string;
  billing_state?: string;
  billing_city?: string;
  billing_neighborhood?: string;
  billing_address?: string;
  billing_number?: string;
  billing_complement?: string;
  
  // Contact
  contact_info?: string;
  contact_people?: any;
  phone?: string;
  landline?: string;
  fax?: string;
  mobile?: string;
  mobile_carrier?: string;
  email?: string;
  nfe_email?: string;
  website?: string;
  skype?: string;
  whatsapp?: string;
  next_visit?: string;
  
  // Additional data
  avg_load_percentage?: number;
  marital_status?: string;
  profession?: string;
  gender?: string;
  birth_date?: string;
  birthplace?: string;
  photo_url?: string;
  father_name?: string;
  father_cpf?: string;
  mother_name?: string;
  mother_cpf?: string;
  contact_type?: string;
  salesperson?: string;
  default_operation_nature?: string;
  
  // Financial
  credit_limit_type?: string; // 'unlimited' | 'zero' | 'custom'
  credit_limit_value?: number;
  payment_condition?: string;
  category?: string;
  
  // Sales channels journey
  sales_channels?: Array<{ platform_id: string; added_at: string }>;
  
  // Funnel
  funnel_status: string;
  temperatura_lead?: string; // 'frio' | 'morno' | 'quente'
  valor_estimado?: number;
  ultimo_contato?: string;
  origem_lead?: string;
  
  // Next action
  next_action_text?: string;
  next_action_date?: string;
  next_contact_date?: string;

  // Classification
  client_classification?: string; // 'vip' | 'alto_potencial' | 'medio' | 'baixo_potencial'

  // Other
  company_name?: string;
  notes?: string;
  is_active: boolean;
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setContacts((data || []) as unknown as Contact[]);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (contact: Partial<Contact>) => {
    try {
      // Helper to convert empty strings to null
      const cleanValue = (val: any) => (val === '' || val === undefined ? null : val);
      const cleanNumber = (val: any) => {
        if (val === '' || val === undefined || val === null) return null;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? null : num;
      };

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          name: contact.name,
          fantasy_name: cleanValue(contact.fantasy_name),
          code: cleanValue(contact.code),
          type: contact.type || 'cliente',
          person_type: contact.person_type || 'fisica',
          document: cleanValue(contact.document),
          customer_since: cleanValue(contact.customer_since),
          taxpayer_type: cleanValue(contact.taxpayer_type),
          state_registration: cleanValue(contact.state_registration),
          rg: cleanValue(contact.rg),
          issuing_agency: cleanValue(contact.issuing_agency),
          zip_code: cleanValue(contact.zip_code),
          state: cleanValue(contact.state),
          city: cleanValue(contact.city),
          neighborhood: cleanValue(contact.neighborhood),
          address: cleanValue(contact.address),
          address_number: cleanValue(contact.address_number),
          address_complement: cleanValue(contact.address_complement),
          billing_zip_code: cleanValue(contact.billing_zip_code),
          billing_state: cleanValue(contact.billing_state),
          billing_city: cleanValue(contact.billing_city),
          billing_neighborhood: cleanValue(contact.billing_neighborhood),
          billing_address: cleanValue(contact.billing_address),
          billing_number: cleanValue(contact.billing_number),
          billing_complement: cleanValue(contact.billing_complement),
          contact_info: cleanValue(contact.contact_info),
          contact_people: contact.contact_people,
          phone: cleanValue(contact.phone),
          landline: cleanValue(contact.landline),
          fax: cleanValue(contact.fax),
          mobile: cleanValue(contact.mobile),
          mobile_carrier: cleanValue(contact.mobile_carrier),
          email: cleanValue(contact.email),
          nfe_email: cleanValue(contact.nfe_email),
          website: cleanValue(contact.website),
          skype: cleanValue(contact.skype),
          whatsapp: cleanValue(contact.whatsapp),
          next_visit: cleanValue(contact.next_visit),
          avg_load_percentage: cleanNumber(contact.avg_load_percentage),
          marital_status: cleanValue(contact.marital_status),
          profession: cleanValue(contact.profession),
          gender: cleanValue(contact.gender),
          birth_date: cleanValue(contact.birth_date),
          birthplace: cleanValue(contact.birthplace),
          photo_url: cleanValue(contact.photo_url),
          father_name: cleanValue(contact.father_name),
          father_cpf: cleanValue(contact.father_cpf),
          mother_name: cleanValue(contact.mother_name),
          mother_cpf: cleanValue(contact.mother_cpf),
          contact_type: cleanValue(contact.contact_type),
          salesperson: cleanValue(contact.salesperson),
          default_operation_nature: cleanValue(contact.default_operation_nature),
          credit_limit_type: contact.credit_limit_type || 'unlimited',
          credit_limit_value: cleanNumber(contact.credit_limit_value),
          payment_condition: cleanValue(contact.payment_condition),
          category: cleanValue(contact.category),
          company_name: cleanValue(contact.company_name),
          notes: cleanValue(contact.notes),
          next_action_text: cleanValue(contact.next_action_text),
          next_action_date: cleanValue(contact.next_action_date),
          funnel_status: contact.funnel_status || 'novo_lead',
          next_contact_date: cleanValue(contact.next_contact_date),
          temperatura_lead: contact.temperatura_lead || 'morno',
          valor_estimado: cleanNumber(contact.valor_estimado),
          ultimo_contato: cleanValue(contact.ultimo_contato),
          origem_lead: cleanValue(contact.origem_lead),
          is_active: contact.is_active ?? true,
          client_classification: cleanValue(contact.client_classification),
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Contato criado com sucesso');
      await fetchContacts();
      return data;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast.error('Erro ao criar contato');
      throw error;
    }
  };

  const updateContact = async (id: string, contact: Partial<Contact>) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          ...contact,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Contato atualizado com sucesso');
      await fetchContacts();
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast.error('Erro ao atualizar contato');
      throw error;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Contato removido com sucesso');
      await fetchContacts();
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      toast.error('Erro ao remover contato');
      throw error;
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return {
    contacts,
    loading,
    fetchContacts,
    createContact,
    updateContact,
    deleteContact,
  };
}
