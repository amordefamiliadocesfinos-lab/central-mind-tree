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
import { MediaUploader, MediaItem, uploadMedia, loadMediaFromUrls } from "@/components/MediaUploader";
import { SheetList } from "@/components/SheetList";
import { Save } from "lucide-react";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
  media_urls?: string[];
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(node.title);
      setColor(node.color);
      setDescription("");
      // Load existing media
      fetchNodeMedia();
    }
  }, [open, node.id]);

  const fetchNodeMedia = async () => {
    const { data } = await supabase
      .from("nodes")
      .select("media_urls")
      .eq("id", node.id)
      .maybeSingle();

    if (data?.media_urls && Array.isArray(data.media_urls)) {
      setMedia(loadMediaFromUrls(data.media_urls as string[]));
    } else {
      setMedia([]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Título não pode estar vazio",
      });
      return;
    }

    setSaving(true);
    try {
      // Upload new media files
      const mediaUrls = await uploadMedia(media, "node", node.id);

      const { error } = await supabase
        .from("nodes")
        .update({ title, color, media_urls: mediaUrls })
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
    } finally {
      setSaving(false);
    }
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
            <MediaUploader media={media} onChange={setMedia} entityType="node" entityId={node.id} />
          </div>

          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium">Planilhas</label>
            <SheetList nodeId={node.id} />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
