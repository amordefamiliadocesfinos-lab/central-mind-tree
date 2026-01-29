import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LinesMode } from "@/contexts/LinesModeContext";

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

interface NodeConnectionsOverlayProps {
  linesMode: LinesMode;
}

interface BundledConnection {
  sourceNodeId: string;
  targetNodeId: string;
  count: number;
  dominantStatus: Task["status"];
  tasks: { taskId: string; status: Task["status"] }[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface IndividualConnection {
  taskId: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: Task["status"];
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
  const [nodePositions, setNodePositions] = useState<Map<string, { 
    x: number; y: number; 
    left: number; right: number; 
    top: number; bottom: number;
    width: number; height: number;
  }>>(new Map());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const lastUpdateRef = useRef<number>(0);
  const throttleMs = 100;

  const calculateNodePositions = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) return;
    lastUpdateRef.current = now;

    const positions = new Map<string, { 
      x: number; y: number; 
      left: number; right: number; 
      top: number; bottom: number;
      width: number; height: number;
    }>();
    
    const nodeElements = document.querySelectorAll('[data-node-id]');
    
    nodeElements.forEach((element) => {
      const nodeId = element.getAttribute('data-node-id');
      if (!nodeId) return;

      const rect = element.getBoundingClientRect();

      positions.set(nodeId, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    });

    if (positions.size > 0) {
      setNodePositions(positions);
    }
  }, []);

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

  // Handle node hover detection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const nodeElement = target.closest('[data-node-id]');
    
