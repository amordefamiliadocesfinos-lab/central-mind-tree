import { useState, useMemo } from 'react';
import { Platform } from '@/hooks/usePlatforms';
import { usePlatformGroups } from '@/hooks/usePlatformGroups';
import { PlatformIcon } from './PlatformsManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';

interface HierarchicalPlatformSelectorProps {
  platforms: Platform[];
  excludedPlatformIds?: string[];
  onSelect: (platformId: string) => void;
  onCancel: () => void;
  multiSelect?: boolean;
  selectedIds?: string[];
  onMultiSelect?: (platformIds: string[]) => void;
  /** When true, parent (non-leaf) platforms are also selectable, regardless of hierarchy level. */
  allowSelectParents?: boolean;
}

interface PlatformNode {
  platform: Platform;
  children: PlatformNode[];
  isLeaf: boolean;
}

export function HierarchicalPlatformSelector({
  platforms,
  excludedPlatformIds = [],
  onSelect,
  onCancel,
  multiSelect = false,
  selectedIds = [],
  onMultiSelect,
  allowSelectParents = false,
}: HierarchicalPlatformSelectorProps) {
  const { groups } = usePlatformGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);

  // Build hierarchical tree structure
  const { tree, leafPlatforms, groupedTree } = useMemo(() => {
    // Get all platforms that have children
    const parentIds = new Set(platforms.filter(p => p.parent_id).map(p => p.parent_id!));
    
    // A platform is a "leaf" if it has no children
    const isLeaf = (platformId: string) => !parentIds.has(platformId);
    
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

  // Filter platforms based on search
  const filteredLeaves = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    return leafPlatforms.filter(p => 
      p.name.toLowerCase().includes(query) &&
      p.is_active &&
      !excludedPlatformIds.includes(p.id)
    );
  }, [searchQuery, leafPlatforms, excludedPlatformIds]);

  // Get platform path (breadcrumb)
  const getPlatformPath = (platform: Platform): string[] => {
    const path: string[] = [];
    let current: Platform | undefined = platform;
    
    while (current) {
      path.unshift(current.name);
      current = platforms.find(p => p.id === current?.parent_id);
    }
    
    // Add group name at the start
    const group = groups.find(g => g.id === platform.group_id);
    if (group) {
      path.unshift(group.name);
    }
    
    return path;
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleSelect = (platformId: string) => {
    if (multiSelect) {
      setLocalSelectedIds(prev => 
        prev.includes(platformId)
          ? prev.filter(id => id !== platformId)
          : [...prev, platformId]
      );
    } else {
      onSelect(platformId);
    }
  };

  const handleConfirmMultiSelect = () => {
    if (onMultiSelect) {
      onMultiSelect(localSelectedIds);
    }
  };

  // Helper function to check if a node has any available leaf descendants
  const checkHasAvailableDescendants = (node: PlatformNode): boolean => {
    if (!node.platform.is_active) return false;
    if (node.isLeaf) return !excludedPlatformIds.includes(node.platform.id);
    if (allowSelectParents && !excludedPlatformIds.includes(node.platform.id)) return true;
    return node.children.some(child => checkHasAvailableDescendants(child));
  };

  const renderPlatformNode = (node: PlatformNode, depth: number = 0): React.ReactNode => {
    const { platform, children, isLeaf } = node;
    const isExpanded = expandedNodes[platform.id] === true; // Default to collapsed
    const isExcluded = excludedPlatformIds.includes(platform.id);
    const isSelected = localSelectedIds.includes(platform.id);

    // Skip inactive platforms and their children
    if (!platform.is_active) return null;

    // If it's a leaf and excluded, skip it
    if (isLeaf && isExcluded) return null;

    // Skip branches with no available leaves (and parent itself isn't selectable)
    if (!isLeaf && !checkHasAvailableDescendants(node)) return null;

    if (isLeaf) {
      // Render selectable leaf
      return (
        <Button
          key={platform.id}
          variant={isSelected ? 'default' : 'ghost'}
          className={cn(
            'w-full justify-start h-auto py-2 px-3',
            depth > 0 && 'ml-4',
            isSelected && 'bg-primary text-primary-foreground'
          )}
          onClick={() => handleSelect(platform.id)}
        >
          <PlatformIcon icon={platform.icon} size="md" className="mr-2" />
          <span className="flex-1 text-left truncate">{platform.name}</span>
          {platform.aspect_ratio && (
            <Badge variant="outline" className="ml-2 text-[10px]">
              {platform.aspect_ratio}
            </Badge>
          )}
        </Button>
      );
    }

    // Render parent node — keep hierarchical visualization, but allow
    // selecting the parent itself when allowSelectParents is enabled.
    const parentSelectable = allowSelectParents && !isExcluded;
    return (
      <div key={platform.id} className={cn(depth > 0 && 'ml-4')}>
        <Collapsible open={isExpanded} onOpenChange={() => toggleNode(platform.id)}>
          <div
            className={cn(
              'flex items-center gap-1 rounded-md',
              isSelected && 'bg-primary text-primary-foreground'
            )}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 shrink-0',
                  isSelected && 'text-primary-foreground hover:text-primary-foreground'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              className={cn(
                'flex-1 justify-start h-auto py-2 px-2',
                !parentSelectable && 'text-muted-foreground hover:text-foreground cursor-default',
                isSelected && 'text-primary-foreground hover:text-primary-foreground hover:bg-transparent'
              )}
              onClick={() => {
                if (parentSelectable) {
                  handleSelect(platform.id);
                } else {
                  toggleNode(platform.id);
                }
              }}
            >
              <PlatformIcon icon={platform.icon} size="md" className="mr-2" />
              <span className="flex-1 text-left truncate">{platform.name}</span>
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {children.filter(c => c.platform.is_active).length}
              </Badge>
            </Button>
          </div>
          <CollapsibleContent className="space-y-0.5 mt-0.5">
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
        <p className="text-center text-muted-foreground py-8">
          Nenhuma plataforma encontrada
        </p>
      );
    }

    return (
      <div className="space-y-1">
        {filteredLeaves.map(platform => {
          const path = getPlatformPath(platform);
          const isSelected = localSelectedIds.includes(platform.id);
          
          return (
            <Button
              key={platform.id}
              variant={isSelected ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start h-auto py-2 px-3',
                isSelected && 'bg-primary text-primary-foreground'
              )}
              onClick={() => handleSelect(platform.id)}
            >
              <PlatformIcon icon={platform.icon} size="md" className="mr-2" />
              <div className="flex-1 text-left min-w-0">
                <div className="truncate font-medium">{platform.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {path.slice(0, -1).join(' › ')}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Selecione a Plataforma</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {/* Platforms */}
        <ScrollArea className="h-[300px] pr-4">
          {filteredLeaves ? (
            renderSearchResults()
          ) : (
            <div className="space-y-2">
              {groups.map(group => {
                const groupNodes = groupedTree[group.id];
                if (!groupNodes || groupNodes.length === 0) return null;

                return (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 py-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <span>{group.icon}</span>
                      <span>{group.name}</span>
                    </div>
                    <div className="space-y-0.5">
                      {groupNodes.map(node => renderPlatformNode(node))}
                    </div>
                  </div>
                );
              })}

              {/* Ungrouped platforms */}
              {groupedTree['__ungrouped__'] && (
                <div>
                  <div className="flex items-center gap-2 py-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>📋</span>
                    <span>Sem Grupo</span>
                  </div>
                  <div className="space-y-0.5">
                    {groupedTree['__ungrouped__'].map(node => renderPlatformNode(node))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          {multiSelect && (
            <Button 
              onClick={handleConfirmMultiSelect} 
              className="flex-1"
              disabled={localSelectedIds.length === 0}
            >
              Adicionar ({localSelectedIds.length})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
