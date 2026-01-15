import { useState } from 'react';
import { useDigital, DIGITAL_STATUS, PLATFORMS } from '@/hooks/useDigital';
import { IdeaCard, IdeaEditor } from '@/components/digital';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Digital() {
  const {
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
    toggleVariationChecklist,
  } = useDigital();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [newIdea, setNewIdea] = useState({ title: '', objective: '' });
  const isMobile = useIsMobile();

  const handleCreateIdea = async () => {
    const idea = await createIdea(newIdea);
    if (idea) {
      setShowCreateDialog(false);
      setNewIdea({ title: '', objective: '' });
      setSelectedIdea(idea.id);
    }
  };

  const selectedIdeaData = filteredIdeas.find(i => i.id === selectedIdea);

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

          <Button
            onClick={() => setShowCreateDialog(true)}
            size={isMobile ? 'icon' : 'default'}
            className="h-10 shrink-0"
          >
            <Plus className="h-5 w-5" />
            {!isMobile && <span className="ml-2">Nova Ideia</span>}
          </Button>
        </div>

        {/* Search & Filters */}
        {!selectedIdea && (
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
                  {Object.entries(PLATFORMS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <main className="px-4 py-4 pb-24 space-y-3">
        {selectedIdeaData ? (
          <IdeaEditor
            idea={selectedIdeaData}
            onBack={() => setSelectedIdea(null)}
            onUpdate={updateIdea}
            onDelete={deleteIdea}
            onCreateVariation={createVariation}
            onUpdateVariation={updateVariation}
            onDeleteVariation={deleteVariation}
            onToggleChecklist={toggleVariationChecklist}
          />
        ) : (
          <>
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
                />
              ))
            )}
          </>
        )}
      </main>

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
