import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Play, X, Clock, PackageCheck, Boxes, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStockCheckStore } from '@/stores/stockCheckStore';
import { supabase } from '@/integrations/supabase/client';

interface StockCheckSummary {
  activeProducts: number;
  lowStockProducts: number;
  totalBalance: number;
}

export function StockCheckAlert() {
  const [showAlert, setShowAlert] = useState(false);
  const [summary, setSummary] = useState<StockCheckSummary>({
    activeProducts: 0,
    lowStockProducts: 0,
    totalBalance: 0,
  });
  const hasCheckedRef = useRef(false);
  const { 
    shouldShowAlert, 
    skipToday, 
    remindIn2Hours, 
    openWizard,
    remindAt,
  } = useStockCheckStore();

  // Check ONLY ONCE on mount
  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    
    if (shouldShowAlert()) {
      setShowAlert(true);
    }
  }, []);

  useEffect(() => {
    if (!showAlert) return;

    const fetchSummary = async () => {
      const [{ data: products }, { data: inventory }] = await Promise.all([
        supabase
          .from('products')
          .select('id, min_stock')
          .eq('is_active', true)
          .is('deleted_at', null),
        supabase.from('inventory').select('product_id, quantity'),
      ]);

      const balances = (inventory || []).reduce<Record<string, number>>((acc, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + Number(item.quantity || 0);
        return acc;
      }, {});

      setSummary({
        activeProducts: products?.length || 0,
        lowStockProducts: (products || []).filter((product) => {
          const minStock = Number(product.min_stock || 0);
          return minStock > 0 && (balances[product.id] || 0) <= minStock;
        }).length,
        totalBalance: Object.values(balances).reduce((total, quantity) => total + quantity, 0),
      });
    };

    fetchSummary();
  }, [showAlert]);

  // Handle reminder expiry - show alert again when reminder time passes
  useEffect(() => {
    if (!remindAt || remindAt <= Date.now()) return;
    
    const timeout = setTimeout(() => {
      if (shouldShowAlert()) {
        setShowAlert(true);
      }
    }, remindAt - Date.now());
    
    return () => clearTimeout(timeout);
  }, [remindAt, shouldShowAlert]);

  const handleStart = () => {
    setShowAlert(false);
    openWizard();
  };

  const handleSkip = () => {
    skipToday();
    setShowAlert(false);
  };

  const handleRemind = () => {
    remindIn2Hours();
    setShowAlert(false);
  };

  // Close without action = skip for this session (don't show again until refresh)
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowAlert(false);
    }
  };

  if (!showAlert) return null;

  return (
    <AlertDialog open={showAlert} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg border-destructive/70 border-2">
        <AlertDialogHeader className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <AlertDialogTitle className="text-xl font-bold text-foreground">
                Estoque diário pendente
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed">
                Revise os saldos críticos antes de seguir com a produção do dia.
              </AlertDialogDescription>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                <Boxes className="h-4 w-4" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Itens</span>
              </div>
              <p className="text-2xl font-bold leading-none">{summary.activeProducts}</p>
              <p className="mt-1 text-xs text-muted-foreground">ativos</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Críticos</span>
              </div>
              <p className="text-2xl font-bold leading-none text-destructive">{summary.lowStockProducts}</p>
              <p className="mt-1 text-xs text-muted-foreground">baixo estoque</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                <PackageCheck className="h-4 w-4" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Saldo</span>
              </div>
              <p className="text-2xl font-bold leading-none">{summary.totalBalance.toLocaleString('pt-BR')}</p>
              <p className="mt-1 text-xs text-muted-foreground">unidades</p>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleStart} 
            className="w-full h-12 text-base bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <Play className="h-5 w-5 mr-2" />
            Conferir estoque agora
          </Button>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              onClick={handleSkip} 
              className="h-10 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Pular Hoje
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRemind} 
              className="h-10 text-muted-foreground"
            >
              <Clock className="h-4 w-4 mr-2" />
              Lembrar em 2h
            </Button>
          </div>
          <p className="pt-1 text-center text-xs text-muted-foreground">
            Essas opções não alteram o estoque; apenas controlam este aviso.
          </p>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
