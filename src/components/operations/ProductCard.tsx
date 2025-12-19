import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Image, AlertTriangle, ArrowUpDown, History, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/hooks/useOrders';

interface ProductCardProps {
  product: Product;
  balance: number;
  onEdit: (product: Product) => void;
  onMovement?: (product: { id: string; name: string; balance: number }) => void;
  onHistory?: (productId: string) => void;
  showInventoryActions?: boolean;
}

export function ProductCard({ 
  product, 
  balance, 
  onEdit, 
  onMovement, 
  onHistory,
  showInventoryActions = false 
}: ProductCardProps) {
  const isLow = balance <= product.min_stock;

  return (
    <Card 
      className="touch-manipulation active:scale-[0.98] transition-transform"
      onClick={() => !showInventoryActions && onEdit(product)}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {product.cover_image_url ? (
            <img 
              src={product.cover_image_url} 
              alt={product.name}
              className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Image className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
              </div>
              {isLow && (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              )}
            </div>
            
            {product.category && (
              <Badge variant="secondary" className="text-xs mt-1">
                {product.category}
              </Badge>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-bold">
                R$ {(product.price || 0).toFixed(2)}
              </span>
              <span className={cn(
                "text-xs",
                isLow ? "text-amber-500 font-bold" : "text-muted-foreground"
              )}>
                Est: {balance} {product.unit || 'un'}
              </span>
            </div>
          </div>
        </div>
        
        {showInventoryActions && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-10"
              onClick={(e) => {
                e.stopPropagation();
                onMovement?.({ id: product.id, name: product.name, balance });
              }}
            >
              <ArrowUpDown className="h-4 w-4 mr-1" />
              Movimentar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10"
              onClick={(e) => {
                e.stopPropagation();
                onHistory?.(product.id);
              }}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
