import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { RoutineBlock } from '@/hooks/useRoutine';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props { block: RoutineBlock | null; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (result: { notes: string; partial: boolean; carryTo: string | null }) => Promise<void>; }

export function RoutineCompletionDialog({ block, open, onOpenChange, onConfirm }: Props) {
  const [result, setResult] = useState('concluido');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  if (!block) return null;
  const partial = result === 'parcial';
  const submit = async () => { setSaving(true); await onConfirm({ notes: notes.trim(), partial, carryTo: partial ? format(addDays(new Date(block.date + 'T12:00:00'), 1), 'yyyy-MM-dd') : null }); setSaving(false); setNotes(''); setResult('concluido'); };
  return <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={`Finalizar · ${block.title}`}>
    <div className="space-y-4 p-1">
      {block.completion_criterion && <div className="rounded-md bg-muted p-3 text-sm"><strong>Critério:</strong> {block.completion_criterion}</div>}
      <div><Label>Resultado</Label><Select value={result} onValueChange={setResult}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="concluido">Concluído</SelectItem><SelectItem value="parcial">Parcial — ficou saldo</SelectItem></SelectContent></Select></div>
      <div><Label>O que foi realizado?</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: 63 leads tratados; 37 ficaram pendentes" /></div>
      {partial && <p className="text-xs text-amber-600">O saldo será criado como novo bloco para o próximo dia, preservando módulo, MT e origem.</p>}
      <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="flex-1" disabled={saving} onClick={submit}>{partial ? 'Concluir e levar saldo' : 'Concluir bloco'}</Button></div>
    </div>
  </ResponsiveDialog>;
}
