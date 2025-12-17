import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GripVertical, Plus, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Node {
  id: string;
  title: string;
  color: string;
  parent_id: string | null;
  order_index: number;
  is_visible: boolean;
}

interface Task {
  id: string;
  title: string;
  status: string;
  node_id: string;
  order_index: number;
  scheduled_date: string | null;
}

interface HierarchyNode extends Node {
  children: HierarchyNode[];
  tasks: Task[];
}

const STATUS_ORDER: Record<string, number> = {
  estrutural: 0,
  andamento: 1,
  pendente: 2,
  concluido: 3,
};

const STATUS_COLORS: Record<string, string> = {
  estrutural: "bg-purple-500",
  andamento: "bg-red-500",
  pendente: "bg-yellow-500",
  concluido: "bg-green-500",
};

export function WeeklyHierarchyView() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Drag state
  const draggedNodeRef = useRef<{ id: string; parentId: string | null } | null>(null);
  const draggedTaskRef = useRef<{ id: string; nodeId: string } | null>(null);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekPeriod = `${format(weekStart, "dd/MM", { locale: ptBR })} - ${format(weekEnd, "dd/MM", { locale: ptBR })}`;

  const loadData = useCallback(async () => {
    const [nodesRes, tasksRes] = await Promise.all([
      supabase
        .from("nodes")
        .select("id, title, color, parent_id, order_index, is_visible")
        .eq("is_visible", true)
        .order("order_index"),
      supabase
        .from("tasks")
        .select("id, title, status, node_id, order_index, scheduled_date")
        .is("deleted_at", null)
        .in("status", ["estrutural", "andamento", "pendente"])
        .order("order_index"),
    ]);

    if (nodesRes.data) setNodes(nodesRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build hierarchy from flat nodes
  useEffect(() => {
    const nodeMap = new Map<string, HierarchyNode>();
    const rootNodes: HierarchyNode[] = [];

    // Create hierarchy nodes
    nodes.forEach((node) => {
      nodeMap.set(node.id, {
        ...node,
        children: [],
        tasks: tasks
          .filter((t) => t.node_id === node.id)
          .sort((a, b) => {
            // Estrutural always on top
            const orderA = STATUS_ORDER[a.status] ?? 99;
            const orderB = STATUS_ORDER[b.status] ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.order_index - b.order_index;
          }),
      });
    });

    // Build tree
    nodes.forEach((node) => {
      const hierarchyNode = nodeMap.get(node.id)!;
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(hierarchyNode);
      } else {
        rootNodes.push(hierarchyNode);
      }
    });

    // Sort children by order_index
    const sortChildren = (node: HierarchyNode) => {
      node.children.sort((a, b) => a.order_index - b.order_index);
      node.children.forEach(sortChildren);
    };
    rootNodes.forEach(sortChildren);
    rootNodes.sort((a, b) => a.order_index - b.order_index);

    setHierarchy(rootNodes);

    // Expand first level by default
    if (rootNodes.length > 0 && expandedNodes.size === 0) {
      setExpandedNodes(new Set(rootNodes.map((n) => n.id)));
    }
  }, [nodes, tasks]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Node drag handlers
  const handleNodeDragStart = (e: React.DragEvent, node: HierarchyNode) => {
    draggedNodeRef.current = { id: node.id, parentId: node.parent_id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/node", node.id);
  };

  const handleNodeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleNodeDrop = async (e: React.DragEvent, targetNode: HierarchyNode, position: "before" | "after" | "inside") => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNodeRef.current) return;
    const draggedId = draggedNodeRef.current.id;
    if (draggedId === targetNode.id) return;

    // Prevent dropping a node inside itself or its descendants
    const isDescendant = (parentId: string, checkId: string): boolean => {
      const node = nodes.find((n) => n.id === checkId);
      if (!node) return false;
      if (node.parent_id === parentId) return true;
      if (node.parent_id) return isDescendant(parentId, node.parent_id);
      return false;
    };

    if (isDescendant(draggedId, targetNode.id)) {
      toast.error("Não pode mover nó para dentro de si mesmo");
      return;
    }

    const newParentId = position === "inside" ? targetNode.id : targetNode.parent_id;

    // Get siblings and calculate new order
    const siblings = nodes
      .filter((n) => n.parent_id === newParentId && n.id !== draggedId)
      .sort((a, b) => a.order_index - b.order_index);

    let newOrderIndex: number;
    if (position === "inside") {
      // Add as last child
      const children = nodes.filter((n) => n.parent_id === targetNode.id);
      newOrderIndex = children.length > 0 ? Math.max(...children.map((c) => c.order_index)) + 1 : 0;
    } else {
      const targetIndex = siblings.findIndex((n) => n.id === targetNode.id);
      if (position === "before") {
        newOrderIndex = targetIndex > 0 ? (siblings[targetIndex - 1].order_index + targetNode.order_index) / 2 : targetNode.order_index - 1;
      } else {
        newOrderIndex = targetIndex < siblings.length - 1 ? (targetNode.order_index + siblings[targetIndex + 1].order_index) / 2 : targetNode.order_index + 1;
      }
    }

    const { error } = await supabase
      .from("nodes")
      .update({ parent_id: newParentId, order_index: newOrderIndex })
      .eq("id", draggedId);

    if (error) {
      toast.error("Erro ao mover nó");
    } else {
      toast.success("Nó movido");
      loadData();
    }

    draggedNodeRef.current = null;
  };

  // Task drag handlers
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    // Don't allow dragging estrutural tasks
    if (task.status === "estrutural") {
      e.preventDefault();
      return;
    }
    draggedTaskRef.current = { id: task.id, nodeId: task.node_id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/task", task.id);
  };

  const handleTaskDrop = async (e: React.DragEvent, targetTask: Task, position: "before" | "after") => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTaskRef.current) return;
    const draggedId = draggedTaskRef.current.id;
    if (draggedId === targetTask.id) return;

    // Can't reorder around estrutural tasks
    if (targetTask.status === "estrutural") {
      toast.error("Tarefas estruturais sempre ficam no topo");
      return;
    }

    const draggedTask = tasks.find((t) => t.id === draggedId);
    if (!draggedTask || draggedTask.status === "estrutural") return;

    // Get siblings in same node with same non-estrutural status context
    const siblings = tasks
      .filter((t) => t.node_id === targetTask.node_id && t.status !== "estrutural" && t.id !== draggedId)
      .sort((a, b) => a.order_index - b.order_index);

    const targetIndex = siblings.findIndex((t) => t.id === targetTask.id);
    let newOrderIndex: number;

    if (position === "before") {
      newOrderIndex = targetIndex > 0 ? (siblings[targetIndex - 1].order_index + targetTask.order_index) / 2 : targetTask.order_index - 1;
    } else {
      newOrderIndex = targetIndex < siblings.length - 1 ? (targetTask.order_index + siblings[targetIndex + 1].order_index) / 2 : targetTask.order_index + 1;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ node_id: targetTask.node_id, order_index: newOrderIndex })
      .eq("id", draggedId);

    if (error) {
      toast.error("Erro ao mover tarefa");
    } else {
      toast.success("Tarefa movida");
      loadData();
    }

    draggedTaskRef.current = null;
  };

  const renderNode = (node: HierarchyNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const hasTasks = node.tasks.length > 0;

    return (
      <div key={node.id} className={cn("border-l-2 border-muted", depth > 0 && "ml-4")}>
        <div
          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-r group cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={(e) => handleNodeDragStart(e, node)}
          onDragOver={handleNodeDragOver}
          onDrop={(e) => handleNodeDrop(e, node, "inside")}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => toggleExpand(node.id)}
            disabled={!hasChildren && !hasTasks}
          >
            {(hasChildren || hasTasks) ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="w-4" />
            )}
          </Button>

          <div
            className={cn(
              "w-3 h-3 rounded-full shrink-0",
              node.color === "roxo" && "bg-purple-500",
              node.color === "vermelho" && "bg-red-500",
              node.color === "amarelo" && "bg-yellow-500",
              node.color === "verde" && "bg-green-500"
            )}
          />

          <span className="font-medium text-sm flex-1 truncate">{node.title}</span>

          {hasTasks && (
            <Badge variant="secondary" className="text-xs">
              {node.tasks.length}
            </Badge>
          )}
        </div>

        {isExpanded && (
          <div className="pl-6">
            {/* Tasks */}
            {node.tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 p-2 text-sm hover:bg-muted/30 rounded group",
                  task.status !== "estrutural" && "cursor-grab active:cursor-grabbing"
                )}
                draggable={task.status !== "estrutural"}
                onDragStart={(e) => handleTaskDragStart(e, task)}
                onDragOver={handleNodeDragOver}
                onDrop={(e) => handleTaskDrop(e, task, "after")}
              >
                {task.status !== "estrutural" && (
                  <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_COLORS[task.status])} />
                <span className="truncate flex-1">{task.title}</span>
                {task.status === "estrutural" && (
                  <Badge variant="outline" className="text-xs">fixo</Badge>
                )}
              </div>
            ))}

            {/* Children nodes */}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando hierarquia...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderTree className="h-5 w-5" />
            Visão Semanal Hierárquica
          </CardTitle>
          <Badge variant="outline">{weekPeriod}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Arraste nós e tarefas para reordenar. Tarefas estruturais ficam sempre no topo.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {hierarchy.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum nó encontrado</p>
          </div>
        ) : (
          hierarchy.map((node) => renderNode(node, 0))
        )}
      </CardContent>
    </Card>
  );
}
