import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, XCircle, Info, Send, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FiscalValidationResult, FiscalIssue } from '@/lib/invoiceValidation';

interface InvoiceValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: FiscalValidationResult | null;
  onFix: (issue: FiscalIssue) => void;
  onConfirmIssue: () => void;
  loading?: boolean;
}

export function InvoiceValidationDialog({
  open,
  onOpenChange,
  result,
  onFix,
  onConfirmIssue,
  loading,
}: InvoiceValidationDialogProps) {
  if (!result) return null;

  const hasErrors = result.errorsCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                ⚠ Dados incompletos para emissão
              </>
            ) : result.warningsCount > 0 ? (
              <>
                <Info className="h-5 w-5 text-blue-500" />
                Pronto para emitir, com avisos
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Validação fiscal aprovada
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Resumo */}
          <div className="flex items-center gap-2 text-sm">
            {result.errorsCount > 0 && (
              <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                {result.errorsCount} erro(s)
              </Badge>
            )}
            {result.warningsCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                {result.warningsCount} aviso(s)
              </Badge>
            )}
            {result.errorsCount === 0 && result.warningsCount === 0 && (
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                Tudo certo
              </Badge>
            )}
          </div>

          {/* Mensagem principal */}
          {hasErrors && (
            <p className="text-sm text-muted-foreground">
              Corrija os itens abaixo antes de emitir a nota fiscal. Isso evita rejeição na SEFAZ
              e problemas com o Fisco.
            </p>
          )}

          {/* Lista de issues */}
          {result.issues.length > 0 && (
            <div className="max-h-80 overflow-y-auto space-y-2 border rounded-lg p-2 bg-muted/30">
              {result.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-md border p-3 bg-card',
                    issue.severity === 'erro'
                      ? 'border-red-500/30'
                      : 'border-amber-500/30'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {issue.severity === 'erro' ? (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{issue.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{issue.message}</div>
                      {issue.fixHint && (
                        <div className="text-[11px] text-muted-foreground/80 mt-1 italic">
                          💡 {issue.fixHint}
                        </div>
                      )}
                      {issue.fixTarget && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onFix(issue)}
                          className="gap-1 h-7 mt-2"
                        >
                          <Wrench className="h-3 w-3" />
                          Corrigir agora
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {!hasErrors && (
            <Button onClick={onConfirmIssue} disabled={loading} className="gap-2">
              <Send className="h-4 w-4" />
              {result.warningsCount > 0 ? 'Emitir mesmo assim' : 'Emitir nota'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
