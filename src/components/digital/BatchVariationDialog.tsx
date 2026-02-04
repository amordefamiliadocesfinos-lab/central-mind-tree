import { useState, useMemo } from 'react';
import { Platform } from '@/hooks/usePlatforms';
import { usePlatformGroups } from '@/hooks/usePlatformGroups';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

interface BatchVariationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (platformIds: string[]) => void;
  existingPlatforms?: string[];
  platforms?: Platform[];
}

interface PlatformNode {
  platform: Platform;
  children: PlatformNode[];
  isLeaf: boolean;
}

export function BatchVariationDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  existingPlatforms = [],
  platforms = [],
}: BatchVariationDialogProps) {
  const { groups } = usePlatformGroups();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Build hierarchical tree structure
  const { leafPlatforms, groupedTree } = useMemo(() => {
    // Get all platforms that have children
    const parentIds = new Set(platforms.filter(p => p.parent_id).map(p => p.parent_id!));
    
    // Build recursive tree
    const buildNode = (platform: Platform): PlatformNode => {
      const children = platforms
        .filter(p => p.parent_id === platform.id)
        .map(buildNode);
      
      return {
        platform,
        children,
        isLeaf: children.length === 0,
      };
    };

    // Get root platforms (no parent)
    const rootPlatforms = platforms.filter(p => !p.parent_id);
    const tree = rootPlatforms.map(buildNode);

    // Get all leaf platforms (selectable ones)
    const collectLeaves = (nodes: PlatformNode[]): Platform[] => {
      const leaves: Platform[] = [];
      for (const node of nodes) {
        if (node.isLeaf) {
          leaves.push(node.platform);
        } else {
          leaves.push(...collectLeaves(node.children));
        }
      }
      return leaves;
    };
    const leafPlatforms = collectLeaves(tree);

    // Group tree by group_id
    const groupedTree: Record<string, PlatformNode[]> = {};
    for (const node of tree) {
      const groupId = node.platform.group_id || '__ungrouped__';
      if (!groupedTree[groupId]) {
        groupedTree[groupId] = [];
      }
      groupedTree[groupId].push(node);
    }

    return { tree, leafPlatforms, groupedTree };
  }, [platforms]);

  // Available leaf platforms (active and not existing)
  const availableLeaves = useMemo(() => {
    return leafPlatforms.filter(p => p.is_active && !existingPlatforms.includes(p.id));
  }, [leafPlatforms, existingPlatforms]);

  // Filtered by search
  const filteredLeaves = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return availableLeaves.filter(p => p.name.toLowerCase().includes(query));
  }, [searchQuery, availableLeaves]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    );
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: prev[nodeId] === false ? true : false,
    }));
  };

  // Get all descendant leaf IDs of a node
  const getDescendantLeafIds = (node: PlatformNode): string[] => {
    if (node.isLeaf) {
      return node.platform.is_active && !existingPlatforms.includes(node.platform.id) 
        ? [node.platform.id] 
        : [];
    }
    return node.children.flatMap(getDescendantLeafIds);
  };

  // Toggle all descendants of a parent node
  const toggleParent = (node: PlatformNode) => {
    const leafIds = getDescendantLeafIds(node);
    const allSelected = leafIds.every(id => selectedPlatforms.includes(id));
    
    if (allSelected) {
      setSelectedPlatforms(prev => prev.filter(id => !leafIds.includes(id)));
    } else {
      setSelectedPlatforms(prev => [...new Set([...prev, ...leafIds])]);
    }
  };

  // Toggle all leaves of a group
  const toggleGroup = (groupId: string) => {
    const groupNodes = groupedTree[groupId] || [];
    const leafIds = groupNodes.flatMap(getDescendantLeafIds);
    const allSelected = leafIds.every(id => selectedPlatforms.includes(id));
    
    if (allSelected) {
      setSelectedPlatforms(prev => prev.filter(id => !leafIds.includes(id)));
    } else {
      setSelectedPlatforms(prev => [...new Set([...prev, ...leafIds])]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedPlatforms);
    setSelectedPlatforms([]);
    setSearchQuery('');
    onOpenChange(false);
  };

  // Get platform path (breadcrumb)
  const getPlatformPath = (platform: Platform): string[] => {
    const path: string[] = [];
    let current: Platform | undefined = platform;
    
    while (current) {
      path.unshift(current.name);
      current = platforms.find(p => p.id === current?.parent_id);
    }
    
    return path;
  };

  const renderPlatformNode = (node: PlatformNode, depth: number = 0): React.ReactNode => {
    const { platform, children, isLeaf } = node;
    const isExpanded = expandedNodes[platform.id] !== false; // Default to expanded
    const isExcluded = existingPlatforms.includes(platform.id);
    const isSelected = selectedPlatforms.includes(platform.id);

    // Skip inactive platforms
    if (!platform.is_active) return null;

    // Check if any descendant leaves are available
    const descendantLeafIds = getDescendantLeafIds(node);
    if (descendantLeafIds.length === 0 && !isLeaf) return null;
    if (isLeaf && isExcluded) return null;

    if (isLeaf) {
      // Render selectable leaf
      return (
        <div
          key={platform.id}
          className={cn(
            'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all',
            depth > 0 && 'ml-4',
            isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
          )}
          onClick={() => togglePlatform(platform.id)}
        >
          <Checkbox checked={isSelected} onCheckedChange={() => togglePlatform(platform.id)} />
          <span className="text-lg">{platform.icon}</span>
          <span className="text-sm flex-1 truncate">{platform.name}</span>
          {platform.aspect_ratio && (
            <Badge variant="outline" className="text-[10px]">
              {platform.aspect_ratio}
            </Badge>
          )}
        </div>
      );
    }

    // Check selection state for parent node
    const selectedCount = descendantLeafIds.filter(id => selectedPlatforms.includes(id)).length;
    const allSelected = selectedCount === descendantLeafIds.length && descendantLeafIds.length > 0;
    const someSelected = selectedCount > 0 && !allSelected;

    // Render collapsible parent
    return (
      <div key={platform.id} className={cn(depth > 0 && 'ml-4')}>
        <Collapsible open={isExpanded} onOpenChange={() => toggleNode(platform.id)}>
          <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-all">
            <Checkbox
              checked={allSelected}
              ref={el => {
                if (el) {
                  (el as any).indeterminate = someSelected;
                }
              }}
              onCheckedChange={() => toggleParent(node)}
              onClick={(e) => e.stopPropagation()}
            />
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 flex-1 text-left">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-lg">{platform.icon}</span>
                <span className="text-sm flex-1 truncate">{platform.name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {selectedCount}/{descendantLeafIds.length}
                </Badge>
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-1 mt-1">
            {children.map(child => renderPlatformNode(child, depth + 1))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  // Render search results (flat list)
  const renderSearchResults = () => {
    if (!filteredLeaves) return null;

    if (filteredLeaves.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-4">
          Nenhuma plataforma encontrada
        </p>
      );
    }

    return (
      <div className="space-y-1">
        {filteredLeaves.map(platform => {
          const path = getPlatformPath(platform);
          const isSelected = selectedPlatforms.includes(platform.id);
          
          return (
            <div
              key={platform.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all',
                isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
              )}
              onClick={() => togglePlatform(platform.id)}
            >
              <Checkbox checked={isSelected} onCheckedChange={() => togglePlatform(platform.id)} />
              <span className="text-lg">{platform.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{platform.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {path.slice(0, -1).join(' › ')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Criar Variações em Lote"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecione as plataformas para criar variações. Apenas formatos finais (folhas) podem ser selecionados.
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar plataforma..."
            className="pl-9 h-9"
          />
        </div>

        <ScrollArea className="h-[350px] pr-4">
          {filteredLeaves ? (
            renderSearchResults()
          ) : (
            <div className="space-y-4">
              {groups.map(group => {
                const groupNodes = groupedTree[group.id];
                if (!groupNodes || groupNodes.length === 0) return null;

                const groupLeafIds = groupNodes.flatMap(getDescendantLeafIds);
                if (groupLeafIds.length === 0) return null;

                const selectedCount = groupLeafIds.filter(id => selectedPlatforms.includes(id)).length;
                const allSelected = selectedCount === groupLeafIds.length;
                const someSelected = selectedCount > 0 && !allSelected;

                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Checkbox
                        id={group.id}
                        checked={allSelected}
                        ref={el => {
                          if (el) {
                            (el as any).indeterminate = someSelected;
                          }
                        }}
                        onCheckedChange={() => toggleGroup(group.id)}
                      />
                      <Label htmlFor={group.id} className="font-medium cursor-pointer flex items-center gap-2 flex-1">
                        <span>{group.icon}</span>
                        <span>{group.name}</span>
                      </Label>
                      {selectedCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedCount}/{groupLeafIds.length}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 pl-2">
                      {groupNodes.map(node => renderPlatformNode(node))}
                    </div>
                  </div>
                );
              })}

              {/* Ungrouped platforms */}
              {groupedTree['__ungrouped__'] && (() => {
                const groupNodes = groupedTree['__ungrouped__'];
                const groupLeafIds = groupNodes.flatMap(getDescendantLeafIds);
                if (groupLeafIds.length === 0) return null;

                const selectedCount = groupLeafIds.filter(id => selectedPlatforms.includes(id)).length;
                const allSelected = selectedCount === groupLeafIds.length;
                const someSelected = selectedCount > 0 && !allSelected;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Checkbox
                        id="__ungrouped__"
                        checked={allSelected}
                        ref={el => {
                          if (el) {
                            (el as any).indeterminate = someSelected;
                          }
                        }}
                        onCheckedChange={() => toggleGroup('__ungrouped__')}
                      />
                      <Label htmlFor="__ungrouped__" className="font-medium cursor-pointer flex items-center gap-2 flex-1">
                        <span>📋</span>
                        <span>Sem Grupo</span>
                      </Label>
                      {selectedCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedCount}/{groupLeafIds.length}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 pl-2">
                      {groupNodes.map(node => renderPlatformNode(node))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </ScrollArea>

        {availableLeaves.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            Todas as plataformas já foram adicionadas.
          </p>
        )}

        <div className="flex gap-3 pt-2 border-t">
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
