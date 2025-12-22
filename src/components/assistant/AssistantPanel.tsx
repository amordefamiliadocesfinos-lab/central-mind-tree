import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle, X, Settings, ChevronRight, Play, Pause, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAutomationRules, AutomationAlert } from '@/hooks/useAutomationRules';
import { useNavigate } from 'react-router-dom';

export function AssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { alerts, checkRules, dismissAlert, dismissAllAlerts, loading } = useAutomationRules();
  const navigate = useNavigate();

  // Check rules on mount and periodically
  useEffect(() => {
    checkRules();
    
    // Check every 5 minutes
    const interval = setInterval(checkRules, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkRules]);

  const getAlertIcon = (alert: AutomationAlert) => {
    switch (alert.rule.trigger_type) {
      case 'on_hold_days':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'due_date_approaching':
        return <Calendar className="h-4 w-4 text-destructive" />;
      case 'stale_task':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  const handleGoToTask = (taskId: string) => {
    navigate(`/tarefas/${taskId}`);
    setIsOpen(false);
  };

  const handleStartTask = (taskId: string) => {
    // Navigate to Foco with this task
    navigate('/foco', { state: { startTaskId: taskId } });
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          aria-label="Assistente"
        >
          <Bell className="h-5 w-5" />
          {alerts.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {alerts.length > 9 ? '9+' : alerts.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Assistente
            </SheetTitle>
            {alerts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={dismissAllAlerts}>
                Limpar tudo
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum alerta no momento</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você está em dia com suas tarefas!
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Card key={alert.id} className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <CardHeader className="pb-2 pr-10">
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert)}
                        <CardTitle className="text-sm font-medium">
                          {alert.rule.name}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {alert.taskTitle}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {alert.message}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleGoToTask(alert.taskId)}
                        >
                          <ChevronRight className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                        <Button 
                          size="sm"
                          className="flex-1"
                          onClick={() => handleStartTask(alert.taskId)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Iniciar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              navigate('/planejamento?tab=automacao');
              setIsOpen(false);
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurar Regras
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
