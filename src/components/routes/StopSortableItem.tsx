import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GripVertical,
  CheckCircle2,
  XCircle,
  Trash2,
  Navigation,
  Phone,
  MessageCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeliveryStop } from '@/hooks/useDeliveryRoutes';

interface Props {
  stop: DeliveryStop;
  index: number;
  onComplete: () => void;
  onDelete: () => void;
}

export function StopSortableItem({ stop, index, onComplete, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const fullAddress = [
    stop.address,
    stop.address_number,
    stop.neighborhood,
    stop.city,
    stop.state,
  ]
    .filter(Boolean)
    .join(', ');

  const openSingle = () => {
    const q = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  const callPhone = () => stop.phone && window.open(`tel:${stop.phone.replace(/\D/g, '')}`);
  const whatsapp = () =>
    stop.phone &&
    window.open(`https://wa.me/${stop.phone.replace(/\D/g, '')}`, '_blank');

  const statusBadge =
    stop.status === 'entregue' ? (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
        Entregue
      </Badge>
    ) : stop.status === 'falhou' ? (
      <Badge variant="destructive">Falhou</Badge>
    ) : (
      <Badge variant="outline">Pendente</Badge>
    );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-lg border bg-card p-3 flex gap-3 items-start transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/40'
      )}
    >
      <button
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pt-1"
        {...attributes}
        {...listeners}
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium truncate">{stop.customer_name || 'Sem nome'}</p>
            <p className="text-xs text-muted-foreground truncate">{fullAddress || 'Endereço não informado'}</p>
          </div>
          {statusBadge}
        </div>

        {(stop.reference_point || stop.delivery_notes || stop.failure_reason) && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {stop.failure_reason && <>❌ {stop.failure_reason}</>}
            {stop.delivery_notes && <>📝 {stop.delivery_notes}</>}
            {stop.reference_point && !stop.failure_reason && !stop.delivery_notes && (
              <>📍 {stop.reference_point}</>
            )}
          </p>
        )}

        <div className="flex items-center gap-1 mt-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7" onClick={openSingle}>
                <Navigation className="h-3 w-3 mr-1" />
                Mapa
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir endereço no Google Maps</TooltipContent>
          </Tooltip>

          {stop.phone && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={callPhone} aria-label="Ligar">
                    <Phone className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ligar para {stop.phone}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={whatsapp} aria-label="WhatsApp">
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>WhatsApp</TooltipContent>
              </Tooltip>
            </>
          )}

          {stop.status === 'pendente' ? (
            <Button size="sm" className="h-7 ml-auto" onClick={onComplete}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Registrar
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={onComplete}>
              Atualizar
            </Button>
          )}

          {stop.photo_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={stop.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted"
                  aria-label="Ver foto"
                >
                  <ImageIcon className="h-3 w-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Ver comprovante</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                aria-label="Excluir parada"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir parada</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
