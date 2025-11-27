import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NodeBox } from "./NodeBox";
import { useToast } from "@/hooks/use-toast";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface NodeTreeProps {
  parentId: string | null;
  onNodeChange: () => void;
}

export function NodeTree({ parentId, onNodeChange }: NodeTreeProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const { toast } = useToast();

  const fetchChildren = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .eq("parent_id", parentId)
      .eq("is_visible", true)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nós",
        description: error.message,
      });
    } else {
      setNodes((data || []) as Node[]);
    }
  };

  useEffect(() => {
    fetchChildren();

    // Configurar realtime para atualizações automáticas
    const filter = parentId ? `parent_id=eq.${parentId}` : 'parent_id=is.null';
    const channel = supabase
      .channel(`nodes-${parentId || 'root'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nodes',
          filter: filter
        },
        () => {
          fetchChildren();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentId]);

  const handleNodeChange = () => {
    fetchChildren();
    onNodeChange();
  };

  if (nodes.length === 0) return null;

  return (
    <>
      {nodes.map((node) => (
        <NodeBox key={node.id} node={node} onNodeChange={handleNodeChange}>
          <NodeTree parentId={node.id} onNodeChange={onNodeChange} />
        </NodeBox>
      ))}
    </>
  );
}