    if (nodeElement) {
      const nodeId = nodeElement.getAttribute('data-node-id');
      setHoveredNodeId(nodeId);
    } else {
      setHoveredNodeId(null);
    }
  }, []);

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
    
    // Add mouse move listener for hover detection
    document.addEventListener('mousemove', handleMouseMove);
    
    const timer = setTimeout(calculateNodePositions, 200);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [linesMode, nodes, tasks, handleMouseMove]);

  // Reset expanded pairs when mode changes
  useEffect(() => {
    setExpandedPairs(new Set());
  }, [linesMode]);

  // Create task map for quick lookup - memoized
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // Memoized individual connections
  const allIndividualConnections = useMemo((): IndividualConnection[] => {
    if (linesMode === "off" || nodes.length === 0) return [];
    
    const connections: IndividualConnection[] = [];

    tasks.forEach(task => {
      if (!task.dependency_id) return;
      
      const depTask = taskMap.get(task.dependency_id);
      if (!depTask) return;

      const sourceNodeId = depTask.node_id;
      const targetNodeId = task.node_id;

      if (sourceNodeId === targetNodeId) return;
      if (!nodePositions.has(sourceNodeId) || !nodePositions.has(targetNodeId)) return;

      const sourcePos = nodePositions.get(sourceNodeId)!;
      const targetPos = nodePositions.get(targetNodeId)!;

      connections.push({
        taskId: task.id,
        sourceNodeId,
        targetNodeId,
        status: task.status,
        x1: sourcePos.x,
        y1: sourcePos.y,
        x2: targetPos.x,
        y2: targetPos.y,
      });
    });

    return connections;
  }, [tasks, taskMap, nodePositions, linesMode, nodes.length]);

  // Memoized anchor points calculator - MUST be before early return
  const getAnchorPoints = useCallback((sourceNodeId: string, targetNodeId: string) => {
    const source = nodePositions.get(sourceNodeId);
    const target = nodePositions.get(targetNodeId);
    
    if (!source || !target) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }

    // Determine exit/entry sides based on relative horizontal position
    const exitRight = target.x > source.x;
    
    const x1 = exitRight ? source.right : source.left;
    const y1 = source.y;
    const x2 = exitRight ? target.left : target.right;
    const y2 = target.y;

    return { x1, y1, x2, y2 };
  }, [nodePositions]);

  // Generate Bezier path with horizontal control points - MUST be before early return
  const getBezierPath = useCallback((x1: number, y1: number, x2: number, y2: number, offset = 0) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // Add perpendicular offset for multiple lines
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = len > 0 ? (-dy / len) * offset : 0;
    const perpY = len > 0 ? (dx / len) * offset : 0;
    
    // Horizontal control = 0.3 × horizontal distance
    const controlOffset = Math.abs(dx) * 0.3;
    
    // Control points extend horizontally from anchors
    const cx1 = x1 + (dx > 0 ? controlOffset : -controlOffset) + perpX;
    const cy1 = y1 + perpY;
    const cx2 = x2 - (dx > 0 ? controlOffset : -controlOffset) + perpX;
    const cy2 = y2 + perpY;

    const startX = x1 + perpX;
    const startY = y1 + perpY;
    const endX = x2 + perpX;
    const endY = y2 + perpY;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    return {
      path: `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`,
      midX,
      midY,
    };
  }, []);

  const getArrowId = useCallback((status: Task["status"], faded = false) => `arrow-${status}${faded ? '-faded' : ''}`, []);

  const togglePairExpansion = useCallback((pairKey: string) => {
    setExpandedPairs(prev => {
      const next = new Set(prev);
      if (next.has(pairKey)) {
        next.delete(pairKey);
      } else {
        next.add(pairKey);
      }
      return next;
    });
  }, []);

  // Check if connection involves hovered node - MUST be before early return
  const isConnectionRelevant = useCallback((sourceNodeId: string, targetNodeId: string) => {
    if (!hoveredNodeId) return true;
    return sourceNodeId === hoveredNodeId || targetNodeId === hoveredNodeId;
  }, [hoveredNodeId]);

  // CEO mode opacity based on status - MUST be before early return
  const getCEOOpacity = useCallback((status: Task["status"]) => {
    if (linesMode !== "ceo") return 1;
    if (status === "estrutural" || status === "andamento") return 1;
    return 0.15;
  }, [linesMode]);

  // Viewport culling - check if connection is visible - MUST be before early return
  const viewportDimensions = useMemo(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }), [nodePositions]);

  const isInViewport = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const padding = 100; // Extra padding for curves
    const minX = Math.min(x1, x2) - padding;
    const maxX = Math.max(x1, x2) + padding;
    const minY = Math.min(y1, y2) - padding;
    const maxY = Math.max(y1, y2) + padding;
    
    return !(maxX < 0 || minX > viewportDimensions.width || maxY < 0 || minY > viewportDimensions.height);
  }, [viewportDimensions]);

  // Memoized bundled connections for resumo/ceo modes
  const bundledConnections = useMemo((): BundledConnection[] => {
    if (linesMode !== "resumo" && linesMode !== "ceo") return [];
    if (nodes.length === 0) return [];
    
    const pairMap = new Map<string, { statuses: Task["status"][]; tasks: { taskId: string; status: Task["status"] }[] }>();

    tasks.forEach(task => {
      if (!task.dependency_id) return;
      
      const depTask = taskMap.get(task.dependency_id);
      if (!depTask) return;

      const sourceNodeId = depTask.node_id;
      const targetNodeId = task.node_id;

      if (sourceNodeId === targetNodeId) return;
      if (!nodePositions.has(sourceNodeId) || !nodePositions.has(targetNodeId)) return;

      const pairKey = `${sourceNodeId}->${targetNodeId}`;
      
      if (!pairMap.has(pairKey)) {
        pairMap.set(pairKey, { statuses: [], tasks: [] });
      }
      const pair = pairMap.get(pairKey)!;
      pair.statuses.push(task.status);
      pair.tasks.push({ taskId: task.id, status: task.status });
    });

    const bundled: BundledConnection[] = [];
    
    pairMap.forEach((data, pairKey) => {
      const [sourceNodeId, targetNodeId] = pairKey.split('->');
      
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
        tasks: data.tasks,
        x1: sourcePos.x,
        y1: sourcePos.y,
        x2: targetPos.x,
        y2: targetPos.y,
      });
    });

    return bundled;
  }, [tasks, taskMap, nodePositions, linesMode, nodes.length]);

  // Effective mode: CEO uses resumo rendering
  const effectiveMode = linesMode === "ceo" ? "resumo" : linesMode;

  // Early return AFTER all hooks
  if (linesMode === "off" || nodes.length === 0) return null;

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
        {/* Arrow markers for each status (normal and faded) */}
        {(["estrutural", "andamento", "pendente", "concluído"] as const).map(status => (
          <g key={status}>
            <marker
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
            <marker
              id={getArrowId(status, true)}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={STATUS_COLORS[status]} opacity="0.1" />
            </marker>
          </g>
        ))}
        {/* Generic faded arrow for detalhe mode */}
        <marker
          id="arrow-faded"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--foreground))" opacity="0.1" />
        </marker>
        <marker
          id="arrow-normal"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--foreground))" opacity="0.6" />
        </marker>
      </defs>

      {/* Resumo/CEO mode: Bundled connections with expandable pills */}
      {(effectiveMode === "resumo") && bundledConnections.map(conn => {
        const pairKey = `${conn.sourceNodeId}->${conn.targetNodeId}`;
        const isExpanded = expandedPairs.has(pairKey);
        const isRelevant = isConnectionRelevant(conn.sourceNodeId, conn.targetNodeId);
        const ceoOpacity = getCEOOpacity(conn.dominantStatus);
        const baseOpacity = (isRelevant ? 1 : 0.1) * ceoOpacity;
        const anchors = getAnchorPoints(conn.sourceNodeId, conn.targetNodeId);

        // Culling: skip if outside viewport
        if (!isInViewport(anchors.x1, anchors.y1, anchors.x2, anchors.y2)) return null;

        if (isExpanded) {
          // Render individual lines for this pair
          return (
            <g key={pairKey}>
              {conn.tasks.map((task, index) => {
                const offset = (index - (conn.tasks.length - 1) / 2) * 12;
                const { path, midX, midY } = getBezierPath(anchors.x1, anchors.y1, anchors.x2, anchors.y2, offset);
                const color = STATUS_COLORS[task.status];
                const strokeWidth = STATUS_STROKE_WIDTH[task.status];
                const taskCeoOpacity = getCEOOpacity(task.status);
                const opacity = STATUS_OPACITY[task.status] * (isRelevant ? 1 : 0.1) * taskCeoOpacity;
                const isDashed = STATUS_DASHED[task.status];
                const haloWidth = strokeWidth + 6;

                return (
                  <g key={task.taskId}>
                    <path d={path} fill="none" stroke="white" strokeWidth={haloWidth} strokeLinecap="round" opacity={baseOpacity} />
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      strokeDasharray={isDashed ? "6 4" : undefined}
                      strokeLinecap="round"
                      markerEnd={`url(#${getArrowId(task.status, !isRelevant)})`}
                    />
                  </g>
                );
              })}
              {/* Collapse pill */}
              <g 
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={() => togglePairExpansion(pairKey)}
              >
                {(() => {
                  const { midX, midY } = getBezierPath(anchors.x1, anchors.y1, anchors.x2, anchors.y2);
                  const color = STATUS_COLORS[conn.dominantStatus];
                  return (
                    <>
                      <rect
                        x={midX - 14}
                        y={midY - 10}
                        width="28"
                        height="20"
                        rx="10"
                        fill={color}
                        opacity={0.9 * baseOpacity}
                      />
                      <text
                        x={midX}
                        y={midY + 4}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="white"
                        opacity={baseOpacity}
                      >
                        ×
                      </text>
                    </>
                  );
                })()}
              </g>
            </g>
          );
        }

        // Render bundled line
        const { path, midX, midY } = getBezierPath(anchors.x1, anchors.y1, anchors.x2, anchors.y2);
        const color = STATUS_COLORS[conn.dominantStatus];
        const strokeWidth = STATUS_STROKE_WIDTH[conn.dominantStatus];
        const opacity = STATUS_OPACITY[conn.dominantStatus] * baseOpacity;
        const isDashed = STATUS_DASHED[conn.dominantStatus];
        const haloWidth = strokeWidth + 6;

        return (
          <g key={pairKey}>
            <path d={path} fill="none" stroke="white" strokeWidth={haloWidth} strokeLinecap="round" opacity={baseOpacity} />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeDasharray={isDashed ? "6 4" : undefined}
              strokeLinecap="round"
              markerEnd={`url(#${getArrowId(conn.dominantStatus, !isRelevant)})`}
            />
            
            {/* Clickable pill */}
            <g 
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={() => togglePairExpansion(pairKey)}
            >
              <rect
                x={midX - 14}
                y={midY - 10}
                width="28"
                height="20"
                rx="10"
                fill={color}
                opacity={0.9 * baseOpacity}
              />
              <text
                x={midX}
                y={midY + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="white"
                opacity={baseOpacity}
              >
                x{conn.count}
              </text>
            </g>
          </g>
        );
      })}

      {/* Detalhe mode: Individual task connections with hover focus */}
      {effectiveMode === "detalhe" && allIndividualConnections.map((conn, index) => {
        const isRelevant = isConnectionRelevant(conn.sourceNodeId, conn.targetNodeId);
        const baseOpacity = isRelevant ? 1 : 0.1;
        const anchors = getAnchorPoints(conn.sourceNodeId, conn.targetNodeId);
        
        // Culling: skip if outside viewport
        if (!isInViewport(anchors.x1, anchors.y1, anchors.x2, anchors.y2)) return null;
        
        const { path } = getBezierPath(anchors.x1, anchors.y1, anchors.x2, anchors.y2);
        const color = STATUS_COLORS[conn.status];
        const strokeWidth = STATUS_STROKE_WIDTH[conn.status];
        const opacity = STATUS_OPACITY[conn.status] * baseOpacity;
        const isDashed = STATUS_DASHED[conn.status];
        const haloWidth = strokeWidth + 6;

        return (
          <g key={conn.taskId}>
            <path d={path} fill="none" stroke="white" strokeWidth={haloWidth} strokeLinecap="round" opacity={baseOpacity} />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeDasharray={isDashed ? "6 4" : undefined}
              strokeLinecap="round"
              markerEnd={`url(#${getArrowId(conn.status, !isRelevant)})`}
            />
          </g>
        );
      })}
    </svg>
  );
}
