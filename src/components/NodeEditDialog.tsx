import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader, MediaItem } from "@/components/MediaUploader";
import { Save } from "lucide-react";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
}

interface NodeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: Node;
  onNodeChange: () => void;
}

export function NodeEditDialog({
  open,
  onOpenChange,
  node,
  onNodeChange,
}: NodeEditDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(node.title);
  const [color, setColor] = useState<Node["color"]>(node.color);
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(node.title);
      setColor(node.color);
      setDescription("");
      setMedia([]);
    }
  }, [open, node]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Título não pode estar vazio",
      });
      return;
    }

    const { error } = await supabase
      .from("nodes")
      .update({ title, color })
      .eq("id", node.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar nó",
        description: error.message,
      });
      return;
    }

    toast({ title: "Nó atualizado com sucesso" });
    onNodeChange();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Nó</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do nó"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cor</label>
            <Select value={color} onValueChange={(v: Node["color"]) => setColor(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roxo">Roxo (Estrutural)</SelectItem>
                <SelectItem value="vermelho">Vermelho (Em Andamento)</SelectItem>
                <SelectItem value="amarelo">Amarelo (Pendente)</SelectItem>
                <SelectItem value="verde">Verde (Concluído)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição (opcional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do nó..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Anexos de Mídia</label>
            <MediaUploader media={media} onChange={setMedia} />
          </div>

          <Button onClick={handleSave} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
