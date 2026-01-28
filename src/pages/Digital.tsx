import { useState, useEffect } from 'react';
import { useDigital, DIGITAL_STATUS } from '@/hooks/useDigital';
import { IdeaCard, IdeaEditor, KanbanBoard, MediaLibrary, MetricsChart, BatchVariationDialog, PlatformsManager, DigitalCalendar } from '@/components/digital';
import { TrendsPanel } from '@/components/digital/TrendsPanel';
import { InteractionsPanel } from '@/components/digital/InteractionsPanel';
import { KnowledgeBasePanel } from '@/components/digital/KnowledgeBasePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowLeft, Search, LayoutGrid, Columns3, Image, BarChart3, Link2, Settings2, TrendingUp, MessageCircle, Book, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface Node {
  id: string;
  title: string;
  color: string;
}

export default function Digital() {
  const {
    ideas,
    filteredIdeas,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    platformFilter,
    setPlatformFilter,
    stats,
    createIdea,
    updateIdea,
    deleteIdea,
    createVariation,
    updateVariation,
    deleteVariation,
    duplicateVariation,
    batchCreateVariations,
    toggleVariationChecklist,
    allVariationsWithTitle,
    // Dynamic platforms
    activePlatforms,
    groupedPlatforms,
    GROUP_LABELS,
    GROUP_ICONS,
  } = useDigital();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [newIdea, setNewIdea] = useState({ title: '', objective: '', node_id: '' });
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTab, setActiveTab] = useState<'ideias' | 'calendario' | 'midia' | 'metricas' | 'plataformas' | 'tendencias' | 'engajamento' | 'faq'>('ideias');
  const [kanbanMode, setKanbanMode] = useState<'ideas' | 'variations'>('ideas');
  const [nodes, setNodes] = useState<Node[]>([]);
  const isMobile = useIsMobile();

  // Fetch nodes for linking
  useEffect(() => {
    const fetchNodes = async () => {
      const { data } = await supabase.from('nodes').select('id, title, color').order('title');
      if (data) setNodes(data);
    };
    fetchNodes();
  }, []);

  const handleCreateIdea = async () => {
    const idea = await createIdea({
      ...newIdea,
      node_id: newIdea.node_id || null,
    });
    if (idea) {
      setShowCreateDialog(false);
      setNewIdea({ title: '', objective: '', node_id: '' });
      setSelectedIdea(idea.id);
    }
  };

  const selectedIdeaData = ideas.find(i => i.id === selectedIdea);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-sm px-4">
          <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-pt">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold truncate">Digital</h1>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'ideias' && !selectedIdea && (
              <>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode('kanban')}
                >
                  <Columns3 className="h-4 w-4" />
                </Button>
              </>
            )}
            
            <Button
              onClick={() => setShowCreateDialog(true)}
              size={isMobile ? 'icon' : 'default'}
              className="h-10 shrink-0"
            >
              <Plus className="h-5 w-5" />
              {!isMobile && <span className="ml-2">Nova Ideia</span>}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        {!selectedIdea && (
          <div className="px-4 pb-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-8 h-9">
                <TabsTrigger value="ideias" className="text-xs px-1">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Ideias</span>
                </TabsTrigger>
                <TabsTrigger value="calendario" className="text-xs px-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Calendário</span>
                </TabsTrigger>
                <TabsTrigger value="tendencias" className="text-xs px-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Tendências</span>
                </TabsTrigger>
                <TabsTrigger value="engajamento" className="text-xs px-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Engajar</span>
                </TabsTrigger>
                <TabsTrigger value="faq" className="text-xs px-1">
                  <Book className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">FAQ</span>
                </TabsTrigger>
                <TabsTrigger value="midia" className="text-xs px-1">
                  <Image className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Mídia</span>
                </TabsTrigger>
                <TabsTrigger value="metricas" className="text-xs px-1">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Métricas</span>
                </TabsTrigger>
                <TabsTrigger value="plataformas" className="text-xs px-1">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Canais</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Search & Filters - only on ideas tab */}
        {!selectedIdea && activeTab === 'ideias' && (
          <div className="px-4 pb-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar..."
                className="pl-9 h-10"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[100px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(DIGITAL_STATUS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', config.color)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[120px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(groupedPlatforms || {}).map(([group, platforms]) => (
                    platforms.map(platform => (
                      <SelectItem key={platform.id} value={platform.id}>
                        <div className="flex items-center gap-2">
                          <span>{platform.icon}</span>
                          {platform.name}
                        </div>
                      </SelectItem>
                    ))
                  ))}
                </SelectContent>
              </Select>

              {viewMode === 'kanban' && (
                <Select value={kanbanMode} onValueChange={(v) => setKanbanMode(v as any)}>
                  <SelectTrigger className="h-8 w-auto min-w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ideas">Por Ideia</SelectItem>
                    <SelectItem value="variations">Por Variação</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-2 overflow-x-auto">
              {Object.entries(DIGITAL_STATUS).map(([key, config]) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className={cn(
                    'cursor-pointer transition-all',
                    statusFilter === key ? config.color + ' text-white' : 'opacity-70'
                  )}
                  onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                >
                  {config.label}: {stats.byStatus[key] || 0}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Media Tab - Full Height */}
      {!selectedIdeaData && activeTab === 'midia' ? (
        <div className="flex-1 pb-20">
          <MediaLibrary mode="browse" />
        </div>
      ) : (
        <main className="px-4 py-4 pb-24">
          {selectedIdeaData ? (
            <IdeaEditor
              idea={selectedIdeaData}
              onBack={() => setSelectedIdea(null)}
              onUpdate={updateIdea}
              onDelete={deleteIdea}
              onCreateVariation={createVariation}
              onUpdateVariation={updateVariation}
              onDeleteVariation={deleteVariation}
              onDuplicateVariation={duplicateVariation}
              onBatchCreateVariations={batchCreateVariations}
              onToggleChecklist={toggleVariationChecklist}
              nodes={nodes}
              platforms={activePlatforms}
            />
          ) : activeTab === 'ideias' ? (
            viewMode === 'kanban' ? (
              <KanbanBoard
                ideas={filteredIdeas}
                onUpdateIdea={updateIdea}
                onUpdateVariation={updateVariation}
                onSelectIdea={setSelectedIdea}
                viewMode={kanbanMode}
              />
            ) : (
              <div className="space-y-3">
                {filteredIdeas.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">Nenhuma ideia encontrada.</p>
                    <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeira Ideia
                    </Button>
                  </Card>
                ) : (
                  filteredIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onClick={() => setSelectedIdea(idea.id)}
                      platforms={activePlatforms}
                    />
                  ))
                )}
              </div>
            )
          ) : activeTab === 'calendario' ? (
            <DigitalCalendar 
              variations={allVariationsWithTitle} 
              onSelectVariation={(v) => {
                const idea = ideas.find(i => i.id === v.idea_id);
                if (idea) setSelectedIdea(idea.id);
              }}
              platforms={activePlatforms}
              ideas={ideas.map(i => ({ id: i.id, title: i.title }))}
            />
          ) : activeTab === 'tendencias' ? (
            <TrendsPanel />
          ) : activeTab === 'engajamento' ? (
            <InteractionsPanel />
          ) : activeTab === 'faq' ? (
            <KnowledgeBasePanel />
          ) : activeTab === 'metricas' ? (
            <MetricsChart variations={allVariationsWithTitle} platforms={activePlatforms} />
          ) : (
            <PlatformsManager />
          )}
        </main>
      )}

      {/* Create Dialog */}
      <ResponsiveDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Nova Ideia"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={newIdea.title}
              onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
              placeholder="Nome da ideia"
              className="h-12"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input
              value={newIdea.objective}
              onChange={(e) => setNewIdea({ ...newIdea, objective: e.target.value })}
              placeholder="Qual o objetivo?"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Vincular a Nó (opcional)
            </Label>
            <Select 
              value={newIdea.node_id || '__none__'} 
              onValueChange={(v) => setNewIdea({ ...newIdea, node_id: v === '__none__' ? '' : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione um nó..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {nodes.map(node => (
                  <SelectItem key={node.id} value={node.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', `bg-node-${node.color}`)} />
                      {node.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateIdea} className="flex-1 h-12" disabled={!newIdea.title.trim()}>
              Criar Ideia
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
