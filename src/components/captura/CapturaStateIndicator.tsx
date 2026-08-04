import { cn } from "@/lib/utils";

/**
 * Estados visuais da Captura Central.
 * Apenas "em_analise" é utilizado hoje. Os demais estão preparados
 * para evolução futura (sem nenhuma lógica associada).
 */
export type CapturaState =
  | "em_analise"
  | "relacionado"
  | "oportunidades"
  | "aguardando_decisao"
  | "transformado";

const STATE_META: Record<CapturaState, { label: string; dotClass: string }> = {
  em_analise: { label: "Em análise", dotClass: "bg-muted-foreground/50" },
  relacionado: { label: "Relacionado", dotClass: "bg-primary/50" },
  oportunidades: { label: "Com oportunidades encontradas", dotClass: "bg-primary/70" },
  aguardando_decisao: { label: "Aguardando decisão", dotClass: "bg-accent-foreground/40" },
  transformado: { label: "Transformado em ação", dotClass: "bg-primary" },
};

interface CapturaStateIndicatorProps {
  state?: CapturaState;
  className?: string;
}

export const CapturaStateIndicator = ({
  state = "em_analise",
  className,
}: CapturaStateIndicatorProps) => {
  const meta = STATE_META[state] ?? STATE_META.em_analise;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70 leading-none",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
};
