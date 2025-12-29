import { useState, useEffect } from 'react';
import { useProductionClosing, ProductionClosing, CLOSING_STATUS } from '@/hooks/useProductionClosing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Calendar, Users, Check, Trash2, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ProductionClosingTab() {
  const { 
    closings, 
    loading, 
    createClosing, 
    markAsPaid, 
    deleteClosing,
    getClosingSummaryByEmployee,
  } = useProductionClosing();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<ProductionClosing | null>(null);
  const [formData, setFormData] = useState({
    start_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const handleCreate = async () => {
    await createClosing(formData.start_date, formData.end_date, formData.notes || undefined);
    setShowCreateDialog(false);
    setFormData({
      start_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
  };

  const handleMarkAsPaid = async (id: string) => {
    if (confirm('Marcar este fechamento como pago?')) {
      await markAsPaid(id);
      setSelectedClosing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este fechamento?')) {
      await deleteClosing(id);
      setSelectedClosing(null);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-4">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fechamentos ({closings.length})
        </h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fechamento
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(closings
                .filter(c => c.status === 'pago')
                .reduce((sum, c) => sum + c.total_value, 0))}
            </p>
            <p className="text-xs text-muted-foreground">Total Pago</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-amber-600">
              {formatCurrency(closings
                .filter(c => c.status === 'aberto')
                .reduce((sum, c) => sum + c.total_value, 0))}
            </p>
            <p className="text-xs text-muted-foreground">Em Aberto</p>
          </CardContent>
        </Card>
      </div>

      {/* Closings List */}
      <div className="space-y-2">
        {closings.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhum fechamento ainda</p>
          </Card>
        ) : (
          closings.map((closing) => {
            const statusConfig = CLOSING_STATUS[closing.status as keyof typeof CLOSING_STATUS];
            
            return (
              <Card 
                key={closing.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedClosing(closing)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(closing.start_date), "dd/MM", { locale: ptBR })} - {format(new Date(closing.end_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <Badge className={cn("text-xs text-white", statusConfig?.color)}>
                          {statusConfig?.label}
                        </Badge>
                      </div>
                      {closing.notes && (
                        <p className="text-sm text-muted-foreground">{closing.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {(closing.items || []).length} funcionário(s)
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(closing.total_value)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fechamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  className="h-12"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  className="h-12"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <Button className="w-full h-12" onClick={handleCreate}>
              Gerar Fechamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Closing Details Dialog */}
      <Dialog open={!!selectedClosing} onOpenChange={(open) => !open && setSelectedClosing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedClosing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Fechamento
                  <Badge className={cn(
                    "text-xs text-white",
                    CLOSING_STATUS[selectedClosing.status as keyof typeof CLOSING_STATUS]?.color
                  )}>
                    {CLOSING_STATUS[selectedClosing.status as keyof typeof CLOSING_STATUS]?.label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Período:</span>
                      <span>
                        {format(new Date(selectedClosing.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(selectedClosing.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-bold text-lg text-green-600">
                        {formatCurrency(selectedClosing.total_value)}
                      </span>
                    </div>
                    {selectedClosing.notes && (
                      <div>
                        <span className="text-muted-foreground">Obs:</span>
                        <p className="text-sm">{selectedClosing.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* By Employee */}
                {(() => {
                  const byEmployee = getClosingSummaryByEmployee(selectedClosing);
                  
                  return Object.entries(byEmployee).map(([employee, data]) => (
                    <Card key={employee}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {employee}
                          <Badge className="ml-auto bg-green-600">
                            {formatCurrency(data.total)}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {data.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.process?.name || 'Processo'}
                            </span>
                            <span>
                              {item.total_quantity} un = {formatCurrency(item.total_value)}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ));
                })()}

                {/* Actions */}
                <div className="flex gap-2">
                  {selectedClosing.status === 'aberto' && (
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleMarkAsPaid(selectedClosing.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Marcar como Pago
                    </Button>
                  )}
                  <Button 
                    variant="destructive"
                    onClick={() => handleDelete(selectedClosing.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
