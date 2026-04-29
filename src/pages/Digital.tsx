import { useState, useEffect } from 'react';
import { useDigital, DIGITAL_STATUS } from '@/hooks/useDigital';
import { useIdeaTypes } from '@/hooks/useIdeaTypes';
import { useProductsList } from '@/hooks/useProductsList';
import { IdeaCard, IdeaEditor, KanbanBoard, MediaLibrary, MetricsChart, BatchVariationDialog, PlatformsManager, DigitalCalendar } from '@/components/digital';
import { IdeaTypesManager } from '@/components/digital/IdeaTypesManager';
import { PlatformIcon } from '@/components/digital/PlatformsManager';
import { TrendsPanel } from '@/components/digital/TrendsPanel';
import { InteractionsPanel } from '@/components/digital/InteractionsPanel';
import { ServicePanel } from '@/components/digital/ServicePanel';
import { KnowledgeBasePanel } from '@/components/digital/KnowledgeBasePanel';
import { ProductSelector } from '@/components/digital/ProductSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowLeft, Search, LayoutGrid, Columns3, Image, BarChart3, Link2, Settings2, TrendingUp, MessageCircle, Book, Calendar, Headset, X, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
  const [newIdea, setNewIdea] = useState({ title: '', objective: '', node_id: '', idea_type: 'conteudo', product_id: '' });
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTab, setActiveTab] = useState<'ideias' | 'calendario' | 'midia' | 'metricas' | 'plataformas' | 'tendencias' | 'engajamento' | 'faq' | 'atendimento'>('ideias');
  const [kanbanMode, setKanbanMode] = useState<'ideas' | 'variations'>('ideas');
  const [nodes, setNodes] = useState<Node[]>([]);
  const isMobile = useIsMobile();
  const { products } = useProductsList();
  const { ideaTypes } = useIdeaTypes();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [nodeFilter, setNodeFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

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
      product_id: newIdea.product_id || null,
      idea_type: (newIdea.idea_type as any) || 'conteudo',
    });
    if (idea) {
      setShowCreateDialog(false);
      setNewIdea({ title: '', objective: '', node_id: '', idea_type: 'conteudo', product_id: '' });
      setSelectedIdea(idea.id);
    }
  };

  const selectedIdeaData = ideas.find(i => i.id === selectedIdea);

  // Apply advanced filters on top of hook filters
  const displayedIdeas = filteredIdeas.filter(idea => {
    if (typeFilter !== 'all' && idea.idea_type !== typeFilter) return false;
    if (nodeFilter !== 'all' && idea.node_id !== nodeFilter) return false;
    if (productFilter !== 'all' && idea.product_id !== productFilter) return false;
    if (periodFilter !== 'all') {
      const now = new Date();
      const vars = idea.variations || [];
      const dates = vars.map(v => v.scheduled_date).filter(Boolean) as string[];
      if (dates.length === 0) return periodFilter === 'sem_data';
      if (periodFilter === 'sem_data') return false;
      const s = new Date(now); const e = new Date(now);
      if (periodFilter === 'esta_semana') { s.setDate(now.getDate() - now.getDay()); e.setDate(s.getDate() + 6); }
      else if (periodFilter === 'este_mes') { s.setDate(1); e.setMonth(e.getMonth() + 1, 0); }
      else if (periodFilter === 'proximo_mes') { s.setMonth(s.getMonth() + 1, 1); e.setMonth(e.getMonth() + 2, 0); }
      const ss = s.toISOString().slice(0, 10); const ee = e.toISOString().slice(0, 10);
      if (!dates.some(d => d >= ss && d <= ee)) return false;
    }
    return true;
  });

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

  // Active filter chips for visibility
  const activeFilterChips: { key: string; label: string; clear: () => void }[] = [];
  if (statusFilter !== 'all') {
    const cfg = (DIGITAL_STATUS as any)[statusFilter];
    activeFilterChips.push({ key: 'status', label: `Status: ${cfg?.label ?? statusFilter}`, clear: () => setStatusFilter('all') });
  }
  if (platformFilter !== 'all') {
    const all = Object.values(groupedPlatforms || {}).flat();
    const p = all.find((x: any) => x.id === platformFilter);
    activeFilterChips.push({ key: 'platform', label: `Canal: ${p?.name ?? platformFilter}`, clear: () => setPlatformFilter('all') });
  }
  if (typeFilter !== 'all') {
    const t = ideaTypes.find(x => x.key === typeFilter);
    activeFilterChips.push({ key: 'type', label: `Tipo: ${t?.label ?? typeFilter}`, clear: () => setTypeFilter('all') });
  }
  if (nodeFilter !== 'all') {
    const n = nodes.find(x => x.id === nodeFilter);
    activeFilterChips.push({ key: 'node', label: `Vínculo: ${n?.title ?? nodeFilter}`, clear: () => setNodeFilter('all') });
  }
  if (productFilter !== 'all') {
    const p = products.find(x => x.id === productFilter);
    activeFilterChips.push({ key: 'product', label: `Produto: ${p?.name ?? productFilter}`, clear: () => setProductFilter('all') });
  }
  if (periodFilter !== 'all') {
    const map: Record<string, string> = { esta_semana: 'Esta semana', este_mes: 'Este mês', proximo_mes: 'Próximo mês', sem_data: 'Sem data' };
    activeFilterChips.push({ key: 'period', label: `Período: ${map[periodFilter] ?? periodFilter}`, clear: () => setPeriodFilter('all') });
  }
  const clearAllFilters = () => {
    setStatusFilter('all'); setPlatformFilter('all'); setTypeFilter('all');
    setNodeFilter('all'); setProductFilter('all'); setPeriodFilter('all');
    setSearchQuery('');
  };

  // Tab groups for clearer navigation
  const tabGroups: { label: string; tabs: { value: typeof activeTab; label: string; icon: any }[] }[] = [
    {
      label: 'Conteúdo',
      tabs: [
        { value: 'ideias', label: 'Ideias', icon: LayoutGrid },
        { value: 'calendario', label: 'Calendário', icon: Calendar },
        { value: 'midia', label: 'Mídia', icon: Image },
      ],
    },
    {
      label: 'Engajamento',
      tabs: [
        { value: 'atendimento', label: 'Atendimento', icon: Headset },
        { value: 'engajamento', label: 'Engajar', icon: MessageCircle },
        { value: 'tendencias', label: 'Tendências', icon: TrendingUp },
        { value: 'faq', label: 'FAQ', icon: Book },
      ],
    },
    {
      label: 'Insights',
      tabs: [
        { value: 'metricas', label: 'Métricas', icon: BarChart3 },
        { value: 'plataformas', label: 'Canais', icon: Settings2 },
      ],
    },
  ];
  const totalIdeas = ideas.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b safe-area-pt">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" aria-label="Voltar para o início">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h1 className="text-lg font-bold truncate tracking-tight">Digital</h1>
              {!selectedIdea && (
                <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                  · {totalIdeas} {totalIdeas === 1 ? 'ideia' : 'ideias'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeTab === 'ideias' && !selectedIdea && (
              <div className="hidden sm:flex items-center rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Modo de visualização">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Visualizar em lista"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Visualizar em kanban"
                  aria-pressed={viewMode === 'kanban'}
                  onClick={() => setViewMode('kanban')}
                >
                  <Columns3 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button
              onClick={() => setShowCreateDialog(true)}
              size={isMobile ? 'icon' : 'default'}
              className="h-10 shrink-0 shadow-sm"
              aria-label="Criar nova ideia"
            >
              <Plus className="h-5 w-5" />
              {!isMobile && <span className="ml-2 font-medium">Nova Ideia</span>}
            </Button>
          </div>
        </div>

        {/* Tabs grouped */}
        {!selectedIdea && (
          <div className="px-2 pb-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <div className="flex items-stretch gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
                {tabGroups.map((group, gi) => (
                  <div key={group.label} className="flex items-center gap-1 shrink-0">
                    <TabsList className="h-9 bg-muted/50 p-0.5 rounded-lg">
                      {group.tabs.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className="h-8 px-2.5 text-xs gap-1.5 data-[state=active]:shadow-sm rounded-md"
                          aria-label={label}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="hidden md:inline font-medium">{label}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {gi < tabGroups.length - 1 && (
                      <Separator orientation="vertical" className="h-6 mx-0.5 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </Tabs>
          </div>
        )}

        {/* Search & Filters - only on ideas tab */}
        {!selectedIdea && activeTab === 'ideias' && (
          <div className="px-4 pb-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0 overflow-hidden">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar ideias, copy, KPI..."
                  className="pl-9 pr-9 h-10 w-full text-ellipsis placeholder:truncate"
                  aria-label="Pesquisar ideias, copy ou KPI"
                  title="Pesquisar ideias, copy ou KPI"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 touch-manipulation"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpar pesquisa"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 sm:w-auto sm:px-3 gap-2 shrink-0 touch-manipulation" aria-label="Abrir filtros">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filtros</span>
                    {activeFilterChips.length > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] tabular-nums">
                        {activeFilterChips.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Filtros</h3>
                    {activeFilterChips.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllFilters}>
                        Limpar tudo
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
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
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Canal</Label>
                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {Object.entries(groupedPlatforms || {}).map(([_group, platforms]) => (
                            platforms.map(platform => (
                              <SelectItem key={platform.id} value={platform.id}>
                                <div className="flex items-center gap-2">
                                  <PlatformIcon icon={platform.icon} size="sm" />
                                  {platform.name}
                                </div>
                              </SelectItem>
                            ))
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os tipos</SelectItem>
                          {ideaTypes.map(t => (
                            <SelectItem key={t.key} value={t.key}>
                              <div className="flex items-center gap-2">
                                <span>{t.icon}</span>{t.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {nodes.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Vínculo</Label>
                        <Select value={nodeFilter} onValueChange={setNodeFilter}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os vínculos</SelectItem>
                            {nodes.map(n => (
                              <SelectItem key={n.id} value={n.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: n.color }} />
                                  {n.title}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {products.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Produto</Label>
                        <Select value={productFilter} onValueChange={setProductFilter}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os produtos</SelectItem>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Período</Label>
                      <Select value={periodFilter} onValueChange={setPeriodFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os períodos</SelectItem>
                          <SelectItem value="esta_semana">Esta semana</SelectItem>
                          <SelectItem value="este_mes">Este mês</SelectItem>
                          <SelectItem value="proximo_mes">Próximo mês</SelectItem>
                          <SelectItem value="sem_data">Sem data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {viewMode === 'kanban' && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Modo do Kanban</Label>
                        <Select value={kanbanMode} onValueChange={(v) => setKanbanMode(v as any)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ideas">Por Ideia</SelectItem>
                            <SelectItem value="variations">Por Variação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Mobile-only view toggle - always visible on ideas tab */}
              {activeTab === 'ideias' && (
                <div className="flex sm:hidden items-center rounded-lg border bg-muted/40 p-0.5 shrink-0" role="group" aria-label="Modo de visualização">
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 touch-manipulation"
                    aria-label="Lista"
                    aria-pressed={viewMode === 'list'}
                    onClick={() => setViewMode('list')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 touch-manipulation"
                    aria-label="Kanban"
                    aria-pressed={viewMode === 'kanban'}
                    onClick={() => setViewMode('kanban')}
                  >
                    <Columns3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Active filter chips */}
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map(chip => (
                  <Badge
                    key={chip.key}
                    variant="secondary"
                    className="h-7 pl-2.5 pr-1 gap-1 text-xs font-normal"
                  >
                    {chip.label}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:bg-background/60"
                      onClick={chip.clear}
                      aria-label={`Remover filtro ${chip.label}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAllFilters}>
                  Limpar
                </Button>
              </div>
            )}

            {/* Status quick stats — clickable */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
              {Object.entries(DIGITAL_STATUS).map(([key, config]) => {
                const active = statusFilter === key;
                const count = stats.byStatus[key] || 0;
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(active ? 'all' : key)}
                    aria-pressed={active}
                    aria-label={`Filtrar por status ${config.label}, ${count} ideias`}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-foreground text-background border-foreground shadow-sm'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', config.color)} />
                    <span>{config.label}</span>
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
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
                ideas={displayedIdeas}
                onUpdateIdea={updateIdea}
                onUpdateVariation={updateVariation}
                onSelectIdea={setSelectedIdea}
                viewMode={kanbanMode}
                platforms={activePlatforms}
                nodes={nodes}
                products={products}
                ideaTypes={ideaTypes}
              />
            ) : (
              <div className="space-y-3">
                {displayedIdeas.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">Nenhuma ideia encontrada.</p>
                    <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeira Ideia
                    </Button>
                  </Card>
                ) : (
                  displayedIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onClick={() => setSelectedIdea(idea.id)}
                      platforms={activePlatforms}
                      nodes={nodes}
                      products={products}
                      ideaTypes={ideaTypes}
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
          ) : activeTab === 'atendimento' ? (
            <ServicePanel />
          ) : activeTab === 'engajamento' ? (
            <InteractionsPanel />
          ) : activeTab === 'faq' ? (
            <KnowledgeBasePanel />
          ) : activeTab === 'metricas' ? (
            <MetricsChart variations={allVariationsWithTitle} platforms={activePlatforms} />
          ) : (
            <div className="space-y-4">
              <IdeaTypesManager />
              <PlatformsManager />
            </div>
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
            <Label>Tipo da Ideia</Label>
            <Select
              value={newIdea.idea_type}
              onValueChange={(v) => setNewIdea({ ...newIdea, idea_type: v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ideaTypes.map(t => (
                  <SelectItem key={t.key} value={t.key}>
                    <div className="flex items-center gap-2">
                      <span>{t.icon}</span>
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {/* Product linking */}
          {products.length > 0 && (
            <ProductSelector
              products={products}
              value={newIdea.product_id || null}
              onChange={(productId) => {
                const updates: Record<string, string> = { product_id: productId || '' };
                // Auto-fill title from product
                if (productId) {
                  const product = products.find(p => p.id === productId);
                  if (product) {
                    if (!newIdea.title) updates.title = product.name;
                    if (!newIdea.objective && product.description) updates.objective = product.description;
                  }
                }
                setNewIdea(prev => ({ ...prev, ...updates }));
              }}
              label="Vincular Produto (opcional)"
            />
          )}
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
