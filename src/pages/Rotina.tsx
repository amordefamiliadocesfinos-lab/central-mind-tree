import { useState } from 'react';
import { useRoutineBlocks, RoutineBlock } from '@/hooks/useRoutineBlocks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Check, SkipForward, Plus, Coffee, BarChart3, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Rotina() {
  const {
    blocks,
    loading,
    activeBlock,
    startBlock,
    completeBlock,
    skipBlock,
    addBlock,
    insertPause,
    generateFromTemplates,
    calculateKPIs,
    blockTypes,
  } = useRoutineBlocks();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newBlock, setNewBlock] = useState({
    title: '',
    block_type: 'foco',
    duration_minutes: 25,
    planned_start: '',
  });

  const kpis = calculateKPIs();

  const handleAddBlock = async () => {
    await addBlock(newBlock);
    setShowAddDialog(false);
    setNewBlock({ title: '', block_type: 'foco', duration_minutes: 25, planned_start: '' });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    return time.slice(0, 5);
  };

  const getBlockProgress = (block: RoutineBlock) => {
    if (block.status !== 'andamento' || !block.actual_start) return 0;
    const start = new Date(block.actual_start).getTime();
    const elapsed = Date.now() - start;
    const total = block.duration_minutes * 60 * 1000;
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando rotina...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-area-pt">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-2xl font-bold truncate">Rotina do Dia</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateFromTemplates} className="hidden sm:flex">
              Gerar do Template
            </Button>
            <Button variant="outline" size="icon" onClick={generateFromTemplates} className="sm:hidden h-10 w-10">
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="h-10 px-3 sm:px-4">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPIs Summary - Mobile optimized grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resumo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
              <div className="p-2 sm:p-0">
                <p className="text-xl sm:text-2xl font-bold">{kpis.completed}/{kpis.totalBlocks}</p>
                <p className="text-xs text-muted-foreground">Blocos</p>
              </div>
              <div className="p-2 sm:p-0">
                <p className="text-xl sm:text-2xl font-bold">{kpis.executedMinutes}</p>
                <p className="text-xs text-muted-foreground">Min Executados</p>
              </div>
              <div className="p-2 sm:p-0">
                <p className="text-xl sm:text-2xl font-bold">{kpis.adherence}%</p>
                <p className="text-xs text-muted-foreground">Aderência</p>
              </div>
              <div className="p-2 sm:p-0">
                <p className="text-xl sm:text-2xl font-bold">{kpis.skipped}</p>
                <p className="text-xs text-muted-foreground">Pulados</p>
              </div>
            </div>
            {Object.keys(kpis.byType).length > 0 && (
              <div className="mt-4 flex gap-2 flex-wrap overflow-x-auto scrollbar-hide">
                {Object.entries(kpis.byType).map(([type, data]) => (
                  <div
                    key={type}
                    className={cn(
                      'px-2 py-1 rounded text-xs text-white whitespace-nowrap',
                      blockTypes[type as keyof typeof blockTypes]?.color || 'bg-gray-500'
                    )}
                  >
                    {blockTypes[type as keyof typeof blockTypes]?.label || type}: {data.executed}/{data.planned}min
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        {blocks.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Nenhum bloco para hoje.</p>
            <Button onClick={generateFromTemplates} className="h-12">
              Gerar Rotina do Template
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {blocks.map((block, index) => (
              <Card
                key={block.id}
                className={cn(
                  'transition-all active:scale-[0.98]',
                  block.status === 'andamento' && 'ring-2 ring-primary',
                  block.status === 'concluido' && 'opacity-60',
                  block.status === 'pulado' && 'opacity-40'
                )}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Time */}
                    <div className="text-center w-14 sm:w-16 flex-shrink-0">
                      <p className="text-base sm:text-lg font-mono font-bold">
                        {formatTime(block.planned_start)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {block.duration_minutes}min
                      </p>
                    </div>

                    {/* Type indicator */}
                    <div
                      className={cn(
                        'w-1.5 sm:w-2 h-10 sm:h-12 rounded-full flex-shrink-0',
                        blockTypes[block.block_type as keyof typeof blockTypes]?.color || 'bg-gray-500'
                      )}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium truncate">{block.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted whitespace-nowrap">
                          {blockTypes[block.block_type as keyof typeof blockTypes]?.label || block.block_type}
                        </span>
                      </div>
                      {block.status === 'andamento' && (
                        <Progress value={getBlockProgress(block)} className="mt-2 h-1" />
                      )}
                      {block.status === 'concluido' && (
                        <p className="text-xs text-green-500 mt-1">✓ Concluído</p>
                      )}
                      {block.status === 'pulado' && (
                        <p className="text-xs text-muted-foreground mt-1">Pulado</p>
                      )}
                    </div>

                    {/* Actions - touch-friendly */}
                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                      {block.status === 'pendente' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => startBlock(block.id)}
                            className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 p-0"
                          >
                            <Play className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1">Iniciar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => skipBlock(block.id)}
                            className="h-10 w-10 p-0"
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {block.status === 'andamento' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => completeBlock(block.id)}
                          className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 p-0"
                        >
                          <Check className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">Concluir</span>
                        </Button>
                      )}
                      {block.status === 'pendente' && index < blocks.length - 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => insertPause(block.id)}
                          title="Inserir pausa após"
                          className="h-10 w-10 p-0 hidden sm:flex"
                        >
                          <Coffee className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Block Dialog - Responsive */}
      <ResponsiveDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        title="Novo Bloco"
      >
        <div className="space-y-4 p-4 sm:p-0">
          <div>
            <Label>Título</Label>
            <Input
              className="h-12"
              value={newBlock.title}
              onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
              placeholder="Nome do bloco"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select
              value={newBlock.block_type}
              onValueChange={(v) => setNewBlock({ ...newBlock, block_type: v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(blockTypes).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duração (min)</Label>
            <Input
              type="number"
              className="h-12"
              value={newBlock.duration_minutes}
              onChange={(e) => setNewBlock({ ...newBlock, duration_minutes: parseInt(e.target.value) || 25 })}
            />
          </div>
          <div>
            <Label>Horário Planejado</Label>
            <Input
              type="time"
              className="h-12"
              value={newBlock.planned_start}
              onChange={(e) => setNewBlock({ ...newBlock, planned_start: e.target.value })}
            />
          </div>
          <Button onClick={handleAddBlock} className="w-full h-12">
            Adicionar
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
