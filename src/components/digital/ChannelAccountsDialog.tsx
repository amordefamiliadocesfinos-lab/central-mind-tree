import { useState } from 'react';
import { Platform } from '@/hooks/usePlatforms';
import { ChannelAccount, useChannelAccounts } from '@/hooks/useChannelAccounts';
import { PlatformIcon } from './PlatformsManager';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Store, Plus, Edit2, Loader2, Check, X } from 'lucide-react';

interface ChannelAccountsDialogProps {
  platform: Platform | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Gestão simples das Contas/Lojas canônicas (channel_accounts) de uma Plataforma.
 * Escopo mínimo: listar, adicionar (somente nome), renomear e ativar/desativar.
 */
export function ChannelAccountsDialog({ platform, open, onOpenChange }: ChannelAccountsDialogProps) {
  const { accounts, loading, saving, createAccount, updateAccountName, toggleAccountActive } =
    useChannelAccounts(open ? platform?.id ?? null : null);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    const ok = await createAccount(newName);
    if (ok) setNewName('');
  };

  const startEdit = (account: ChannelAccount) => {
    setEditingId(account.id);
    setEditingName(account.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const confirmEdit = async () => {
    if (!editingId) return;
    const ok = await updateAccountName(editingId, editingName);
    if (ok) cancelEdit();
  };

  if (!platform) return null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Contas/Lojas — ${platform.name}`}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PlatformIcon icon={platform.icon} size="sm" />
          <span>
            Plataforma: <span className="font-medium text-foreground">{platform.name}</span>
          </span>
        </div>

        {/* Nova conta */}
        <div className="space-y-2">
          <Label htmlFor="new-account-name">Nova Conta/Loja</Label>
          <div className="flex gap-2">
            <Input
              id="new-account-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: SHOPEE CELIVIO"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button onClick={handleAdd} disabled={saving || !newName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Adicionar
            </Button>
          </div>
        </div>

        {/* Lista de contas */}
        <div className="space-y-2">
          <Label>Contas cadastradas</Label>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground border border-dashed rounded-lg">
              <Store className="h-8 w-8" />
              <p className="text-sm">Nenhuma conta/loja cadastrada nesta plataforma.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(account => {
                const isEditing = editingId === account.id;
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg border"
                  >
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              confirmEdit();
                            }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={confirmEdit}
                          disabled={saving}
                          title="Salvar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={cancelEdit}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{account.name}</span>
                          {!account.is_active && (
                            <Badge variant="secondary" className="text-[10px]">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={account.is_active}
                            onCheckedChange={(checked) => toggleAccountActive(account.id, checked)}
                            title={account.is_active ? 'Desativar' : 'Ativar'}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(account)}
                            title="Renomear"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Contas ativas ficam disponíveis para os módulos que consomem a fonte canônica
          (ex.: importador de pedidos). Contas inativas permanecem no histórico.
        </p>
      </div>
    </ResponsiveDialog>
  );
}
