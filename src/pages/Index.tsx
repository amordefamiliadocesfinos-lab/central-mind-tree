import { useEffect, useState, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NodeBox } from "@/components/NodeBox";
import { NodeTree } from "@/components/NodeTree";
import { TasksDialog } from "@/components/TasksDialog";
import { NodeConnectionsOverlay } from "@/components/NodeConnectionsOverlay";
import { ReplanningBanner } from "@/components/ReplanningBanner";
import { DueDateBanner } from "@/components/DueDateBanner";
import { FollowUpBanner } from "@/components/FollowUpBanner";
import { CEOLegend } from "@/components/CEOLegend";
import { useToast } from "@/hooks/use-toast";
import { useLinesMode } from "@/contexts/LinesModeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { RefreshCw, Crosshair, Network } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

const Index = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rootNode, setRootNode] = useState<Node | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { linesMode, setLinesMode, setShowTaskBar } = useLinesMode();
  const [tasksDialogState, setTasksDialogState] = useState<{
    open: boolean;
    nodeId: string;
    nodeTitle: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Touch handling for mobile
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  // Enable taskbar when on Index page
  useEffect(() => {
    setShowTaskBar(true);
    return () => setShowTaskBar(false);
  }, [setShowTaskBar]);

  // Detectar se devemos reabrir o diálogo de tarefas ao voltar da página de edição
  useEffect(() => {
    const state = location.state as any;
    if (state?.openTasksDialog && state?.nodeId && state?.nodeTitle) {
      setTasksDialogState({
        open: true,
        nodeId: state.nodeId,
        nodeTitle: state.nodeTitle,
      });
      setIsDialogOpen(true);
      // Limpar o state da navegação
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchRootNode = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .is("parent_id", null)
      .eq("is_visible", true)
      .maybeSingle();

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nó raiz",
        description: error.message,
      });
    } else if (data) {
      setRootNode(data as Node);
    }
  };

  useEffect(() => {
    fetchRootNode();

    // Configurar realtime para atualizações do nó raiz
    const channel = supabase
      .channel('root-node')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nodes',
          filter: 'parent_id=is.null'
        },
        () => {
          fetchRootNode();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshKey]);

  // Centralizar automaticamente na montagem inicial
  const initializedRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Função para calcular bounding box de todos os nós visíveis
  const calculateNodesBoundingBox = (container: HTMLElement) => {
    const nodeElements = document.querySelectorAll('[data-node-id]');
    
    if (nodeElements.length === 0) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodeElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left - containerRect.left;
      const y = rect.top - containerRect.top;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + rect.width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + rect.height);
    });

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // Função para centralizar e dar ênfase na árvore
  const centerAndEmphasizeTree = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const bounds = calculateNodesBoundingBox(container);

    if (bounds) {
      // Calcular escala ideal baseado no tamanho da árvore
      const padding = 100; // Margem ao redor
      const availableWidth = containerWidth - padding * 2;
      const availableHeight = containerHeight - padding * 2 - 48; // -48 para barra inferior
      
      // Calcular escala que faz a árvore caber na tela
      const scaleX = availableWidth / bounds.width;
      const scaleY = availableHeight / bounds.height;
      const optimalScale = Math.min(scaleX, scaleY, 1); // Máximo de 1 para não ampliar demais
      const finalScale = Math.max(optimalScale, 0.5); // Mínimo de 0.5 para não ficar muito pequeno

      // Centralizar o conteúdo na viewport
      const newX = (containerWidth / 2) - bounds.centerX;
      const newY = (containerHeight / 2) - bounds.centerY - 24;

      // Aplicar com animação suave
      setIsAnimating(true);
      setPosition({ x: newX, y: newY });
      setScale(finalScale);

      // Adicionar ênfase aos nós após centralização
      setTimeout(() => {
        setIsAnimating(false);
        const nodeElements = document.querySelectorAll('[data-node-id]');
        nodeElements.forEach((el, index) => {
          const element = el as HTMLElement;
          element.classList.add('node-emphasis');
          setTimeout(() => {
            element.classList.remove('node-emphasis');
          }, 1500 + index * 100);
        });
      }, 600);
    } else {
      // Fallback se não houver nós ainda
      setPosition({
        x: containerWidth / 2,
        y: 100,
      });
      setScale(0.9);
    }
  };

  useEffect(() => {
    if (rootNode && containerRef.current && !initializedRef.current) {
      // Aguardar os nós serem renderizados
      const timer = setTimeout(() => {
        centerAndEmphasizeTree();
        initializedRef.current = true;
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [rootNode]);

  // Handle highlight query parameter from search
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    const openTasks = searchParams.get("openTasks");
    const taskId = searchParams.get("taskId");
    
    if (highlightId && rootNode) {
      // Wait for nodes to render before centering
      const timer = setTimeout(async () => {
        centerOnNode(highlightId);
        
        // If openTasks is set, open the tasks dialog for that node
        if (openTasks === "true") {
          // Fetch node title
          const { data: nodeData } = await supabase
            .from("nodes")
            .select("title")
            .eq("id", highlightId)
            .maybeSingle();
          
          if (nodeData) {
            setTasksDialogState({
              open: true,
              nodeId: highlightId,
              nodeTitle: nodeData.title,
            });
            setIsDialogOpen(true);
          }
        }
        
        // Clear the params after processing
        setSearchParams({}, { replace: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchParams, rootNode]);

  const handleNodeChange = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleRefreshAndCenter = () => {
    setRefreshKey((prev) => prev + 1);
    // Aguarda um pouco para o DOM renderizar os nós antes de calcular o bounding box
    setTimeout(() => centerAndEmphasizeTree(), 400);
  };

  // Função para centralizar em um nó específico
  const centerOnNode = (nodeId: string) => {
    const container = containerRef.current;
    if (!container) return;

    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    if (!nodeElement) {
      // Nó pode não estar visível ainda, tentar novamente após refresh
      setTimeout(() => centerOnNode(nodeId), 300);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nodeRect = nodeElement.getBoundingClientRect();

    // Calcular posição central do nó relativo ao container
    const nodeCenterX = nodeRect.left - containerRect.left + nodeRect.width / 2;
    const nodeCenterY = nodeRect.top - containerRect.top + nodeRect.height / 2;

    // Calcular novo offset para centralizar o nó
    const targetX = containerRect.width / 2 - nodeCenterX + position.x;
    const targetY = containerRect.height / 2 - nodeCenterY + position.y;

    // Aplicar com animação
    setIsAnimating(true);
    setPosition({ x: targetX, y: targetY });

    // Dar ênfase no nó
    setTimeout(() => {
      setIsAnimating(false);
      nodeElement.classList.add('node-emphasis', 'ring-2', 'ring-primary');
      setTimeout(() => {
        nodeElement.classList.remove('node-emphasis', 'ring-2', 'ring-primary');
      }, 2000);
    }, 500);
  };

  // Handle search result click
  const handleSearchResultClick = (result: { type: "node" | "task"; id: string; nodeId?: string; title: string; parentTitle?: string }) => {
    if (result.type === "node") {
      // Centralizar e destacar o nó
      centerOnNode(result.id);
    } else if (result.type === "task" && result.nodeId) {
      // Centralizar no nó da tarefa e abrir dialog
      centerOnNode(result.nodeId);
      
      // Abrir tasks dialog após centralizar
      const fetchNodeTitle = async () => {
        const { data } = await supabase
          .from("nodes")
          .select("title")
          .eq("id", result.nodeId)
          .maybeSingle();
        
        setTimeout(() => {
          setTasksDialogState({
            open: true,
            nodeId: result.nodeId!,
            nodeTitle: data?.title || result.parentTitle || "Nó",
          });
          setIsDialogOpen(true);
        }, 600);
      };
      fetchNodeTitle();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 5));
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

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDialogOpen) return;
    
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDialogOpen) return;
    
    if (e.touches.length === 1 && touchStart) {
      // Pan
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && lastTouchDistance) {
      // Pinch to zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance;
      setScale((prev) => Math.min(Math.max(prev * delta, 0.2), 3));
      setLastTouchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
    setLastTouchDistance(null);
  };

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="w-screen h-screen overflow-hidden bg-background canvas-grid touch-none"
        onWheel={isDialogOpen ? undefined : handleWheel}
        onMouseDown={isDialogOpen ? undefined : handleMouseDown}
        onMouseMove={isDialogOpen ? undefined : handleMouseMove}
        onMouseUp={isDialogOpen ? undefined : handleMouseUp}
        onMouseLeave={isDialogOpen ? undefined : handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          cursor: isDragging ? "grabbing" : "grab",
          pointerEvents: isDialogOpen ? "none" : "auto",
          userSelect: isDialogOpen ? "none" : "auto"
        }}
      >
        <div
          ref={contentRef}
          className={isAnimating ? "viewport-transition" : ""}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            minWidth: "max-content",
            minHeight: "max-content",
          }}
        >
          <NodeBox 
            node={rootNode} 
            onNodeChange={handleNodeChange}
            onDialogOpenChange={setIsDialogOpen}
            refreshKey={refreshKey}
          >
            <NodeTree 
              parentId={rootNode.id} 
              onNodeChange={handleNodeChange}
              onDialogOpenChange={setIsDialogOpen}
              refreshKey={refreshKey}
            />
          </NodeBox>
        </div>
      </div>

      {/* Ação rápida para forçar refetch e recentralizar (útil quando o layout muda por updates/realtime) */}
      <div className="fixed right-3 bottom-20 z-40 flex flex-col gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={linesMode !== "off" ? "default" : "secondary"}
              size="icon"
              className="rounded-full shadow"
              disabled={isDialogOpen}
              aria-label="Modo de visualização"
              title="Modo CEO"
            >
              <Network className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Visualização</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setLinesMode("off")}
              className={linesMode === "off" ? "bg-accent" : ""}
            >
              Padrão
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLinesMode("resumo")}
              className={linesMode === "resumo" ? "bg-accent" : ""}
            >
              Linhas (Resumo)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLinesMode("detalhe")}
              className={linesMode === "detalhe" ? "bg-accent" : ""}
            >
              Linhas (Detalhe)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLinesMode("ceo")}
              className={linesMode === "ceo" ? "bg-accent" : ""}
            >
              Modo CEO
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="rounded-full shadow"
          onClick={handleRefreshAndCenter}
          disabled={isDialogOpen}
          aria-label="Atualizar e centralizar árvore"
          title="Atualizar e centralizar"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="rounded-full shadow"
          onClick={centerAndEmphasizeTree}
          disabled={isDialogOpen}
          aria-label="Centralizar árvore"
          title="Centralizar"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
      </div>

      {tasksDialogState && (
        <TasksDialog
          open={tasksDialogState.open}
          onOpenChange={(open) => {
            setTasksDialogState(open ? tasksDialogState : null);
            setIsDialogOpen(open);
          }}
          nodeId={tasksDialogState.nodeId}
          nodeTitle={tasksDialogState.nodeTitle}
          onTasksChange={handleNodeChange}
        />
      )}
      <NodeConnectionsOverlay linesMode={linesMode} />
      <CEOLegend visible={linesMode === "ceo"} />
      <ReplanningBanner />
      <DueDateBanner />
      <FollowUpBanner />
    </>
  );
};

export default Index;