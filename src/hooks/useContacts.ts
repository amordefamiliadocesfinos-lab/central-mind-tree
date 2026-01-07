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
  
  // Other
  company_name?: string;
  notes?: string;
  is_active: boolean;
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
      setContacts(data || []);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (contact: Partial<Contact>) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          name: contact.name,
          fantasy_name: contact.fantasy_name,
          code: contact.code,
          type: contact.type || 'cliente',
          person_type: contact.person_type || 'fisica',
          document: contact.document,
          customer_since: contact.customer_since,
          taxpayer_type: contact.taxpayer_type,
          state_registration: contact.state_registration,
          rg: contact.rg,
          issuing_agency: contact.issuing_agency,
          zip_code: contact.zip_code,
          state: contact.state,
          city: contact.city,
          neighborhood: contact.neighborhood,
          address: contact.address,
          address_number: contact.address_number,
          address_complement: contact.address_complement,
          billing_zip_code: contact.billing_zip_code,
          billing_state: contact.billing_state,
          billing_city: contact.billing_city,
          billing_neighborhood: contact.billing_neighborhood,
          billing_address: contact.billing_address,
          billing_number: contact.billing_number,
          billing_complement: contact.billing_complement,
          contact_info: contact.contact_info,
          contact_people: contact.contact_people,
          phone: contact.phone,
          landline: contact.landline,
          fax: contact.fax,
          mobile: contact.mobile,
          mobile_carrier: contact.mobile_carrier,
          email: contact.email,
          nfe_email: contact.nfe_email,
          website: contact.website,
          skype: contact.skype,
          whatsapp: contact.whatsapp,
          next_visit: contact.next_visit,
          avg_load_percentage: contact.avg_load_percentage,
          marital_status: contact.marital_status,
          profession: contact.profession,
          gender: contact.gender,
          birth_date: contact.birth_date,
          birthplace: contact.birthplace,
          photo_url: contact.photo_url,
          father_name: contact.father_name,
          father_cpf: contact.father_cpf,
          mother_name: contact.mother_name,
          mother_cpf: contact.mother_cpf,
          contact_type: contact.contact_type,
          salesperson: contact.salesperson,
          default_operation_nature: contact.default_operation_nature,
          credit_limit_type: contact.credit_limit_type || 'unlimited',
          credit_limit_value: contact.credit_limit_value,
          payment_condition: contact.payment_condition,
          category: contact.category,
          company_name: contact.company_name,
          notes: contact.notes,
          is_active: contact.is_active ?? true,
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
