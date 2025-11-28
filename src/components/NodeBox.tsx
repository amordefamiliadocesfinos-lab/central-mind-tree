import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2, X, Check, Move, ListTodo, Eye } from "lucide-react";
import { MoveNodeDialog } from "./MoveNodeDialog";
import { TasksDialog } from "./TasksDialog";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface NodeBoxProps {
  node: Node;
  children?: React.ReactNode;
  onNodeChange: () => void;
  onDialogOpenChange?: (open: boolean) => void;
}

export function NodeBox({ node, children, onNodeChange, onDialogOpenChange }: NodeBoxProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(node.title);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isTasksDialogOpen, setIsTasksDialogOpen] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [hasTasks, setHasTasks] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [taskCounts, setTaskCounts] = useState({
    estrutural: 0,
    andamento: 0,
    pendente: 0,
    concluido: 0
  });
  const [averageProgress, setAverageProgress] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    
    const checkData = async () => {
      try {
        // Delay aleatório para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
        
        if (!mounted) return;

        // Combinar as três verificações em uma única chamada
        const [childrenResult, tasksResult, allTasks] = await Promise.all([
          supabase
            .from("nodes")
            .select("*", { count: "exact", head: true })
            .eq("parent_id", node.id),
          supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("node_id", node.id),
          supabase
            .from("tasks")
            .select("status, progress")
            .eq("node_id", node.id)
        ]);

        if (mounted) {
          setHasChildren((childrenResult.count || 0) > 0);
          setHasTasks((tasksResult.count || 0) > 0);
          
          // Contar tarefas por status e calcular progresso médio
          const counts = {
            estrutural: 0,
            andamento: 0,
            pendente: 0,
            concluido: 0
          };
          
          let totalProgress = 0;
          let taskCount = 0;
          
          (allTasks.data || []).forEach((task: { status: string; progress: number }) => {
            if (task.status === "estrutural") counts.estrutural++;
            else if (task.status === "andamento") counts.andamento++;
            else if (task.status === "pendente") counts.pendente++;
            else if (task.status === "concluído") counts.concluido++;
            
            totalProgress += task.progress || 0;
            taskCount++;
          });
          
          setTaskCounts(counts);
          setAverageProgress(taskCount > 0 ? Math.round(totalProgress / taskCount) : null);
        }
      } catch (error) {
        console.error("Erro ao verificar nó:", error);
      }
    };

    checkData();
    return () => { mounted = false; };
  }, [node.id, onNodeChange]);

  const colorMap = {
    roxo: { bg: "bg-node-roxo", text: "text-node-roxo-foreground" },
    vermelho: { bg: "bg-node-vermelho", text: "text-node-vermelho-foreground" },
    amarelo: { bg: "bg-node-amarelo", text: "text-node-amarelo-foreground" },
    verde: { bg: "bg-node-verde", text: "text-node-verde-foreground" },
  };

  const colors = colorMap[node.color];

  const handleAddSubnode = async () => {
    const { error } = await supabase.from("nodes").insert({
      parent_id: node.id,
      title: "Novo Nó",
      color: "roxo",
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar subnó",
        description: error.message,
      });
    } else {
      toast({ title: "Subnó adicionado" });
      onNodeChange();
    }
  };

  const handleSaveEdit = async () => {
    if (!editedTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Título não pode estar vazio",
      });
      return;
    }

    const { error } = await supabase
      .from("nodes")
      .update({ title: editedTitle })
      .eq("id", node.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao editar título",
        description: error.message,
      });
    } else {
      toast({ title: "Título atualizado" });
      setIsEditing(false);
      onNodeChange();
    }
  };

  const handleDelete = async () => {
    if (node.parent_id === null) {
      toast({
        variant: "destructive",
        title: "Não é possível excluir o nó raiz",
      });
      return;
    }

    const { error } = await supabase.from("nodes").delete().eq("id", node.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir nó",
        description: error.message,
      });
    } else {
      toast({ title: "Nó excluído" });
      onNodeChange();
    }
  };

  const handleToggleVisibility = async () => {
    const newVisibility = !node.is_visible;
    
    const { error } = await supabase
      .from("nodes")
      .update({ is_visible: newVisibility })
      .eq("id", node.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar visibilidade",
      });
      return;
    }

    // If making visible, also make all children visible
    if (newVisibility) {
      await supabase
        .from("nodes")
        .update({ is_visible: true })
        .eq("parent_id", node.id);
    }

    toast({ title: node.is_visible ? "Nó ocultado" : "Nó revelado" });
    onNodeChange();
  };

  const showChildren = async (id: string) => {
    const { error } = await supabase
      .from("nodes")
      .update({ is_visible: true })
      .eq("parent_id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao mostrar filhos",
      });
      return;
    }

    toast({ title: "Filhos revelados" });
    onNodeChange();
  };

  if (!node.is_visible) {
    return (
      <button
        onClick={handleToggleVisibility}
        className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center hover:bg-muted/20 text-muted-foreground"
      >
        ○
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`${colors.bg} ${colors.text} rounded-lg p-4 min-w-[200px] shadow-md border-2 border-background relative`}
        >
          {hasTasks && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-muted-foreground/50"></div>
          )}
          {hasChildren && (
            <div className="absolute bottom-1 right-1/2 translate-x-1/2 text-muted-foreground/50 text-xs">
              ▾
            </div>
          )}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="h-8 bg-background/10 border-current"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-background/20"
                onClick={handleSaveEdit}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-background/20"
                onClick={() => {
                  setIsEditing(false);
                  setEditedTitle(node.title);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div 
                onClick={() => showChildren(node.id)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <h3 className="text-lg font-semibold text-center">{node.title}</h3>
              </div>
              
              {/* Progress Indicator */}
              {averageProgress !== null && (
                <div className="px-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs opacity-70">Progresso</span>
                    <span className="text-xs font-semibold">{averageProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-background/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-background transition-all duration-300"
                      style={{ width: `${averageProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 justify-center">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-background/20"
                  onClick={handleAddSubnode}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-background/20"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-background/20"
                  onClick={() => setIsMoveDialogOpen(true)}
                >
                  <Move className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-background/20"
                  onClick={() => setIsTasksDialogOpen(true)}
                >
                  <ListTodo className="h-4 w-4" />
                </Button>
                {node.parent_id !== null && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-background/20"
                      onClick={handleToggleVisibility}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-background/20"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              
              {/* Task Status Indicators */}
              <div className="flex gap-2 justify-center mt-2 pt-2 border-t border-current/20">
                {/* Estrutural - Roxo */}
                <button 
                  onClick={() => {
                    const newFilter = filterStatus === "estrutural" ? null : "estrutural";
                    setFilterStatus(newFilter);
                    setIsTasksDialogOpen(true);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${
                    taskCounts.estrutural > 0 
                      ? 'bg-node-roxo text-node-roxo-foreground' 
                      : 'bg-background/20 text-current/40'
                  }`}
                >
                  {taskCounts.estrutural}
                </button>
                
                {/* Em Andamento - Vermelho */}
                <button 
                  onClick={() => {
                    const newFilter = filterStatus === "andamento" ? null : "andamento";
                    setFilterStatus(newFilter);
                    setIsTasksDialogOpen(true);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${
                    taskCounts.andamento > 0 
                      ? 'bg-node-vermelho text-node-vermelho-foreground' 
                      : 'bg-background/20 text-current/40'
                  }`}
                >
                  {taskCounts.andamento}
                </button>
                
                {/* Pendente - Amarelo */}
                <button 
                  onClick={() => {
                    const newFilter = filterStatus === "pendente" ? null : "pendente";
                    setFilterStatus(newFilter);
                    setIsTasksDialogOpen(true);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${
                    taskCounts.pendente > 0 
                      ? 'bg-node-amarelo text-node-amarelo-foreground' 
                      : 'bg-background/20 text-current/40'
                  }`}
                >
                  {taskCounts.pendente}
                </button>
                
                {/* Concluído - Verde */}
                <button 
                  onClick={() => {
                    const newFilter = filterStatus === "concluído" ? null : "concluído";
                    setFilterStatus(newFilter);
                    setIsTasksDialogOpen(true);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${
                    taskCounts.concluido > 0 
                      ? 'bg-node-verde text-node-verde-foreground' 
                      : 'bg-background/20 text-current/40'
                  }`}
                >
                  {taskCounts.concluido}
                </button>
              </div>
            </div>
          )}
        </div>
        {children && <div className="w-px h-8 bg-border"></div>}
      </div>
      {children && (
        <div className="flex gap-8 items-start relative">{children}</div>
      )}

      <MoveNodeDialog
        open={isMoveDialogOpen}
        onOpenChange={(open) => {
          setIsMoveDialogOpen(open);
          onDialogOpenChange?.(open);
        }}
        node={node}
        onNodeMoved={onNodeChange}
      />

      <TasksDialog
        open={isTasksDialogOpen}
        onOpenChange={(open) => {
          setIsTasksDialogOpen(open);
          if (!open) {
            setFilterStatus(null);
          }
          onDialogOpenChange?.(open);
        }}
        nodeId={node.id}
        nodeTitle={node.title}
        onTasksChange={onNodeChange}
        filterStatus={filterStatus}
      />
    </div>
  );
}