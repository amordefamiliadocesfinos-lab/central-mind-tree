import { useState } from 'react';
import { Platform } from '@/hooks/usePlatforms';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { PlatformIcon } from './PlatformsManager';
import { HierarchicalPlatformSelector } from './HierarchicalPlatformSelector';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformHierarchicalPickerProps {
  platforms: Platform[];
  value?: string | null;
  onChange: (platformId: string | null) => void;
  placeholder?: string;
  /** When true, shows a "Todos" option that resolves to null. */
  showAllOption?: boolean;
  allLabel?: string;
  excludedPlatformIds?: string[];
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'default';
  /** Allow selecting parent (non-leaf) platforms regardless of hierarchy depth. */
  allowSelectParents?: boolean;
}

/**
 * Reusable trigger + popover that uses HierarchicalPlatformSelector
 * so any platform/channel selector across the app shows parents first
 * and lets the user drill down (clean hierarchical view).
 */
export function PlatformHierarchicalPicker({
  platforms,
  value,
  onChange,
  placeholder = 'Selecione',
  showAllOption = false,
  allLabel = 'Todos',
  excludedPlatformIds = [],
  className,
  triggerClassName,
  size = 'default',
  allowSelectParents = false,
}: PlatformHierarchicalPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? platforms.find(p => p.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between font-normal',
            size === 'sm' && 'h-9',
            triggerClassName,
          )}
        >
          <span className="flex items-center gap-2 truncate min-w-0">
            {selected ? (
              <>
                <PlatformIcon icon={selected.icon} size="sm" />
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">
                {showAllOption && !value ? allLabel : placeholder}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0 w-[340px]', className)} align="start">
        {showAllOption && (
          <div className="p-2 border-b">
            <Button
              variant={!value ? 'default' : 'ghost'}
              className="w-full justify-start h-8"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {allLabel}
            </Button>
          </div>
        )}
        <HierarchicalPlatformSelector
          platforms={platforms}
          excludedPlatformIds={excludedPlatformIds}
          onSelect={(id) => {
            onChange(id);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
