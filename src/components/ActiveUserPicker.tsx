import { useActiveUser } from '@/hooks/useActiveUser';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Check, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
}

interface Props {
  variant?: 'compact' | 'full';
  className?: string;
}

export function ActiveUserPicker({ variant = 'compact', className }: Props) {
  const { activeUser, users, setActiveUser, loading } = useActiveUser();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={activeUser ? 'secondary' : 'outline'}
          size={variant === 'compact' ? 'sm' : 'default'}
          className={cn('gap-2', className)}
          title="Selecionar usuário ativo"
        >
          {activeUser ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {initials(activeUser.name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate text-xs">{activeUser.name.split(' ')[0]}</span>
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              <span className="text-xs">Quem é você?</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b">
          <div className="text-xs font-semibold flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-primary" />
            Operando como
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cada usuário tem sua própria rotina, MTs e alertas.
          </p>
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-1">
            <button
              onClick={() => setActiveUser(null)}
              className={cn(
                'w-full text-left px-2 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2',
                !activeUser && 'bg-muted'
              )}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Todos (sem filtro)</span>
              {!activeUser && <Check className="h-4 w-4 text-primary" />}
            </button>
            {loading && <div className="text-xs text-muted-foreground p-3">Carregando…</div>}
            {users.map((u) => {
              const selected = activeUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => setActiveUser(u.id)}
                  className={cn(
                    'w-full text-left px-2 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2',
                    selected && 'bg-muted'
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px] bg-primary/15 text-primary">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{u.name}</div>
                    {u.role && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 mt-0.5">
                        {u.role}
                      </Badge>
                    )}
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="p-2 border-t text-[10px] text-muted-foreground text-center">
          Sem senha · acesso total (temporário)
        </div>
      </PopoverContent>
    </Popover>
  );
}
