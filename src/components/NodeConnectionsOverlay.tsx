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

  const calculateNodePositions = () => {
    const positions = new Map<string, { x: number; y: number }>();
    
    // Encontrar todos os elementos de nó no DOM
    const nodeElements = document.querySelectorAll('[data-node-id]');
    
    nodeElements.forEach((element) => {
      const nodeId = element.getAttribute('data-node-id');
      if (!nodeId) return;

      const rect = element.getBoundingClientRect();

      positions.set(nodeId, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    });

    if (positions.size > 0) {
      setNodePositions(positions);
    }
  };

  const fetchNodes = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .eq("is_visible", true);

    if (!error && data) {
      setNodes(data as Node[]);
      // Aguardar renderização dos nós antes de calcular posições
      setTimeout(() => {
        calculateNodePositions();
      }, 100);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNodes();
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible]);

  // Recalcular posições quando a visibilidade muda ou quando há scroll/zoom
  useEffect(() => {
    if (!visible) return;

    const handleUpdate = () => {
      requestAnimationFrame(calculateNodePositions);
    };
    
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    // Calcular posições iniciais após um pequeno delay
    const timer = setTimeout(calculateNodePositions, 200);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [visible, nodes]);

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
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    >
      {connections.map(conn => (
        <line
          key={conn.id}
          x1={conn.x1}
          y1={conn.y1}
          x2={conn.x2}
          y2={conn.y2}
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
          opacity="0.4"
          strokeDasharray="5 5"
        />
      ))}
    </svg>
  );
}
