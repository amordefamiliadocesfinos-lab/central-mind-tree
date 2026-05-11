import { useMemo, useState } from 'react';
import { Platform } from '@/hooks/usePlatforms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2, Eye, Trash2, ShieldAlert } from 'lucide-react';
import { PlatformIcon } from './PlatformsManager';

interface Props {
  platforms: Platform[];
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (p: Platform) => void;
  onDelete: (p: Platform) => void;
}

interface HealthIssue {
  type: 'inactive_with_active_children' | 'orphaned_no_group_no_parent' | 'invalid_parent' | 'self_parent' | 'duplicate_name';
  platform: Platform;
  detail: string;
}

const TYPE_LABEL: Record<HealthIssue['type'], string> = {
  inactive_with_active_children: 'Pai desativado com filhos ativos (filhos somem dos seletores)',
  orphaned_no_group_no_parent: 'Sem grupo e sem pai (plataforma órfã)',
  invalid_parent: 'Pai inválido (referência quebrada)',
  self_parent: 'Plataforma é pai de si mesma (loop)',
  duplicate_name: 'Nome duplicado',
};

export function PlatformsHealthPanel({ platforms, onToggleActive, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(true);

  const issues = useMemo<HealthIssue[]>(() => {
    const list: HealthIssue[] = [];
    const byId = new Map(platforms.map(p => [p.id, p]));
    const childrenOf = new Map<string, Platform[]>();
    for (const p of platforms) {
      if (p.parent_id) {
        const arr = childrenOf.get(p.parent_id) || [];
        arr.push(p);
        childrenOf.set(p.parent_id, arr);
      }
    }

    // Check each platform
    for (const p of platforms) {
      // Self-parent loop
      if (p.parent_id && p.parent_id === p.id) {
        list.push({ type: 'self_parent', platform: p, detail: 'parent_id == id' });
        continue;
      }
      // Invalid parent
      if (p.parent_id && !byId.has(p.parent_id)) {
        list.push({ type: 'invalid_parent', platform: p, detail: `Pai (${p.parent_id.slice(0, 8)}...) não existe` });
      }
      // Inactive parent with active children
      if (!p.is_active) {
        const kids = childrenOf.get(p.id) || [];
        const activeKids = kids.filter(k => k.is_active);
        if (activeKids.length > 0) {
          list.push({
            type: 'inactive_with_active_children',
            platform: p,
            detail: `${activeKids.length} sub-plataforma(s) ativa(s) ficam invisíveis nos seletores`,
          });
        }
      }
      // Orphan
      if (!p.group_id && !p.parent_id) {
        list.push({ type: 'orphaned_no_group_no_parent', platform: p, detail: 'Não pertence a nenhum grupo' });
      }
    }

    // Duplicate names (same parent + same name)
    const seen = new Map<string, Platform[]>();
    for (const p of platforms) {
      const key = `${p.parent_id || 'root'}::${p.name.trim().toLowerCase()}`;
      const arr = seen.get(key) || [];
      arr.push(p);
      seen.set(key, arr);
    }
    for (const arr of seen.values()) {
      if (arr.length > 1) {
        for (const p of arr) {
          list.push({ type: 'duplicate_name', platform: p, detail: `${arr.length} plataformas com mesmo nome no mesmo nível` });
        }
      }
    }

    return list;
  }, [platforms]);

  if (issues.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-3 px-4 flex items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-green-600" />
          <span className="text-green-700 dark:text-green-400">
            Diagnóstico de plataformas: tudo certo. Nenhum problema detectado.
          </span>
        </CardContent>
      </Card>
    );
  }

  // Group by type
  const byType = issues.reduce((acc, i) => {
    (acc[i.type] ||= []).push(i);
    return acc;
  }, {} as Record<HealthIssue['type'], HealthIssue[]>);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-amber-500/10 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Diagnóstico de Plataformas
                <Badge variant="destructive" className="ml-1">{issues.length}</Badge>
              </CardTitle>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Plataformas com problemas que podem causar itens "fantasmas" ou invisíveis nos seletores.
            </p>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {Object.entries(byType).map(([type, list]) => (
              <div key={type} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {TYPE_LABEL[type as HealthIssue['type']]}
                </div>
                <div className="space-y-1">
                  {list.map(({ platform, detail }, idx) => (
                    <div
                      key={`${type}-${platform.id}-${idx}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-md border bg-background"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PlatformIcon icon={platform.icon} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{platform.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{detail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {type === 'inactive_with_active_children' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => onToggleActive(platform.id, true)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Reativar
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onEdit(platform)}
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => onDelete(platform)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
