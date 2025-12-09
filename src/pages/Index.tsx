import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NodeBox } from "@/components/NodeBox";
import { NodeTree } from "@/components/NodeTree";
import { TimerWidget } from "@/components/TimerWidget";
import { TasksDialog } from "@/components/TasksDialog";
import { NodeConnectionsOverlay } from "@/components/NodeConnectionsOverlay";
import { ReplanningBanner } from "@/components/ReplanningBanner";
import { DueDateBanner } from "@/components/DueDateBanner";
import { CEOLegend } from "@/components/CEOLegend";
import { SearchBar } from "@/components/SearchBar";
import { useToast } from "@/hooks/use-toast";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

const Index = () => {
  const location = useLocation();
  const [rootNode, setRootNode] = useState<Node | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [linesMode, setLinesMode] = useState<"off" | "resumo" | "detalhe" | "ceo">("off");
  const [tasksDialogState, setTasksDialogState] = useState<{
    open: boolean;
    nodeId: string;
    nodeTitle: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  // Função para calcular bounding box de todos os nós visíveis
  const calculateNodesBoundingBox = () => {
    const nodeElements = document.querySelectorAll('[data-node-id]');
    
    if (nodeElements.length === 0) {
      return { centerX: 0, centerY: 0, width: 0, height: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodeElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Converter para coordenadas do conteúdo (remover scale e position)
      const x = (rect.left - position.x) / scale;
      const y = (rect.top - position.y) / scale;
      const width = rect.width / scale;
      const height = rect.height / scale;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height);
    });

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // Centralizar automaticamente na montagem inicial
  const initializedRef = useRef(false);
  
  useEffect(() => {
    if (rootNode && containerRef.current && !initializedRef.current) {
      // Aguardar um tick para os nós serem renderizados
      const timer = setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Verificar se há nós renderizados
        const nodeElements = document.querySelectorAll('[data-node-id]');
        
        if (nodeElements.length > 0) {
          // Calcular bounding box
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;

          // Na primeira renderização, os nós ainda não têm transformação aplicada
          // Então pegamos as posições relativas ao container
          nodeElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            const x = rect.left - containerRect.left;
            const y = rect.top - containerRect.top;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x + rect.width);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y + rect.height);
          });

          const contentCenterX = (minX + maxX) / 2;
          const contentCenterY = (minY + maxY) / 2;

          // Centralizar o conteúdo na viewport
          const newX = (containerWidth / 2) - contentCenterX;
          const newY = (containerHeight / 2) - contentCenterY - 24; // -24 para compensar barra inferior

          setPosition({ x: newX, y: newY });
          setScale(0.9); // Zoom inicial com margem de respiro
        } else {
          // Fallback se não houver nós ainda
          setPosition({
            x: containerWidth / 2,
            y: 100,
          });
        }

        initializedRef.current = true;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [rootNode]);

  const handleNodeChange = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Handle search result click
  const handleSearchResultClick = (result: { type: "node" | "task"; id: string; nodeId?: string; title: string; parentTitle?: string }) => {
    if (result.type === "node") {
      // Scroll to node element
      const nodeElement = document.querySelector(`[data-node-id="${result.id}"]`);
      if (nodeElement) {
        nodeElement.scrollIntoView({ behavior: "smooth", block: "center" });
        // Briefly highlight the node
        nodeElement.classList.add("ring-2", "ring-primary");
        setTimeout(() => nodeElement.classList.remove("ring-2", "ring-primary"), 2000);
      }
    } else if (result.type === "task" && result.nodeId) {
      // Open tasks dialog for the task's node
      const fetchNodeTitle = async () => {
        const { data } = await supabase
          .from("nodes")
          .select("title")
          .eq("id", result.nodeId)
          .maybeSingle();
        
        setTasksDialogState({
          open: true,
          nodeId: result.nodeId!,
          nodeTitle: data?.title || result.parentTitle || "Nó",
        });
        setIsDialogOpen(true);
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
        className="w-screen h-screen overflow-auto bg-background"
        onWheel={isDialogOpen ? undefined : handleWheel}
        onMouseDown={isDialogOpen ? undefined : handleMouseDown}
        onMouseMove={isDialogOpen ? undefined : handleMouseMove}
        onMouseUp={isDialogOpen ? undefined : handleMouseUp}
        onMouseLeave={isDialogOpen ? undefined : handleMouseUp}
        style={{ 
          cursor: isDragging ? "grabbing" : "grab",
          pointerEvents: isDialogOpen ? "none" : "auto",
          userSelect: isDialogOpen ? "none" : "auto"
        }}
      >
        <div
          ref={contentRef}
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
          >
            <NodeTree 
              parentId={rootNode.id} 
              onNodeChange={handleNodeChange}
              onDialogOpenChange={setIsDialogOpen}
            />
          </NodeBox>
        </div>
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
      <TimerWidget 
        linesMode={linesMode}
        onLinesModeChange={setLinesMode}
      />
      <ReplanningBanner />
      <DueDateBanner />
      <SearchBar onResultClick={handleSearchResultClick} />
    </>
  );
};

export default Index;