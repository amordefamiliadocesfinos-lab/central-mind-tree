import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface NodeConnectionsOverlayProps {
  visible: boolean;
}

export function NodeConnectionsOverlay({ visible }: NodeConnectionsOverlayProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (visible) {
      fetchNodes();
      calculateNodePositions();
    }

    const channel = supabase
      .channel('node-connections')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nodes'
        },
        () => {
          fetchNodes();
          calculateNodePositions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible]);

  const fetchNodes = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .eq("is_visible", true);

    if (!error && data) {
      setNodes(data as Node[]);
    }
  };

  const calculateNodePositions = () => {
    const positions = new Map<string, { x: number; y: number }>();
    
    // Encontrar todos os elementos de nó no DOM
    document.querySelectorAll('[data-node-id]').forEach((element) => {
      const nodeId = element.getAttribute('data-node-id');
      if (!nodeId) return;

      const rect = element.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      positions.set(nodeId, {
        x: rect.left + rect.width / 2 + scrollX,
        y: rect.top + rect.height / 2 + scrollY,
      });
    });

    setNodePositions(positions);
  };

  // Recalcular posições quando a visibilidade muda ou quando há scroll/zoom
  useEffect(() => {
    if (!visible) return;

    const handleUpdate = () => calculateNodePositions();
    
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [visible]);

  if (!visible || nodes.length === 0) return null;

  // Renderizar linhas de conexão entre parent e child
  const connections = nodes
    .filter(node => node.parent_id && nodePositions.has(node.id) && nodePositions.has(node.parent_id))
    .map(node => {
      const childPos = nodePositions.get(node.id)!;
      const parentPos = nodePositions.get(node.parent_id!)!;

      return {
        id: `${node.parent_id}-${node.id}`,
        x1: parentPos.x,
        y1: parentPos.y,
        x2: childPos.x,
        y2: childPos.y,
      };
    });

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {connections.map(conn => (
        <line
          key={conn.id}
          x1={conn.x1}
          y1={conn.y1}
          x2={conn.x2}
          y2={conn.y2}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="2"
          opacity="0.3"
          strokeDasharray="4 4"
        />
      ))}
    </svg>
  );
}
