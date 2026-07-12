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

const ROOT_ID = "d7c76db8-b7e0-4ce1-87ca-21275c346326";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface NodeRow extends Node {
  node_type: "root" | "area" | "team" | "function" | null;
  is_active: boolean;
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
  const [allNodes, setAllNodes] = useState<NodeRow[]>([]);
  const [selfType, setSelfType] = useState<NodeRow["node_type"]>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isRoot = node.id === ROOT_ID || node.parent_id === null;

  useEffect(() => {
    if (open) fetchAllNodes();
  }, [open]);

  const fetchAllNodes = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("id, parent_id, title, color, is_visible, node_type, is_active")
      .eq("is_active", true)
      .order("title", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nós",
        description: error.message,
      });
      return;
    }

    const rows = (data as any as NodeRow[]) || [];
    const self = rows.find((n) => n.id === node.id);
    setSelfType(self?.node_type ?? null);

    // Descendentes (evita ciclo) — em memória
    const childrenMap = new Map<string, string[]>();
    for (const n of rows) {
      if (!n.parent_id) continue;
      const arr = childrenMap.get(n.parent_id) || [];
      arr.push(n.id);
      childrenMap.set(n.parent_id, arr);
    }
    const descendants = new Set<string>();
    const stack = [node.id];
    while (stack.length) {
      const cur = stack.pop()!;
      const ch = childrenMap.get(cur) || [];
      for (const c of ch) {
        if (!descendants.has(c)) {
          descendants.add(c);
          stack.push(c);
        }
      }
    }

    const selfNodeType = self?.node_type ?? null;
    const validNodes = rows.filter((n) => {
      if (n.id === node.id) return false;
      if (descendants.has(n.id)) return false;
      if (!n.is_active) return false;
      if (n.node_type === "function") return false;
      // Compatibilidade tipada
      if (selfNodeType === "area" && n.node_type && !["root", "area"].includes(n.node_type)) return false;
      if (selfNodeType === "team" && n.node_type && !["area", "team"].includes(n.node_type)) return false;
      if (selfNodeType === "function" && n.node_type && !["area", "team"].includes(n.node_type)) return false;
      return true;
    });
    setAllNodes(validNodes);
  };

  const handleMove = async () => {
    if (isRoot) {
      toast({ variant: "destructive", title: "A raiz não pode ser movida." });
      return;
    }
    if (!selectedParentId) {
      toast({ variant: "destructive", title: "Selecione um pai." });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from("nodes")
      .update({ parent_id: selectedParentId } as any)
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
          {isRoot ? (
            <p className="text-sm text-muted-foreground">
              A raiz do organograma não pode ser movida.
            </p>
          ) : (
            <>
              <label className="text-sm font-medium mb-2 block">
                Selecione o novo pai:
              </label>
              <Select
                value={selectedParentId || ""}
                onValueChange={(value) => setSelectedParentId(value || null)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Escolha um nó pai válido" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {allNodes.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      Nenhum destino compatível.
                    </div>
                  ) : (
                    allNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.title}
                        {n.node_type ? ` — ${n.node_type}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selfType && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tipo deste nó: {selfType}. Destinos incompatíveis, inativos, funções, o
                  próprio nó e descendentes são ocultados automaticamente.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleMove} disabled={isLoading || isRoot}>
            {isLoading ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
