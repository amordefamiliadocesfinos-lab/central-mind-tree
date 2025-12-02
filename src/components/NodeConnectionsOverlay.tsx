import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface Task {
  id: string;
  node_id: string;
  dependency_id: string | null;
  status: "estrutural" | "andamento" | "pendente" | "concluído";
}

type LinesMode = "off" | "resumo" | "detalhe";

interface NodeConnectionsOverlayProps {
  linesMode: LinesMode;
}

interface BundledConnection {
  sourceNodeId: string;
  targetNodeId: string;
  count: number;
  dominantStatus: Task["status"];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const STATUS_PRIORITY: Record<Task["status"], number> = {
  estrutural: 1,
  andamento: 2,
  pendente: 3,
  concluído: 4,
};

const STATUS_COLORS: Record<Task["status"], string> = {
  estrutural: "hsl(var(--node-roxo))",
  andamento: "hsl(var(--node-vermelho))",
  pendente: "hsl(var(--node-amarelo))",
  concluído: "hsl(var(--node-verde))",
};

const STATUS_STROKE_WIDTH: Record<Task["status"], number> = {
  estrutural: 1.5,
  andamento: 2,
  pendente: 1.5,
  concluído: 1,
};

const STATUS_OPACITY: Record<Task["status"], number> = {
  estrutural: 1,
  andamento: 1,
  pendente: 1,
  concluído: 0.4,
};

const STATUS_DASHED: Record<Task["status"], boolean> = {
  estrutural: false,
  andamento: false,
  pendente: true,
  concluído: false,
};

export function NodeConnectionsOverlay({ linesMode }: NodeConnectionsOverlayProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const calculateNodePositions = () => {
    const positions = new Map<string, { x: number; y: number }>();
    
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

  const fetchData = async () => {
    const [nodesResult, tasksResult] = await Promise.all([
      supabase.from("nodes").select("*").eq("is_visible", true),
      supabase.from("tasks").select("id, node_id, dependency_id, status"),
    ]);

    if (!nodesResult.error && nodesResult.data) {
      setNodes(nodesResult.data as Node[]);
    }
    if (!tasksResult.error && tasksResult.data) {
      setTasks(tasksResult.data as Task[]);
    }

    setTimeout(calculateNodePositions, 100);
  };

  useEffect(() => {
    if (linesMode !== "off") {
      fetchData();
    }

    const nodesChannel = supabase
      .channel('node-connections-nodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, fetchData)
      .subscribe();

    const tasksChannel = supabase
      .channel('node-connections-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [linesMode]);

  useEffect(() => {
    if (linesMode === "off") return;

    const handleUpdate = () => {
      requestAnimationFrame(calculateNodePositions);
    };
    
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    const timer = setTimeout(calculateNodePositions, 200);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [linesMode, nodes, tasks]);

  if (linesMode === "off" || nodes.length === 0) return null;

  // Create task map for quick lookup
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Build bundled connections for "resumo" mode
  const getBundledConnections = (): BundledConnection[] => {
    // Group by (sourceNodeId, targetNodeId) pair
    const pairMap = new Map<string, { statuses: Task["status"][] }>();

    tasks.forEach(task => {
      if (!task.dependency_id) return;
      
      const depTask = taskMap.get(task.dependency_id);
      if (!depTask) return;

      const sourceNodeId = depTask.node_id;
      const targetNodeId = task.node_id;

      // Skip if same node
      if (sourceNodeId === targetNodeId) return;

      // Skip if positions not available
      if (!nodePositions.has(sourceNodeId) || !nodePositions.has(targetNodeId)) return;

      const pairKey = `${sourceNodeId}->${targetNodeId}`;
      
      if (!pairMap.has(pairKey)) {
        pairMap.set(pairKey, { statuses: [] });
      }
      pairMap.get(pairKey)!.statuses.push(task.status);
    });

    // Convert to bundled connections
    const bundled: BundledConnection[] = [];
    
    pairMap.forEach((data, pairKey) => {
      const [sourceNodeId, targetNodeId] = pairKey.split('->');
      
      // Calculate dominant status (most frequent, ties broken by priority)
      const statusCounts = new Map<Task["status"], number>();
      data.statuses.forEach(s => {
        statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
      });

      let dominantStatus: Task["status"] = "pendente";
      let maxCount = 0;
      
      statusCounts.forEach((count, status) => {
        if (count > maxCount || (count === maxCount && STATUS_PRIORITY[status] < STATUS_PRIORITY[dominantStatus])) {
          maxCount = count;
          dominantStatus = status;
        }
      });

      const sourcePos = nodePositions.get(sourceNodeId)!;
      const targetPos = nodePositions.get(targetNodeId)!;

      bundled.push({
        sourceNodeId,
        targetNodeId,
        count: data.statuses.length,
        dominantStatus,
        x1: sourcePos.x,
        y1: sourcePos.y,
        x2: targetPos.x,
        y2: targetPos.y,
      });
    });

    return bundled;
  };

  // Detalhe mode: show parent-child node connections
  const getDetailConnections = () => {
    return nodes
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
  };

  const bundledConnections = linesMode === "resumo" ? getBundledConnections() : [];
  const detailConnections = linesMode === "detalhe" ? getDetailConnections() : [];

  // Generate Bezier path for bundled connection
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    // Control points for smooth curve
    const curvature = 0.2;
    const cx1 = x1 + dx * curvature;
    const cy1 = y1 + dy * 0.5;
    const cx2 = x2 - dx * curvature;
    const cy2 = y2 - dy * 0.5;

    return {
      path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
      midX,
      midY,
    };
  };

  // Arrow marker ID
  const getArrowId = (status: Task["status"]) => `arrow-${status}`;

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
      <defs>
        {/* Arrow markers for each status */}
        {(["estrutural", "andamento", "pendente", "concluído"] as const).map(status => (
          <marker
            key={status}
            id={getArrowId(status)}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={STATUS_COLORS[status]} />
          </marker>
        ))}
      </defs>

      {/* Resumo mode: Bundled connections with Bezier curves */}
      {linesMode === "resumo" && bundledConnections.map(conn => {
        const { path, midX, midY } = getBezierPath(conn.x1, conn.y1, conn.x2, conn.y2);
        const color = STATUS_COLORS[conn.dominantStatus];
        const strokeWidth = STATUS_STROKE_WIDTH[conn.dominantStatus];
        const opacity = STATUS_OPACITY[conn.dominantStatus];
        const isDashed = STATUS_DASHED[conn.dominantStatus];
        const haloWidth = strokeWidth + 6;

        return (
          <g key={`${conn.sourceNodeId}->${conn.targetNodeId}`}>
            {/* White halo for readability */}
            <path
              d={path}
              fill="none"
              stroke="white"
              strokeWidth={haloWidth}
              strokeLinecap="round"
            />
            
            {/* Bezier path with arrow */}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeDasharray={isDashed ? "6 4" : undefined}
              strokeLinecap="round"
              markerEnd={`url(#${getArrowId(conn.dominantStatus)})`}
            />
            
            {/* Count pill */}
            <rect
              x={midX - 14}
              y={midY - 10}
              width="28"
              height="20"
              rx="10"
              fill={color}
              opacity="0.9"
            />
            <text
              x={midX}
              y={midY + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="white"
            >
              x{conn.count}
            </text>
          </g>
        );
      })}

      {/* Detalhe mode: Simple dashed lines with halo */}
      {linesMode === "detalhe" && detailConnections.map(conn => (
        <g key={conn.id}>
          {/* White halo for readability */}
          <line
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <line
            x1={conn.x1}
            y1={conn.y1}
            x2={conn.x2}
            y2={conn.y2}
            stroke="hsl(var(--foreground))"
            strokeWidth="2"
            opacity="0.4"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}
