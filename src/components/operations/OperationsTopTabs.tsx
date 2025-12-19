import { ShoppingCart, Factory, Boxes, Package, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationsTab } from "@/components/operations/OperationsBottomNav";

const TOP_TABS: { id: OperationsTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "orders", label: "Pedidos", icon: ShoppingCart },
  { id: "production", label: "Produção", icon: Factory },
  { id: "mrp", label: "MRP", icon: Boxes },
  { id: "inventory", label: "Estoque", icon: Boxes },
  { id: "products", label: "Produtos", icon: Package },
];

interface OperationsTopTabsProps {
  activeTab: OperationsTab;
  onTabChange: (tab: OperationsTab) => void;
}

export function OperationsTopTabs({ activeTab, onTabChange }: OperationsTopTabsProps) {
  return (
    <nav aria-label="Seções de operações" className="w-full">
      <div className="rounded-xl border bg-card/50 p-1">
        <div className="grid grid-cols-6 gap-1">
          {TOP_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
