import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NodeBox } from "@/components/NodeBox";
import { NodeTree } from "@/components/NodeTree";
import { useToast } from "@/hooks/use-toast";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

const Index = () => {
  const [rootNode, setRootNode] = useState<Node | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const fetchRootNode = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("*")
      .is("parent_id", null)
      .eq("is_visible", true)
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nó raiz",
        description: error.message,
      });
    } else {
      setRootNode(data as Node);
    }
  };

  useEffect(() => {
    fetchRootNode();
  }, [refreshKey]);

  const handleNodeChange = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!rootNode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-12 text-foreground">
          Painel Central – Cérebro
        </h1>
        <div className="flex justify-center">
          <NodeBox node={rootNode} onNodeChange={handleNodeChange}>
            <NodeTree parentId={rootNode.id} onNodeChange={handleNodeChange} />
          </NodeBox>
        </div>
      </div>
    </div>
  );
};

export default Index;