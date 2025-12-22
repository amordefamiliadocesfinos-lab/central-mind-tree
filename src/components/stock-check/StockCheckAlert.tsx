import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Play, X, Clock } from 'lucide-react';
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

export function StockCheckAlert() {
  const [showAlert, setShowAlert] = useState(false);
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
      <AlertDialogContent className="max-w-md border-destructive border-2">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive-foreground" />
          </div>
          <AlertDialogTitle className="text-2xl font-bold text-destructive text-center">
            ATUALIZAR ESTOQUE DIÁRIO
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base">
            É hora de verificar e atualizar o estoque de seus materiais. 
            Mantenha os saldos atualizados para evitar problemas de produção.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleStart} 
            className="w-full h-14 text-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <Play className="h-5 w-5 mr-2" />
            Iniciar Agora
          </Button>
          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={handleSkip} 
              className="flex-1 h-12"
            >
              <X className="h-4 w-4 mr-2" />
              Pular Hoje
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRemind} 
              className="flex-1 h-12"
            >
              <Clock className="h-4 w-4 mr-2" />
              Lembrar em 2h
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
