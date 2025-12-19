import { useState, useEffect } from 'react';
import { useMRP, MaterialNeed, PurchaseSuggestion } from '@/hooks/useMRP';
import { Order } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ShoppingBag, Package, Download, RefreshCw, Check, Play, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MRPTabProps {
  orders?: Order[];
  onReserve?: (order: Order) => Promise<void>;
  onConsume?: (order: Order) => Promise<void>;
}

export function MRPTab({ orders = [], onReserve, onConsume }: MRPTabProps) {
  const { calculateMaterialNeeds, getPurchaseSuggestions } = useMRP();
  const [needs, setNeeds] = useState<MaterialNeed[]>([]);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [needsData, suggestionsData] = await Promise.all([
      calculateMaterialNeeds(),
      getPurchaseSuggestions(),
    ]);
    setNeeds(needsData);
    setSuggestions(suggestionsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCSV = () => {
    const headers = ['Material', 'SKU', 'Necessário', 'Estoque', 'Reservado', 'Falta', 'Pedidos'];
    const rows = needs.map(n => [
      n.component_name,
      n.component_sku,
      n.total_needed.toString(),
      n.stock_available.toString(),
      n.reserved.toString(),
      n.shortage.toString(),
      n.orders_affected.join('; '),
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrp-necessidades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Relatório exportado!');
  };

  const handleExportPurchase = () => {
    const headers = ['Material', 'SKU', 'Quantidade', 'Unidade', 'Urgência'];
    const rows = suggestions.map(s => [
      s.component_name,
      s.component_sku,
      s.suggested_qty.toString(),
      s.unit,
      s.urgency === 'high' ? 'Alta' : s.urgency === 'medium' ? 'Média' : 'Baixa',
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrp-compras-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Lista de compras exportada!');
  };

  const handleReserve = async (order: Order) => {
    if (!onReserve) return;
    setActionLoading(order.id + '-reserve');
    await onReserve(order);
    setActionLoading(null);
    loadData();
  };

  const handleConsume = async (order: Order) => {
    if (!onConsume) return;
    setActionLoading(order.id + '-consume');
    await onConsume(order);
    setActionLoading(null);
    loadData();
  };

  // Get orders that can be confirmed (draft status)
  const draftOrders = orders.filter(o => o.status === 'rascunho' && o.items && o.items.length > 0);
  // Get orders that can start production (confirmed status)
  const confirmedOrders = orders.filter(o => o.status === 'confirmado' && o.items && o.items.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Calculando necessidades...</p>
      </div>
    );
  }

  const hasShortages = needs.some(n => n.shortage > 0);
  const totalShortages = needs.filter(n => n.shortage > 0).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={cn(hasShortages && 'border-amber-500/50')}>
          <CardContent className="pt-4 text-center">
            <div className="flex items-center justify-center gap-2">
              {hasShortages && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              <p className="text-3xl font-bold">{totalShortages}</p>
            </div>
            <p className="text-xs text-muted-foreground">Itens em Falta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{needs.length}</p>
            <p className="text-xs text-muted-foreground">Materiais Necessários</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={loadData} className="flex-1">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
        <Button variant="outline" size="icon" onClick={handleExportCSV}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Order Actions - Confirm Orders */}
      {draftOrders.length > 0 && onReserve && (
        <Card className="border-blue-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              Confirmar Pedidos ({draftOrders.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Reservar insumos para os pedidos abaixo
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {draftOrders.map(order => (
              <div 
                key={order.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {order.customer_name || `#${order.order_number || order.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.items?.length || 0} itens • R$ {(order.total_value || 0).toFixed(2)}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleReserve(order)}
                  disabled={actionLoading === order.id + '-reserve'}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {actionLoading === order.id + '-reserve' ? 'Reservando...' : 'Confirmar'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Order Actions - Start Production */}
      {confirmedOrders.length > 0 && onConsume && (
        <Card className="border-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              Iniciar Produção ({confirmedOrders.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Consumir insumos e iniciar produção
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {confirmedOrders.map(order => (
              <div 
                key={order.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {order.customer_name || `#${order.order_number || order.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.items?.length || 0} itens • R$ {(order.total_value || 0).toFixed(2)}
                  </p>
                </div>
                <Button 
                  size="sm"
                  variant="default"
                  onClick={() => handleConsume(order)}
                  disabled={actionLoading === order.id + '-consume'}
                >
                  <Play className="h-4 w-4 mr-1" />
                  {actionLoading === order.id + '-consume' ? 'Iniciando...' : 'Iniciar'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Purchase Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-amber-500" />
                Sugestão de Compra ({suggestions.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleExportPurchase}>
                <Download className="h-3 w-3 mr-1" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-center">Urgência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => (
                    <TableRow key={s.component_id}>
                      <TableCell>
                        <span className="font-medium">{s.component_name}</span>
                        <span className="text-xs text-muted-foreground block">{s.component_sku}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.suggested_qty} {s.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            'text-white',
                            s.urgency === 'high' && 'bg-red-500',
                            s.urgency === 'medium' && 'bg-amber-500',
                            s.urgency === 'low' && 'bg-blue-500'
                          )}
                        >
                          {s.urgency === 'high' ? 'Alta' : s.urgency === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Material Needs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Necessidade de Materiais
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {needs.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma necessidade calculada. Configure BOM nos produtos e crie pedidos confirmados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Necessário</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needs.map((n) => (
                    <TableRow key={n.component_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {n.shortage > 0 && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                          <div>
                            <span className="font-medium">{n.component_name}</span>
                            <span className="text-xs text-muted-foreground block">{n.component_sku}</span>
                            {n.orders_affected.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                Pedidos: {n.orders_affected.slice(0, 3).join(', ')}
                                {n.orders_affected.length > 3 && '...'}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{n.total_needed}</TableCell>
                      <TableCell className="text-right font-mono">
                        {n.stock_available}
                        {n.reserved > 0 && (
                          <span className="text-xs text-amber-600 block">-{n.reserved} res.</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono font-bold",
                        n.shortage > 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {n.shortage > 0 ? `-${n.shortage}` : <Check className="h-4 w-4 inline" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}