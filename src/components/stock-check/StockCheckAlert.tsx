import { useEffect, useState } from 'react';
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
  const { 
    shouldShowAlert, 
    skipToday, 
    remindIn2Hours, 
    openWizard,
    remindAt,
    clearReminder,
  } = useStockCheckStore();

  // Check on mount and when remindAt changes
  useEffect(() => {
    const check = () => {
      setShowAlert(shouldShowAlert());
    };
    
    check();
    
    // Set up interval to check reminder expiry
    const interval = setInterval(check, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [shouldShowAlert, remindAt]);

  // Also check when remindAt expires
  useEffect(() => {
    if (remindAt && remindAt > Date.now()) {
      const timeout = setTimeout(() => {
        clearReminder();
        setShowAlert(shouldShowAlert());
      }, remindAt - Date.now());
      
      return () => clearTimeout(timeout);
    }
  }, [remindAt, clearReminder, shouldShowAlert]);

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

  if (!showAlert) return null;

  return (
    <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
      <AlertDialogContent className="max-w-md border-red-500 border-2">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <AlertDialogTitle className="text-2xl font-bold text-red-500 text-center">
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
            className="w-full h-14 text-lg bg-red-500 hover:bg-red-600"
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
