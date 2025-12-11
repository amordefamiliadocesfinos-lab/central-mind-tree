import { useState } from 'react';
import { useRoutineBlocks, RoutineBlock } from '@/hooks/useRoutineBlocks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
    <div className="min-h-screen bg-background p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Rotina do Dia</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateFromTemplates}>
            Gerar do Template
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Bloco
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Bloco</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
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
                    <SelectTrigger>
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
                    value={newBlock.duration_minutes}
                    onChange={(e) => setNewBlock({ ...newBlock, duration_minutes: parseInt(e.target.value) || 25 })}
                  />
                </div>
                <div>
                  <Label>Horário Planejado</Label>
                  <Input
                    type="time"
                    value={newBlock.planned_start}
                    onChange={(e) => setNewBlock({ ...newBlock, planned_start: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddBlock} className="w-full">
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs Summary */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumo do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{kpis.completed}/{kpis.totalBlocks}</p>
              <p className="text-xs text-muted-foreground">Blocos</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.executedMinutes}</p>
              <p className="text-xs text-muted-foreground">Min Executados</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.adherence}%</p>
              <p className="text-xs text-muted-foreground">Aderência</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.skipped}</p>
              <p className="text-xs text-muted-foreground">Pulados</p>
            </div>
          </div>
          {Object.keys(kpis.byType).length > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {Object.entries(kpis.byType).map(([type, data]) => (
                <div
                  key={type}
                  className={cn(
                    'px-2 py-1 rounded text-xs text-white',
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
          <Button onClick={generateFromTemplates}>
            Gerar Rotina do Template
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <Card
              key={block.id}
              className={cn(
                'transition-all',
                block.status === 'andamento' && 'ring-2 ring-primary',
                block.status === 'concluido' && 'opacity-60',
                block.status === 'pulado' && 'opacity-40'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Time */}
                  <div className="text-center w-16">
                    <p className="text-lg font-mono font-bold">
                      {formatTime(block.planned_start)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {block.duration_minutes}min
                    </p>
                  </div>

                  {/* Type indicator */}
                  <div
                    className={cn(
                      'w-2 h-12 rounded-full',
                      blockTypes[block.block_type as keyof typeof blockTypes]?.color || 'bg-gray-500'
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{block.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">
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

                  {/* Actions */}
                  <div className="flex gap-2">
                    {block.status === 'pendente' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => startBlock(block.id)}
                          className="gap-1"
                        >
                          <Play className="h-3 w-3" />
                          Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => skipBlock(block.id)}
                        >
                          <SkipForward className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {block.status === 'andamento' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => completeBlock(block.id)}
                        className="gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Concluir
                      </Button>
                    )}
                    {block.status === 'pendente' && index < blocks.length - 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => insertPause(block.id)}
                        title="Inserir pausa após"
                      >
                        <Coffee className="h-3 w-3" />
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
  );
}
