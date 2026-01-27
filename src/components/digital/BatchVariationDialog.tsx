import { useState, useMemo } from 'react';
import { Platform, GROUP_LABELS } from '@/hooks/usePlatforms';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';

interface BatchVariationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (platformIds: string[]) => void;
  existingPlatforms?: string[];
  platforms?: Platform[];
}

export function BatchVariationDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  existingPlatforms = [],
  platforms = [],
}: BatchVariationDialogProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Group platforms by group_type
  const groupedPlatforms = useMemo(() => {
    return platforms.reduce((acc, p) => {
      const group = p.group_type || 'other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(p);
      return acc;
    }, {} as Record<string, Platform[]>);
  }, [platforms]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    );
  };

  const toggleGroup = (groupKey: string) => {
    const groupPlatforms = (groupedPlatforms[groupKey] || [])
      .filter(p => p.is_active && !existingPlatforms.includes(p.id))
      .map(p => p.id);
    
    const allSelected = groupPlatforms.every(p => selectedPlatforms.includes(p));
    
    if (allSelected) {
      setSelectedPlatforms(prev => prev.filter(p => !groupPlatforms.includes(p)));
    } else {
      setSelectedPlatforms(prev => [...new Set([...prev, ...groupPlatforms])]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedPlatforms);
    setSelectedPlatforms([]);
    onOpenChange(false);
  };

  const groupOrder = ['social', 'ecommerce', 'marketplace', 'other'];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Criar Variações em Lote"
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Selecione as plataformas para criar variações automaticamente:
        </p>

        {groupOrder.map(groupKey => {
          const groupPlatforms = groupedPlatforms[groupKey] || [];
          const availablePlatforms = groupPlatforms.filter(
            p => p.is_active && !existingPlatforms.includes(p.id)
          );
          
          if (availablePlatforms.length === 0) return null;

          const allSelected = availablePlatforms.every(p => selectedPlatforms.includes(p.id));
          const someSelected = availablePlatforms.some(p => selectedPlatforms.includes(p.id));

          return (
            <div key={groupKey} className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={groupKey}
                  checked={allSelected}
                  ref={el => {
                    if (el) {
                      (el as any).indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onCheckedChange={() => toggleGroup(groupKey)}
                />
                <Label htmlFor={groupKey} className="font-medium cursor-pointer">
                  {GROUP_LABELS[groupKey] || groupKey}
                </Label>
                {someSelected && (
                  <Badge variant="secondary" className="text-xs">
                    {availablePlatforms.filter(p => selectedPlatforms.includes(p.id)).length}/{availablePlatforms.length}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pl-6">
                {groupPlatforms.map(platform => {
                  const exists = existingPlatforms.includes(platform.id);
                  const isSelected = selectedPlatforms.includes(platform.id);
                  const isDisabled = exists || !platform.is_active;

                  return (
                    <div
                      key={platform.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all',
                        isDisabled ? 'opacity-50 cursor-not-allowed bg-muted' :
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                      )}
                      onClick={() => !isDisabled && togglePlatform(platform.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() => togglePlatform(platform.id)}
                      />
                      <span className="text-lg">{platform.icon}</span>
                      <span className="text-sm flex-1 truncate">{platform.name}</span>
                      {exists && (
                        <Badge variant="outline" className="text-xs">
                          Existe
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {platforms.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            Nenhuma plataforma configurada.
          </p>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={selectedPlatforms.length === 0}
          >
            Criar {selectedPlatforms.length} Variação{selectedPlatforms.length !== 1 ? 'ões' : ''}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
