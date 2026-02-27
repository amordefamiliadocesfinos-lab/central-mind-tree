import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContactTags } from '@/hooks/useContactTags';
import { Plus, Trash2 } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactTagsManager({ open, onOpenChange }: Props) {
  const { tags, createTag, deleteTag } = useContactTags();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createTag(newName.trim(), newColor);
    setNewName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da tag..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="h-9"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: newColor === c ? 'black' : 'transparent' }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium">{tag.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTag(tag.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag criada</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
