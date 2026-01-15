import { DigitalIdea, DIGITAL_STATUS, PLATFORMS } from '@/hooks/useDigital';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight } from 'lucide-react';

interface IdeaCardProps {
  idea: DigitalIdea;
  onClick: () => void;
}

export function IdeaCard({ idea, onClick }: IdeaCardProps) {
  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  
  // Calculate progress
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  // Group variations by platform group
  const platformGroups = new Set(
    variations.map(v => PLATFORMS[v.platform]?.group).filter(Boolean)
  );

  // Get next scheduled variation
  const nextScheduled = variations
    .filter(v => v.scheduled_date)
    .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))[0];

  return (
    <Card
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation active:scale-[0.99]',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Title and Status */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-medium truncate">{idea.title}</h3>
              <Badge
                className={cn('text-white text-xs shrink-0', statusConfig.color)}
              >
                {statusConfig.label}
              </Badge>
            </div>

            {/* Objective */}
            {idea.objective && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {idea.objective}
              </p>
            )}

            {/* Platform Icons */}
            {variations.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  {variations.map(v => (
                    <span
                      key={v.id}
                      className={cn(
                        'text-base',
                        v.status === 'concluido' ? 'opacity-50' : ''
                      )}
                      title={`${PLATFORMS[v.platform]?.label} - ${DIGITAL_STATUS[v.status]?.label}`}
                    >
                      {PLATFORMS[v.platform]?.icon}
                    </span>
                  ))}
                </div>
                
                {/* Progress */}
                {variations.length > 1 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Progress value={progress} className="w-12 h-1.5" />
                    <span className="tabular-nums">{Math.round(progress)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {/* Next scheduled */}
            {nextScheduled && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="tabular-nums">
                  {nextScheduled.scheduled_date?.slice(5).replace('-', '/')}
                </span>
              </div>
            )}
            
            {/* Variations count */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{variations.length} variação{variations.length !== 1 ? 'ões' : ''}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
