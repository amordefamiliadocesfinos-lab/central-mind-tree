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
}

export function NodeBox({ node, children, onNodeChange }: NodeBoxProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(node.title);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isTasksDialogOpen, setIsTasksDialogOpen] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [hasTasks, setHasTasks] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkChildren = async () => {
      const { count } = await supabase
        .from("nodes")
        .select("*", { count: "exact", head: true })
        .eq("parent_id", node.id);
      
      setHasChildren((count || 0) > 0);
    };

    const checkTasks = async () => {
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("node_id", node.id);
      
      setHasTasks((count || 0) > 0);
    };

    checkChildren();
    checkTasks();
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
        onOpenChange={setIsMoveDialogOpen}
        node={node}
        onNodeMoved={onNodeChange}
      />

      <TasksDialog
        open={isTasksDialogOpen}
        onOpenChange={setIsTasksDialogOpen}
        nodeId={node.id}
        nodeTitle={node.title}
        onTasksChange={onNodeChange}
      />
    </div>
  );
}