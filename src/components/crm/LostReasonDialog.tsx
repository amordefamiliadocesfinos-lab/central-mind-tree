import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const LOST_REASONS = [
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'sem_dinheiro', label: 'Sem dinheiro' },
  { value: 'comprou_concorrente', label: 'Comprou concorrente' },
  { value: 'nao_respondeu', label: 'Não respondeu' },
  { value: 'outro', label: 'Outro' },
] as const;

interface Props {
  open: boolean;
  contactName?: string;
  onCancel: () => void;
  onConfirm: (reason: string, reasonLabel: string, detail: string) => void;
}

export function LostReasonDialog({ open, contactName, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) { setReason(''); setDetail(''); }
  }, [open]);

  const handleConfirm = () => {
    if (!reason) return;
    const label = LOST_REASONS.find(r => r.value === reason)?.label || reason;
    onConfirm(reason, label, detail.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Por que perdemos este lead?</DialogTitle>
          <DialogDescription>
            {contactName ? `Registre o motivo da perda de ${contactName} para gerar relatórios depois.` : 'Registre o motivo da perda para gerar relatórios depois.'}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {LOST_REASONS.map(r => (
            <Label
              key={r.value}
              htmlFor={`lost-${r.value}`}
              className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent"
            >
              <RadioGroupItem value={r.value} id={`lost-${r.value}`} />
              <span className="text-sm">{r.label}</span>
            </Label>
          ))}
        </RadioGroup>

        <Textarea
          placeholder="Detalhes (opcional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!reason} variant="destructive">
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
