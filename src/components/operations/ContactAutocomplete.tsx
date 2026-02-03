import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User, Plus, Building2, Check, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  fantasy_name?: string;
  document?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  type: string;
}

interface ContactAutocompleteProps {
  value?: string;
  contactId?: string | null;
  onSelect: (contact: Contact | null, manualName?: string) => void;
  placeholder?: string;
  className?: string;
  allowManualEntry?: boolean;
}

export function ContactAutocomplete({
  value = '',
  contactId,
  onSelect,
  placeholder = 'Digite o nome do cliente...',
  className,
  allowManualEntry = true,
}: ContactAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch contacts on search
  useEffect(() => {
    const fetchContacts = async () => {
      if (!search || search.length < 2) {
        setContacts([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, name, fantasy_name, document, city, phone, whatsapp, type')
          .eq('is_active', true)
          .or(`name.ilike.%${search}%,fantasy_name.ilike.%${search}%,document.ilike.%${search}%`)
          .limit(10);

        if (error) throw error;
        setContacts(data || []);
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchContacts, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load selected contact by ID
  useEffect(() => {
    if (contactId && !selectedContact) {
      const loadContact = async () => {
        const { data } = await supabase
          .from('contacts')
          .select('id, name, fantasy_name, document, city, phone, whatsapp, type')
          .eq('id', contactId)
          .single();

        if (data) {
          setSelectedContact(data);
          setSearch(data.name);
        }
      };
      loadContact();
    }
  }, [contactId, selectedContact]);

  // Sync external value changes
  useEffect(() => {
    if (value !== search && !selectedContact) {
      setSearch(value);
    }
  }, [value]);

  const handleSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setSearch(contact.name);
    setOpen(false);
    onSelect(contact);
  };

  const handleManualEntry = () => {
    setSelectedContact(null);
    onSelect(null, search);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedContact(null);
    setSearch('');
    onSelect(null, '');
  };

  const formatDocument = (doc?: string) => {
    if (!doc) return '';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Input
            ref={inputRef}
            className="h-12 pr-10"
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedContact(null);
              if (!open && e.target.value.length >= 2) {
                setOpen(true);
              }
            }}
            onFocus={() => {
              if (search.length >= 2) {
                setOpen(true);
              }
            }}
          />
          {selectedContact && (
            <Badge 
              variant="secondary" 
              className="absolute right-2 top-1/2 -translate-y-1/2 gap-1"
            >
              <Check className="h-3 w-3" />
              Cadastrado
            </Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 w-[var(--radix-popover-trigger-width)]" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            ) : contacts.length === 0 && search.length >= 2 ? (
              <CommandEmpty>
                <div className="p-2 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente encontrado com "{search}"
                  </p>
                  {allowManualEntry && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleManualEntry}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Usar "{search}" como nome
                    </Button>
                  )}
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Clientes cadastrados">
                {contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={contact.id}
                    onSelect={() => handleSelect(contact)}
                    className="flex items-start gap-3 p-3 cursor-pointer"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {contact.type === 'fornecedor' ? (
                        <Building2 className="h-5 w-5 text-primary" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{contact.name}</div>
                      {contact.fantasy_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {contact.fantasy_name}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                        {contact.document && (
                          <span>{formatDocument(contact.document)}</span>
                        )}
                        {contact.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {contact.city}
                          </span>
                        )}
                        {(contact.phone || contact.whatsapp) && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {contact.whatsapp || contact.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {contact.type === 'fornecedor' ? 'Forn.' : 'Cliente'}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {allowManualEntry && contacts.length > 0 && search.length >= 2 && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleManualEntry}
                  className="justify-center text-muted-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Usar "{search}" sem cadastro
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
