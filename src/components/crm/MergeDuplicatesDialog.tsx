import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Merge, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ContactAvatar } from './ContactAvatar';

interface DuplicateGroup {
  key: string;
  label: string;
  contacts: Array<{
    id: string; name: string; phone: string | null; whatsapp: string | null;
    email: string | null; photo_url: string | null;
    lifetime_value: number; paid_orders_count: number; ultimo_contato: string | null;
  }>;
}

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onMerged?: () => void; }

export function MergeDuplicatesDialog({ open, onOpenChange, onMerged }: Props) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [merging, setMerging] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('id,name,phone,whatsapp,email,photo_url,lifetime_value,paid_orders_count,ultimo_contato')
      .eq('is_active', true)
      .limit(2000);
    const byKey = new Map<string, DuplicateGroup>();
    for (const c of data || []) {
      const phoneDigits = (c.whatsapp || c.phone || '').replace(/\D/g, '');
      const emailKey = (c.email || '').trim().toLowerCase();
      const keys: Array<[string, string]> = [];
      if (phoneDigits.length >= 8) keys.push([`tel:${phoneDigits}`, `📱 ${phoneDigits}`]);
      if (emailKey) keys.push([`em:${emailKey}`, `✉️ ${emailKey}`]);
      for (const [key, label] of keys) {
        if (!byKey.has(key)) byKey.set(key, { key, label, contacts: [] });
        byKey.get(key)!.contacts.push(c as any);
      }
    }
    const dups = Array.from(byKey.values()).filter(g => g.contacts.length > 1);
    setGroups(dups);
    setLoading(false);
  };

  useEffect(() => { if (open) scan(); }, [open]);

  const handleMerge = async (primaryId: string, duplicateId: string, key: string) => {
    setMerging(`${key}:${duplicateId}`);
    const { error } = await supabase.rpc('merge_contacts' as any, {
      _primary_id: primaryId,
      _duplicate_id: duplicateId,
    });
    setMerging(null);
    if (error) { toast.error('Erro ao mesclar: ' + error.message); return; }
    toast.success('Contatos mesclados!');
    await scan();
    onMerged?.();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Mesclar contatos duplicados" description="Detectamos contatos com mesmo telefone ou email. Escolha o contato principal de cada grupo — os demais serão unidos a ele.">
      <div className="space-y-3 pb-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            {loading ? 'Procurando...' : `${groups.length} grupo(s) de duplicados`}
          </div>
          <Button size="sm" variant="outline" onClick={scan} disabled={loading}>
            {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Reescanear
          </Button>
        </div>

        {!loading && groups.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum duplicado encontrado 🎉</div>
        )}

        {groups.map(g => (
          <Card key={g.key} className="p-3">
            <div className="text-xs font-medium mb-2 text-muted-foreground">{g.label}</div>
            <div className="space-y-2">
              {g.contacts.map((c, idx) => {
                const isPrimary = idx === 0;
                return (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <ContactAvatar name={c.name} photoUrl={c.photo_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        {c.name}
                        {isPrimary && <Badge variant="default" className="text-[9px] h-4">PRINCIPAL</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        LTV R$ {Number(c.lifetime_value || 0).toFixed(0)} · {c.paid_orders_count || 0} pedidos · últ. {c.ultimo_contato || '—'}
                      </div>
                    </div>
                    {!isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7"
                        disabled={merging === `${g.key}:${c.id}`}
                        onClick={() => handleMerge(g.contacts[0].id, c.id, g.key)}
                      >
                        {merging === `${g.key}:${c.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Merge className="h-3 w-3" />}
                        Mesclar no principal
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </ResponsiveDialog>
  );
}
