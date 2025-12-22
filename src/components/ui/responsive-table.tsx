import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  mobileRender?: (item: T) => React.ReactNode;
  hideOnMobile?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  mobileCardRender?: (item: T) => React.ReactNode;
  className?: string;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  onRowClick,
  isLoading = false,
  emptyMessage = "Nenhum item encontrado",
  mobileCardRender,
  className,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </Card>
    );
  }

  // Mobile view - cards
  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((item) => {
          const key = String(item[keyField]);
          
          // Custom mobile card render
          if (mobileCardRender) {
            return (
              <div 
                key={key}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {mobileCardRender(item)}
              </div>
            );
          }

          // Default mobile card
          return (
            <Card 
              key={key}
              className={cn(
                "touch-manipulation active:scale-[0.98] transition-transform",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(item)}
            >
              <CardContent className="p-4">
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((col) => {
                    const value = col.mobileRender 
                      ? col.mobileRender(item)
                      : col.render 
                        ? col.render(item)
                        : String(item[col.key as keyof T] ?? "");
                    
                    return (
                      <div key={String(col.key)} className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">{col.header}</span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop view - table
  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.key)} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const key = String(item[keyField]);
            return (
              <TableRow 
                key={key}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => {
                  const value = col.render 
                    ? col.render(item)
                    : String(item[col.key as keyof T] ?? "");
                  
                  return (
                    <TableCell key={String(col.key)} className={col.className}>
                      {value}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
