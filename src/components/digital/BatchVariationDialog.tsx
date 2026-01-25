import { useState } from 'react';
import { PLATFORMS } from '@/hooks/useDigital';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';

interface BatchVariationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (platforms: string[]) => void;
  existingPlatforms?: string[];
}

const PLATFORM_GROUPS = {
  instagram: { label: 'Instagram', platforms: ['instagram_feed', 'instagram_reels', 'instagram_stories'] },
  youtube: { label: 'YouTube', platforms: ['youtube_long', 'youtube_shorts'] },
  tiktok: { label: 'TikTok', platforms: ['tiktok'] },
  facebook: { label: 'Facebook', platforms: ['facebook_post', 'facebook_video', 'facebook_carousel'] },
};

export function BatchVariationDialog({ open, onOpenChange, onConfirm, existingPlatforms = [] }: BatchVariationDialogProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const toggleGroup = (group: keyof typeof PLATFORM_GROUPS) => {
    const groupPlatforms = PLATFORM_GROUPS[group].platforms.filter(p => !existingPlatforms.includes(p));
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

        {Object.entries(PLATFORM_GROUPS).map(([groupKey, group]) => {
          const availablePlatforms = group.platforms.filter(p => !existingPlatforms.includes(p));
          if (availablePlatforms.length === 0) return null;

          const allSelected = availablePlatforms.every(p => selectedPlatforms.includes(p));
          const someSelected = availablePlatforms.some(p => selectedPlatforms.includes(p));

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
                  onCheckedChange={() => toggleGroup(groupKey as keyof typeof PLATFORM_GROUPS)}
                />
                <Label htmlFor={groupKey} className="font-medium cursor-pointer">
                  {group.label}
                </Label>
                {someSelected && (
                  <Badge variant="secondary" className="text-xs">
                    {availablePlatforms.filter(p => selectedPlatforms.includes(p)).length}/{availablePlatforms.length}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pl-6">
                {group.platforms.map(platform => {
                  const config = PLATFORMS[platform];
                  const exists = existingPlatforms.includes(platform);
                  const isSelected = selectedPlatforms.includes(platform);

                  return (
                    <div
                      key={platform}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all',
                        exists ? 'opacity-50 cursor-not-allowed bg-muted' :
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                      )}
                      onClick={() => !exists && togglePlatform(platform)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={exists}
                        onCheckedChange={() => togglePlatform(platform)}
                      />
                      <span className="text-lg">{config?.icon}</span>
                      <span className="text-sm flex-1 truncate">{config?.label}</span>
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
