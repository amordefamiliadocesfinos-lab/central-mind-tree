import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface MoveNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: Node;
  onNodeMoved: () => void;
}

export function MoveNodeDialog({
  open,
  onOpenChange,
  node,
  onNodeMoved,
}: MoveNodeDialogProps) {
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAllNodes();
    }
  }, [open]);

  const fetchAllNodes = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .eq("is_visible", true)
      .order("title", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nós",
        description: error.message,
      });
    } else {
      // Filtrar o próprio nó e seus descendentes para evitar loops
      const descendants = await getDescendants(node.id);
      const validNodes = (data || []).filter(
        (n) => n.id !== node.id && !descendants.includes(n.id)
      ) as Node[];
      setAllNodes(validNodes);
    }
  };

  const getDescendants = async (nodeId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("nodes")
      .select("id")
      .eq("parent_id", nodeId)
      .eq("is_visible", true);

    if (error || !data) return [];

    const childIds = data.map((n) => n.id);
    const allDescendants = [...childIds];

    for (const childId of childIds) {
      const childDescendants = await getDescendants(childId);
      allDescendants.push(...childDescendants);
    }

    return allDescendants;
  };

  const handleMove = async () => {
    setIsLoading(true);

    const { error } = await supabase
      .from("nodes")
      .update({ parent_id: selectedParentId })
      .eq("id", node.id);

    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao mover nó",
        description: error.message,
      });
    } else {
      toast({ title: "Nó movido com sucesso" });
      onOpenChange(false);
      onNodeMoved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Mover Nó: {node.title}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">
            Selecione o novo pai:
          </label>
          <Select
            value={selectedParentId || "root"}
            onValueChange={(value) =>
              setSelectedParentId(value === "root" ? null : value)
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Escolha um nó" />
            </SelectTrigger>
            <SelectContent className="bg-popover max-h-[300px]">
              <SelectItem value="root">Raiz (sem pai)</SelectItem>
              {allNodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleMove} disabled={isLoading}>
            {isLoading ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}