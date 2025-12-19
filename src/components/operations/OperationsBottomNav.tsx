import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Boxes, Factory, Calendar, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OperationsTab = 'overview' | 'orders' | 'products' | 'inventory' | 'production' | 'mrp' | 'calendar';

interface OperationsBottomNavProps {
  activeTab: OperationsTab;
  onTabChange: (tab: OperationsTab) => void;
}

const tabs: { id: OperationsTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Geral', icon: LayoutGrid },
  { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'inventory', label: 'Estoque', icon: Boxes },
  { id: 'production', label: 'Produção', icon: Factory },
  { id: 'mrp', label: 'MRP', icon: Boxes },
  { id: 'calendar', label: 'Agenda', icon: Calendar },
];

export function OperationsBottomNav({ activeTab, onTabChange }: OperationsBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border safe-area-pb">
      <div className="flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-colors touch-manipulation",
                "active:bg-accent/50 rounded-lg",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 mb-0.5", isActive && "text-primary")} />
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isActive && "text-primary font-semibold"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
