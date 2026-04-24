import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { User, Building2, MapPin, Phone, Check, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContactAddress {
  id: string;
  name: string;
  fantasy_name?: string | null;
  type: string;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

interface Props {
  value?: ContactAddress | null;
  onSelect: (contact: ContactAddress | null) => void;
  placeholder?: string;
  className?: string;
}

export function ContactAddressPicker({
  value,
  onSelect,
  placeholder = 'Buscar cliente pelo nome, CPF/CNPJ...',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ContactAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) return;
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select(
          'id, name, fantasy_name, type, phone, whatsapp, address, address_number, address_complement, neighborhood, city, state, zip_code'
        )
        .eq('is_active', true)
        .or(`name.ilike.%${search}%,fantasy_name.ilike.%${search}%,document.ilike.%${search}%`)
        .limit(15);

      if (!error && data) setResults(data as ContactAddress[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, value]);

  const handlePick = (c: ContactAddress) => {
    onSelect(c);
    setOpen(false);
    setSearch('');
  };

  const clear = () => {
    onSelect(null);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (value) {
    const hasAddress = !!value.address;
    return (
      <div className={cn('rounded-md border bg-card p-3 space-y-1.5', className)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {value.type === 'fornecedor' ? (
                <Building2 className="h-4 w-4 text-primary" />
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate text-sm">{value.name}</p>
              {value.fantasy_name && (
                <p className="text-[11px] text-muted-foreground truncate">{value.fantasy_name}</p>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={clear} aria-label="Trocar cliente">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {hasAddress ? (
          <div className="text-xs text-muted-foreground flex items-start gap-1 pt-1">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="truncate">
              {[value.address, value.address_number, value.neighborhood, value.city, value.state]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        ) : (
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
            Sem endereço cadastrado — preencha abaixo
          </Badge>
        )}
        {(value.whatsapp || value.phone) && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {value.whatsapp || value.phone}
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.length >= 2) setOpen(true);
            }}
            onFocus={() => search.length >= 2 && setOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
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
              <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
            ) : results.length === 0 && search.length >= 2 ? (
              <CommandEmpty>
                <div className="p-3 text-sm text-muted-foreground">
                  Nenhum cliente encontrado com "{search}".
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Clientes cadastrados">
                {results.map((c) => {
                  const addr = [c.address, c.address_number, c.city].filter(Boolean).join(', ');
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => handlePick(c)}
                      className="flex items-start gap-3 p-2.5 cursor-pointer"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {c.type === 'fornecedor' ? (
                          <Building2 className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{c.name}</div>
                        {addr ? (
                          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {addr}
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            Sem endereço
                          </div>
                        )}
                      </div>
                      <Check className="h-4 w-4 opacity-0" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
