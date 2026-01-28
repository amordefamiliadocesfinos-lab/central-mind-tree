import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Archive
} from 'lucide-react';
import { MediaFolder } from '@/hooks/useMediaFolders';

interface MediaFolderSidebarProps {
  folders: MediaFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, color?: string) => Promise<MediaFolder | null>;
  onUpdateFolder: (id: string, updates: Partial<Pick<MediaFolder, 'name' | 'color'>>) => Promise<boolean>;
  onDeleteFolder: (id: string) => Promise<boolean>;
  folderCounts: Record<string, number>;
}

const FOLDER_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#64748b', // slate
];

export function MediaFolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  folderCounts
}: MediaFolderSidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MediaFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setNewFolderColor('#6366f1');
    setCreateDialogOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    await onUpdateFolder(editingFolder.id, { 
      name: newFolderName.trim(), 
      color: newFolderColor 
    });
    setEditingFolder(null);
    setNewFolderName('');
    setEditDialogOpen(false);
  };

  const handleDelete = async (folder: MediaFolder) => {
    if (confirm(`Excluir pasta "${folder.name}"? As mídias serão movidas para "Sem pasta".`)) {
      await onDeleteFolder(folder.id);
      if (selectedFolderId === folder.id) {
        onSelectFolder(null);
      }
    }
  };

  const openEdit = (folder: MediaFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setNewFolderColor(folder.color || '#6366f1');
    setEditDialogOpen(true);
  };

  return (
    <div className="w-56 border-r bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="font-medium text-sm">Pastas</span>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-7 w-7"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* All Media */}
        <button
          onClick={() => onSelectFolder(null)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
            selectedFolderId === null
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          <Archive className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">Todas as Mídias</span>
          <Badge variant="secondary" className="text-xs">
            {Object.values(folderCounts).reduce((a, b) => a + b, 0)}
          </Badge>
        </button>

        {/* Folders */}
        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          const FolderIcon = isSelected ? FolderOpen : Folder;
          
          return (
            <div key={folder.id} className="group relative">
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <FolderIcon 
                  className="h-4 w-4 shrink-0" 
                  style={{ color: isSelected ? undefined : folder.color || undefined }}
                />
                <span className="flex-1 truncate">{folder.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {folderCounts[folder.id] || 0}
                </Badge>
              </button>

              {/* Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      'absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
                      isSelected && 'text-primary-foreground hover:text-primary-foreground/80'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 bg-popover">
                  <DropdownMenuItem onClick={() => openEdit(folder)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDelete(folder)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da pasta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      newFolderColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewFolderColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newFolderName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da pasta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            />
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      newFolderColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewFolderColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={!newFolderName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
