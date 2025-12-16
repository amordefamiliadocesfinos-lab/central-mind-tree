import { useState, useEffect } from 'react';
import { useMRP, MaterialNeed, PurchaseSuggestion } from '@/hooks/useMRP';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ShoppingBag, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MRPPanel() {
  const { calculateMaterialNeeds, getPurchaseSuggestions } = useMRP();
  const [needs, setNeeds] = useState<MaterialNeed[]>([]);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Calculando necessidades...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Purchase Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-amber-500" />
              Sugestão de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
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
        <CardContent>
          {needs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma necessidade calculada. Configure BOM nos produtos e crie pedidos confirmados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Necessário</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {needs.map((n) => (
                  <TableRow key={n.component_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {n.shortage > 0 && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <div>
                          <span className="font-medium">{n.component_name}</span>
                          <span className="text-xs text-muted-foreground block">{n.component_sku}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{n.total_needed}</TableCell>
                    <TableCell className="text-right font-mono">{n.stock_available}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{n.reserved}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-bold",
                      n.shortage > 0 ? "text-red-500" : "text-green-500"
                    )}>
                      {n.shortage > 0 ? `-${n.shortage}` : 'OK'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
