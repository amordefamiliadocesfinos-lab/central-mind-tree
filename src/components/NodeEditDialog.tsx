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

const ROOT_ID = "d7c76db8-b7e0-4ce1-87ca-21275c346326";
const NONE = "__none__";

interface Node {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
  media_urls?: string[];
}

type NodeType = "root" | "area" | "team" | "function";

interface AppUserLite {
  id: string;
  name: string;
  is_active: boolean;
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
  const [nodeType, setNodeType] = useState<NodeType | "">("");
  const [responsibleId, setResponsibleId] = useState<string>(NONE);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<AppUserLite[]>([]);

  const isRoot = node.id === ROOT_ID || node.parent_id === null;

  useEffect(() => {
    if (open) {
      setTitle(node.title);
      setColor(node.color);
      setDescription("");
      loadNode();
      loadUsers();
    }
  }, [open, node.id]);

  const loadNode = async () => {
    const { data } = await supabase
      .from("nodes")
      .select("media_urls, node_type, responsible_user_id, is_active")
      .eq("id", node.id)
      .maybeSingle();

    const row = data as any;
    if (row?.media_urls && Array.isArray(row.media_urls)) {
      setMedia(loadMediaFromUrls(row.media_urls as string[]));
    } else {
      setMedia([]);
    }
    setNodeType((row?.node_type as NodeType) ?? "");
    setResponsibleId(row?.responsible_user_id ?? NONE);
    setIsActive(row?.is_active !== false);
  };

  const loadUsers = async () => {
    // Carrega ativos + o vinculado atual (mesmo que inativo) para exibição correta
    const { data } = await supabase
      .from("app_users")
      .select("id, name, is_active")
      .order("name");
    setUsers((data as AppUserLite[]) || []);
  };

  const responsibleOptions = users.filter(
    (u) => u.is_active || u.id === (responsibleId !== NONE ? responsibleId : ""),
  );

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Título não pode estar vazio" });
      return;
    }

    setSaving(true);
    try {
      const mediaUrls = await uploadMedia(media, "node", node.id);

      const patch: Record<string, unknown> = {
        title,
        color,
        media_urls: mediaUrls,
      };
      if (!isRoot) {
        if (nodeType) patch.node_type = nodeType;
        patch.responsible_user_id = responsibleId === NONE ? null : responsibleId;
      }

      const { error } = await supabase
        .from("nodes")
        .update(patch as any)
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

  const situacaoLabel = isActive ? "Ativo" : "Arquivado";

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
              disabled={isRoot}
            />
            {isRoot && (
              <p className="text-xs text-muted-foreground">
                A raiz é protegida: título e tipo não podem ser alterados.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={isRoot ? "root" : (nodeType || "")}
                onValueChange={(v) => setNodeType(v as NodeType)}
                disabled={isRoot}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {isRoot && <SelectItem value="root">Raiz</SelectItem>}
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="team">Equipe</SelectItem>
                  <SelectItem value="function">Função</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Situação</label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm">
                {situacaoLabel}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Responsável</label>
            <Select
              value={responsibleId}
              onValueChange={(v) => setResponsibleId(v)}
              disabled={isRoot}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {responsibleOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.is_active ? u.name : `${u.name} — Inativo`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
