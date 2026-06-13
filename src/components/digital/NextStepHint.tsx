import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DigitalIdea } from '@/hooks/useDigital';
import { Sparkles, Calendar, Image as ImageIcon, Layers, X, ArrowRight, CheckCircle2 } from 'lucide-react';

interface NextStepHintProps {
  idea: DigitalIdea;
  onNavigate: (tab: 'idea' | 'platforms' | 'calendar') => void;
}

type StepId = 'create_content' | 'create_campaign' | 'schedule' | 'add_media' | 'done';

interface Step {
  id: StepId;
  title: string;
  description: string;
  icon: typeof Sparkles;
  cta: string;
  action: () => void;
}

const STORAGE_KEY = 'digital_nextstep_dismissed';

function loadDismissed(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDismissed(map: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function NextStepHint({ idea, onNavigate }: NextStepHintProps) {
  const [dismissedMap, setDismissedMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setDismissedMap(loadDismissed());
  }, []);

  const variations = idea.variations || [];
  const hasMedia = (idea.media_urls || []).length > 0 ||
    variations.some(v => (v.media_urls || []).length > 0);
  const hasSchedule = variations.some(v => !!v.scheduled_date);

  const step: Step | null = useMemo(() => {
    const isCampaign = idea.idea_type === 'campanha';
    const candidates: Step[] = [];

    if (variations.length === 0) {
      if (isCampaign) {
        candidates.push({
          id: 'create_campaign',
          title: 'Criar campanha',
          description: 'Adicione plataformas e formatos para sua campanha rodar.',
          icon: Layers,
          cta: 'Criar campanha',
          action: () => onNavigate('platforms'),
        });
      } else {
        candidates.push({
          id: 'create_content',
          title: 'Criar conteúdo',
          description: 'Escolha onde publicar e gere as variações do conteúdo.',
          icon: Sparkles,
          cta: 'Criar conteúdo',
          action: () => onNavigate('platforms'),
        });
      }
    } else if (!hasMedia) {
      candidates.push({
        id: 'add_media',
        title: 'Adicionar materiais',
        description: 'Inclua fotos, vídeos ou artes para esta ação.',
        icon: ImageIcon,
        cta: 'Adicionar materiais',
        action: () => onNavigate('idea'),
      });
    } else if (!hasSchedule) {
      candidates.push({
        id: 'schedule',
        title: 'Definir data de publicação',
        description: 'Agende quando essa ação deve ir ao ar.',
        icon: Calendar,
        cta: 'Agendar',
        action: () => onNavigate('calendar'),
      });
    }

    const dismissed = dismissedMap[idea.id] || [];
    const next = candidates.find(c => !dismissed.includes(c.id));
    return next || null;
  }, [idea.id, idea.idea_type, variations, hasMedia, hasSchedule, dismissedMap, onNavigate]);

  const handleDismiss = () => {
    if (!step) return;
    const current = dismissedMap[idea.id] || [];
    const next = { ...dismissedMap, [idea.id]: [...current, step.id] };
    setDismissedMap(next);
    saveDismissed(next);
  };

  if (!step) {
    // Show subtle "all set" only if there's any progress
    if (variations.length > 0 && hasMedia && hasSchedule) {
      return (
        <Card className="p-3 border-green-500/30 bg-green-500/5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-xs text-foreground">Tudo certo para esta ação! Você concluiu os próximos passos.</span>
        </Card>
      );
    }
    return null;
  }

  const Icon = step.icon;

  return (
    <Card className="p-3 sm:p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/0">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/15 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-primary">
              Próximo passo
            </span>
          </div>
          <h4 className="font-semibold text-sm mt-0.5">{step.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <Button size="sm" onClick={step.action} className="h-8">
              {step.cta}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 text-muted-foreground">
              Depois
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Ignorar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
