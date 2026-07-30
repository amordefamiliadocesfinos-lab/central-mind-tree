import { useActiveUser } from '@/hooks/useActiveUser';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, UserCircle2, AlertTriangle } from 'lucide-react';
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

/** Menu somente leitura da conta autenticada + logout. */
export function ActiveUserPicker({ variant = 'compact', className }: Props) {
  const { activeUser, loading, isLinked } = useActiveUser();
  const { user, signOut } = useAuth();

  const label = activeUser?.name?.split(' ')[0] ?? (loading ? '…' : 'Conta');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size={variant === 'compact' ? 'sm' : 'default'}
          className={cn('gap-2', className)}
          title="Conta autenticada"
          aria-label="Conta autenticada"
        >
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {activeUser ? initials(activeUser.name) : <UserCircle2 className="h-3 w-3" />}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[120px] truncate text-xs">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b space-y-1">
          <div className="text-xs font-semibold flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-primary" />
            Conta autenticada
          </div>
          <p className="text-[11px] text-muted-foreground break-all">{user?.email}</p>
        </div>

        <div className="p-3 space-y-2">
          {isLinked ? (
            <>
              <div className="text-sm font-medium">{activeUser!.name}</div>
              {activeUser!.role && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {activeUser!.role}
                </Badge>
              )}
              <p className="text-[11px] text-muted-foreground">
                Identidade operacional vinculada. Não é possível trocar de usuário.
              </p>
            </>
          ) : (
            <div className="flex gap-2 text-[11px] text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Sua conta não possui vínculo operacional ativo. As ações estão bloqueadas — solicite
                a liberação ao administrador.
              </span>
            </div>
          )}
        </div>

        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
