import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap } from 'lucide-react';
import { QuickConversationDialog } from './QuickConversationDialog';
import { cn } from '@/lib/utils';

// Rotas onde faz sentido registrar conversas (CRM/Contatos/Digital/etc.)
const ALLOWED_PREFIXES = ['/contatos', '/crm', '/digital', '/rotas', '/atendimento'];

/**
 * Botão flutuante para registro rápido de conversas WhatsApp/CRM.
 * Visível apenas em rotas pertinentes. Atalho: Ctrl/Cmd + Shift + W
 */
export function QuickConversationFAB() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAllowed = ALLOWED_PREFIXES.some((p) => location.pathname.startsWith(p));

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

  if (!isAllowed) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={() => setOpen(true)}
            className={cn(
              'fixed z-40 rounded-full shadow-lg',
              'h-12 w-12 bg-primary hover:bg-primary/90',
              'bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-3',
              'md:bottom-auto md:right-6 md:top-1/2 md:-translate-y-1/2',
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
