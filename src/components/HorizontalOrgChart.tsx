import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface NodeWithChildren extends Node {
  children: NodeWithChildren[];
  level: number;
}

const COLOR_CLASSES: Record<string, string> = {
  roxo: "bg-[hsl(var(--node-roxo))] text-white",
  vermelho: "bg-[hsl(var(--node-vermelho))] text-white",
  amarelo: "bg-[hsl(var(--node-amarelo))] text-white",
  verde: "bg-[hsl(var(--node-verde))] text-white",
};

// Cores alternadas por nível para visual mais organizado
const LEVEL_COLORS = [
  "bg-rose-600 text-white", // nível 0 (raiz)
  "bg-violet-500 text-white", // nível 1
  "bg-cyan-500 text-white", // nível 2
  "bg-amber-500 text-white", // nível 3
  "bg-emerald-500 text-white", // nível 4
  "bg-pink-500 text-white", // nível 5
];

interface HorizontalOrgChartProps {
  onClose?: () => void;
  onNodeClick?: (nodeId: string) => void;
}

export function HorizontalOrgChart({ onClose, onNodeClick }: HorizontalOrgChartProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [rootNode, setRootNode] = useState<NodeWithChildren | null>(null);
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Touch handling
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  const fetchNodes = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .eq("is_visible", true)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nós",
        description: error.message,
      });
      return;
    }

    if (data) {
      setNodes(data as Node[]);
    }
  };

  // Construir árvore hierárquica
  const buildTree = (nodes: Node[]): NodeWithChildren | null => {
    const nodeMap = new Map<string, NodeWithChildren>();
    
    // Criar mapa de todos os nós
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [], level: 0 });
    });

    let root: NodeWithChildren | null = null;

    // Conectar filhos aos pais
    nodes.forEach(node => {
      const current = nodeMap.get(node.id)!;
      
      if (node.parent_id === null) {
        root = current;
      } else {
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(current);
        }
      }
    });

    // Calcular níveis
    const calculateLevels = (node: NodeWithChildren, level: number) => {
      node.level = level;
      node.children.forEach(child => calculateLevels(child, level + 1));
    };

    if (root) {
      calculateLevels(root, 0);
    }

    return root;
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    if (nodes.length > 0) {
      const tree = buildTree(nodes);
      setRootNode(tree);
    }
  }, [nodes]);

  // Pan handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.2), 2));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers — 1 finger = native scroll; 2 fingers = pan + pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTouchStart({ x: midX, y: midY });
      setDragStart({ x: midX - position.x, y: midY - position.y });

      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      e.preventDefault();

      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance;
      setScale(prev => Math.min(Math.max(prev * delta, 0.2), 2));
      setLastTouchDistance(distance);

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setPosition({
        x: midX - dragStart.x,
        y: midY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
    setLastTouchDistance(null);
  };

  // Renderizar um nó e seus filhos recursivamente
  const renderNode = (node: NodeWithChildren): JSX.Element => {
    const hasChildren = node.children.length > 0;
    const colorClass = LEVEL_COLORS[node.level % LEVEL_COLORS.length];

    return (
      <div key={node.id} className="flex items-center">
        {/* Nó atual */}
        <div
          className={cn(
            "relative px-4 py-2 rounded-md shadow-md cursor-pointer transition-all hover:scale-105 min-w-[120px] text-center font-medium text-sm",
            colorClass
          )}
          onClick={() => onNodeClick?.(node.id)}
          style={{
            writingMode: node.level === 0 ? "vertical-rl" : "horizontal-tb",
            textOrientation: node.level === 0 ? "mixed" : "mixed",
          }}
        >
          {node.title}
        </div>

        {/* Filhos com linhas de conexão */}
        {hasChildren && (
          <div className="flex items-center">
            {/* Linha horizontal saindo do nó */}
            <div className="w-8 h-[2px] bg-gray-400" />
            
            {/* Container dos filhos */}
            <div className="relative flex flex-col gap-4">
              {/* Linha vertical conectando filhos */}
              {node.children.length > 1 && (
                <div 
                  className="absolute left-0 w-[2px] bg-gray-400"
                  style={{
                    top: '50%',
                    height: `calc(100% - 24px)`,
                    transform: 'translateY(-50%)',
                  }}
                />
              )}
              
              {node.children.map((child, index) => (
                <div key={child.id} className="flex items-center">
                  {/* Linha horizontal para cada filho */}
                  <div className="w-8 h-[2px] bg-gray-400" />
                  {renderNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!rootNode) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
        <p className="text-muted-foreground">Carregando organograma...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm touch-pan-y overflow-auto"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Botão fechar */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] bg-background/80 hover:bg-background p-2 rounded-full shadow-lg border"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Título */}
      <div className="fixed top-4 left-4 z-[60] bg-background/80 px-4 py-2 rounded-lg shadow-lg border">
        <h2 className="text-lg font-semibold">Organograma Horizontal</h2>
        <p className="text-xs text-muted-foreground">Arraste para navegar • Scroll para zoom</p>
      </div>

      {/* Controles de zoom */}
      <div className="fixed bottom-4 left-4 z-[60] flex gap-2">
        <button
          onClick={() => setScale(prev => Math.min(prev * 1.2, 2))}
          className="bg-background/80 hover:bg-background p-2 rounded-full shadow-lg border"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => setScale(prev => Math.max(prev * 0.8, 0.2))}
          className="bg-background/80 hover:bg-background p-2 rounded-full shadow-lg border"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => { setScale(0.8); setPosition({ x: 50, y: 50 }); }}
          className="bg-background/80 hover:bg-background p-2 rounded-full shadow-lg border"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Conteúdo do organograma */}
      <div
        className="absolute p-12"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {renderNode(rootNode)}
      </div>
    </div>
  );
}
