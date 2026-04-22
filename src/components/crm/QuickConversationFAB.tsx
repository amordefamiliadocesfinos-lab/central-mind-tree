import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap } from 'lucide-react';
import { QuickConversationDialog } from './QuickConversationDialog';
import { cn } from '@/lib/utils';

/**
 * Botão flutuante global para registro rápido de conversas WhatsApp/CRM.
 * Atalho: Ctrl/Cmd + Shift + W
 */
export function QuickConversationFAB() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={() => setOpen(true)}
            className={cn(
              'fixed z-[10000] rounded-full shadow-lg',
              'h-12 w-12 bg-primary hover:bg-primary/90',
              'bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-3 md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:right-6',
              'transition-transform hover:scale-105',
            )}
            aria-label="Registrar conversa"
          >
            <Zap className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Registrar conversa <span className="ml-2 text-[10px] opacity-60">⌘⇧W</span>
        </TooltipContent>
      </Tooltip>
      <QuickConversationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
