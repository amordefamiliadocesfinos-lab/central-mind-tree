import { cn } from "@/lib/utils";

export type CapturaState =
  | "nova"
  | "decidindo"
  | "planejada"
  | "em_execucao"
  | "resolvida"
  | "referencia"
  | "arquivada";

const STATE_META: Record<CapturaState, { label: string; dotClass: string }> = {
  nova: { label: "Nova", dotClass: "bg-sky-500" },
  decidindo: { label: "Aguardando decisão", dotClass: "bg-amber-500" },
  planejada: { label: "Planejada", dotClass: "bg-violet-500" },
  em_execucao: { label: "Em execução", dotClass: "bg-red-500" },
  resolvida: { label: "Resolvida", dotClass: "bg-emerald-500" },
  referencia: { label: "Referência", dotClass: "bg-blue-500" },
  arquivada: { label: "Arquivada", dotClass: "bg-muted-foreground/50" },
};

export function CapturaStateIndicator({ state = "nova", className }: { state?: CapturaState; className?: string }) {
  const meta = STATE_META[state] ?? STATE_META.nova;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] text-muted-foreground leading-none", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
