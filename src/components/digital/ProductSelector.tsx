import { useState, useMemo } from 'react';
import { ProductListItem } from '@/hooks/useProductsList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  products: ProductListItem[];
  value: string | null;
  onChange: (productId: string | null) => void;
  label?: string;
  className?: string;
}

export function ProductSelector({ products, value, onChange, label = 'Vincular Produto', className }: ProductSelectorProps) {
  const selectedProduct = products.find(p => p.id === value);

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="flex items-center gap-2">
        <Package className="h-4 w-4" />
        {label}
      </Label>
      <Select
        value={value || '__none__'}
        onValueChange={(v) => onChange(v === '__none__' ? null : v)}
      >
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Nenhum produto vinculado">
            {selectedProduct ? (
              <div className="flex items-center gap-2 truncate">
                {selectedProduct.cover_image_url ? (
                  <img
                    src={selectedProduct.cover_image_url}
                    alt=""
                    className="h-5 w-5 rounded object-cover shrink-0"
                  />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{selectedProduct.name}</span>
                <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                  {selectedProduct.sku}
                </Badge>
              </div>
            ) : (
              'Nenhum produto vinculado'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="__none__">Nenhum</SelectItem>
          {products.map(product => (
            <SelectItem key={product.id} value={product.id}>
              <div className="flex items-center gap-2">
                {product.cover_image_url ? (
                  <img
                    src={product.cover_image_url}
                    alt=""
                    className="h-5 w-5 rounded object-cover shrink-0"
                  />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{product.name}</span>
                <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                  {product.sku}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedProduct && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          {selectedProduct.cover_image_url && (
            <img
              src={selectedProduct.cover_image_url}
              alt=""
              className="h-8 w-8 rounded object-cover shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground truncate">{selectedProduct.name}</div>
            {selectedProduct.category && <span>{selectedProduct.category}</span>}
            {selectedProduct.price && <span className="ml-2">R$ {selectedProduct.price.toFixed(2)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
