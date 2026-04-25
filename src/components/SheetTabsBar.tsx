import React, { useState } from 'react';
import { useSheetTabs, SheetTab } from '@/hooks/useSpreadsheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

interface SheetTabsBarProps {
  sheetId: string;
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
}

export function SheetTabsBar({ sheetId, activeTabId, onTabChange }: SheetTabsBarProps) {
  const { tabs, createTab, renameTab, deleteTab, duplicateTab } = useSheetTabs(sheetId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  // Auto-select first tab when none active or when active disappears
  React.useEffect(() => {
    if (tabs.length === 0) return;
    if (!activeTabId || !tabs.find((t) => t.id === activeTabId)) {
      onTabChange(tabs[0].id);
    }
  }, [tabs, activeTabId, onTabChange]);

  const startRename = (tab: SheetTab) => {
    setRenamingId(tab.id);
    setRenameValue(tab.title);
  };

  const commitRename = async () => {
    if (renamingId) {
      await renameTab(renamingId, renameValue);
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleAdd = async () => {
    const tab = await createTab();
    onTabChange(tab.id);
  };

  const handleDelete = async (tabId: string) => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    await deleteTab(tabId);
    if (activeTabId === tabId) {
      const next = tabs[idx + 1] || tabs[idx - 1];
      if (next) onTabChange(next.id);
    }
  };

  const handleDuplicate = async (tabId: string) => {
    const newTab = await duplicateTab(tabId);
    if (newTab) onTabChange(newTab.id);
  };

  const scroll = (dir: 'left' | 'right') => {
    scrollerRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center gap-1 border-t bg-muted/30 px-1 py-1 select-none">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleAdd}
        aria-label="Adicionar nova aba"
        title="Adicionar nova aba"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 hidden sm:inline-flex"
        onClick={() => scroll('left')}
        aria-label="Rolar abas para esquerda"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        ref={scrollerRef}
        className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isRenaming = renamingId === tab.id;

          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => !isRenaming && onTabChange(tab.id)}
                  onDoubleClick={() => startRename(tab)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTabChange(tab.id);
                    } else if (e.key === 'F2') {
                      e.preventDefault();
                      startRename(tab);
                    }
                  }}
                  className={cn(
                    'group flex items-center h-8 px-3 text-sm rounded-t-md border border-b-0 cursor-pointer shrink-0 max-w-[180px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-background text-foreground border-border font-medium'
                      : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                  )}
                  title={tab.title}
                >
                  {isRenaming ? (
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') {
                          setRenamingId(null);
                          setRenameValue('');
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="h-6 w-32 px-1 text-sm"
                    />
                  ) : (
                    <span className="truncate">{tab.title}</span>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => startRename(tab)}>
                  Renomear
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => handleDuplicate(tab.id)}>
                  Duplicar
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => handleDelete(tab.id)}
                  disabled={tabs.length <= 1}
                  className="text-destructive focus:text-destructive"
                >
                  Excluir
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 hidden sm:inline-flex"
        onClick={() => scroll('right')}
        aria-label="Rolar abas para direita"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
