import { useState, useMemo } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeasonalDays } from '@/hooks/useSeasonalDays';
import { useDigital, type IdeaType } from '@/hooks/useDigital';
import { ShoppingCart, Megaphone, UserPlus, Sparkles, Heart, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ideaId: string) => void;
}

type Objective = 'vender' | 'divulgar' | 'captar' | 'fortalecer' | 'reativar';

const OBJECTIVES: { id: Objective; label: string; icon: any; description: string; ideaType: IdeaType }[] = [
  { id: 'vender', label: 'Vender', icon: ShoppingCart, description: 'Gerar vendas diretas', ideaType: 'anuncio' },
  { id: 'divulgar', label: 'Divulgar', icon: Megaphone, description: 'Anunciar algo novo', ideaType: 'conteudo' },
  { id: 'captar', label: 'Captar clientes', icon: UserPlus, description: 'Atrair novos leads', ideaType: 'campanha' },
  { id: 'fortalecer', label: 'Fortalecer marca', icon: Sparkles, description: 'Aumentar autoridade', ideaType: 'conteudo' },
  { id: 'reativar', label: 'Reativar clientes', icon: Heart, description: 'Reengajar inativos', ideaType: 'campanha' },
];

export function QuickActionWizard({ open, onOpenChange, onCreated }: QuickActionWizardProps) {
  const { createIdea } = useDigital();
  const { seasonalDays } = useSeasonalDays();
  const [step, setStep] = useState(1);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [subject, setSubject] = useState('');
  const [dateOption, setDateOption] = useState<'none' | 'seasonal'>('none');
  const [seasonalId, setSeasonalId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1);
    setObjective(null);
    setSubject('');
    setDateOption('none');
    setSeasonalId('');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const selectedObjective = useMemo(() => OBJECTIVES.find(o => o.id === objective), [objective]);
  const selectedSeasonal = useMemo(() => seasonalDays.find(s => s.id === seasonalId), [seasonalId, seasonalDays]);

  const canNext1 = !!objective;
  const canNext2 = subject.trim().length > 0;
  const canFinish = dateOption === 'none' || (dateOption === 'seasonal' && !!seasonalId);

  const handleFinish = async () => {
    if (!selectedObjective || !subject.trim()) return;
    setSubmitting(true);
    const title = `${selectedObjective.label}: ${subject.trim()}`;
    const keyMessage = selectedSeasonal
      ? `Relacionado a: ${selectedSeasonal.name}`
      : null;
    const objText = `Objetivo: ${selectedObjective.label} — ${selectedObjective.description}`;
    const idea = await createIdea({
      title,
      objective: objText,
      key_message: keyMessage,
      idea_type: selectedObjective.ideaType,
    });
    setSubmitting(false);
    if (idea) {
      toast.success('Ação criada no Digital!');
      onCreated?.(idea.id);
      reset();
      onOpenChange(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title="Começar Nova Ação"
      description={`Passo ${step} de 3`}
    >
      <div className="space-y-4">
        {step === 1 && (
          <div className="space-y-3">
            <Label className="text-base">O que você deseja fazer?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OBJECTIVES.map(opt => {
                const Icon = opt.icon;
                const active = objective === opt.id;
                return (
                  <Card
                    key={opt.id}
                    onClick={() => setObjective(opt.id)}
                    className={`p-3 cursor-pointer transition-all border-2 ${active ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-md ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                      </div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label htmlFor="subject" className="text-base">O que deseja divulgar?</Label>
            <Input
              id="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Produto, serviço, campanha ou evento"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Descreva brevemente o foco desta ação.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label className="text-base">Existe alguma data relacionada?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Card
                onClick={() => { setDateOption('none'); setSeasonalId(''); }}
                className={`p-3 cursor-pointer text-center border-2 ${dateOption === 'none' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'}`}
              >
                <div className="font-medium text-sm">Não</div>
                <div className="text-xs text-muted-foreground">Sem data específica</div>
              </Card>
              <Card
                onClick={() => setDateOption('seasonal')}
                className={`p-3 cursor-pointer text-center border-2 ${dateOption === 'seasonal' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'}`}
              >
                <div className="font-medium text-sm">Calendário Sazonal</div>
                <div className="text-xs text-muted-foreground">Vincular a uma data</div>
              </Card>
            </div>

            {dateOption === 'seasonal' && (
              <div className="space-y-2 pt-2">
                <Label>Selecione a data sazonal</Label>
                <Select value={seasonalId} onValueChange={setSeasonalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma data..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonalDays.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhuma data cadastrada
                      </div>
                    )}
                    {seasonalDays.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => step === 1 ? handleClose(false) : setStep(s => s - 1)}
            disabled={submitting}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
            >
              Continuar
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={!canFinish || submitting}>
              <Check className="h-4 w-4 mr-1" />
              {submitting ? 'Criando...' : 'Criar Ação'}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
