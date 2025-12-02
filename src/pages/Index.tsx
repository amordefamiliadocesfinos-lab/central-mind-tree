import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NodeBox } from "@/components/NodeBox";
import { NodeTree } from "@/components/NodeTree";
import { TimerWidget } from "@/components/TimerWidget";
import { TasksDialog } from "@/components/TasksDialog";
import { NodeConnectionsOverlay } from "@/components/NodeConnectionsOverlay";
import { ReplanningBanner } from "@/components/ReplanningBanner";
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
  const [linesMode, setLinesMode] = useState<"off" | "resumo" | "detalhe">("off");
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

  // Centralizar o nó raiz apenas na primeira renderização
  useEffect(() => {
    if (rootNode && containerRef.current && contentRef.current) {
      const container = containerRef.current;
      const content = contentRef.current;
      
      // Centralizar apenas se ainda não foi posicionado
      if (position.x === 0 && position.y === 0) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        setPosition({
          x: containerWidth / 2,
          y: 100, // Posição vertical inicial
        });
      }
    }
  }, [rootNode]);

  const handleNodeChange = () => {
    setRefreshKey((prev) => prev + 1);
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
      <TimerWidget 
        linesMode={linesMode}
        onLinesModeChange={setLinesMode}
      />
      <ReplanningBanner />
    </>
  );
};

export default Index;