interface CEOLegendProps {
  visible: boolean;
}

const STATUS_ITEMS = [
  { label: "Estrutural", color: "bg-node-roxo", highlight: true },
  { label: "Andamento", color: "bg-node-vermelho", highlight: true },
  { label: "Pendente", color: "bg-node-amarelo", highlight: false },
  { label: "Concluído", color: "bg-node-verde", highlight: false },
];

export function CEOLegend({ visible }: CEOLegendProps) {
  if (!visible) return null;

  return (
    <div 
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-background/95 backdrop-blur-sm border rounded-lg px-4 py-2 shadow-lg"
    >
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Vista CEO
        </span>
        <div className="h-4 w-px bg-border" />
        {STATUS_ITEMS.map((item) => (
          <div 
            key={item.label} 
            className={`flex items-center gap-1.5 ${item.highlight ? "" : "opacity-40"}`}
          >
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-xs font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
