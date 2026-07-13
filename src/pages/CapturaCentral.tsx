import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUser } from "@/hooks/useActiveUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Inbox,
  Mic,
  Square,
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  Loader2,
  X,
  Type,
  Paperclip,
  Pencil,
  Trash2,
  Check,
  FileText,
  FileAudio,
  FileVideo,
  Download,
} from "lucide-react";

type EntryType = "texto" | "audio" | "foto" | "video";

interface Attachment {
  url: string;
  path: string;
  name: string;
  type: string;
  size: number;
}

interface InboxEntry {
  id: string;
  content: string | null;
  entry_type: EntryType;
  media_url: string | null;
  media_path?: string | null;
  attachments?: Attachment[] | null;
  user_name: string | null;
  created_at: string;
  status: string;
}

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  kind: "foto" | "video" | "audio" | "arquivo";
}

const TYPE_META: Record<EntryType, { label: string; color: string }> = {
  texto: { label: "Texto", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  audio: { label: "Áudio", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  foto: { label: "Foto", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  video: { label: "Vídeo", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

const MAX_SIZE = 25 * 1024 * 1024;

function kindFromMime(mime: string): PendingAttachment["kind"] {
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "arquivo";
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("video/")) return FileVideo;
  return FileText;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function CapturaCentral() {
  const { activeUser } = useActiveUser();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingEntry, setDeletingEntry] = useState<InboxEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = "Captura Central — Caixa de Entrada";
    fetchEntries();
    const channel = supabase
      .channel("inbox-entries-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_entries" },
        () => fetchEntries(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchEntries() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("inbox_entries")
      .select("id, content, entry_type, media_url, media_path, attachments, user_name, created_at, status")
      .eq("status", "aguardando_selecao")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setEntries(data as unknown as InboxEntry[]);
    setLoadingList(false);
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const accepted: PendingAttachment[] = [];
    for (const f of arr) {
      if (f.size > MAX_SIZE) {
        toast({ title: `${f.name} ultrapassa 25MB`, variant: "destructive" });
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        kind: kindFromMime(f.type),
      });
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }

  function removePending(id: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        addFiles([file]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast({ title: "Não foi possível acessar o microfone", variant: "destructive" });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  }

  async function uploadAll(): Promise<Attachment[]> {
    const results: Attachment[] = [];
    for (const p of pending) {
      const ext = p.file.name.split(".").pop() || "bin";
      const safeName = p.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const path = `inbox/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, p.file, { contentType: p.file.type || undefined, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      results.push({
        url: data.publicUrl,
        path,
        name: p.file.name,
        type: p.file.type || `application/${ext}`,
        size: p.file.size,
      });
    }
    return results;
  }

  async function handleSubmit() {
    const hasText = text.trim().length > 0;
    if (!hasText && pending.length === 0) {
      toast({ title: "Nada para registrar", description: "Digite algo ou anexe uma mídia." });
      return;
    }
    setSaving(true);
    try {
      const attachments = pending.length ? await uploadAll() : [];

      // Determine primary entry_type
      let entryType: EntryType = "texto";
      const first = attachments[0];
      if (first) {
        if (first.type.startsWith("image/")) entryType = "foto";
        else if (first.type.startsWith("video/")) entryType = "video";
        else if (first.type.startsWith("audio/")) entryType = "audio";
        else entryType = "texto";
      }

      const { error } = await supabase.from("inbox_entries").insert({
        content: hasText ? text.trim() : null,
        entry_type: entryType,
        media_url: first?.url ?? null,
        media_path: first?.path ?? null,
        attachments: attachments as any,
        user_id: activeUser?.id ?? null,
        user_name: activeUser?.name ?? null,
        status: "aguardando_selecao",
      });
      if (error) throw error;

      setText("");
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      toast({ title: "Registrado na Caixa de Entrada" });
      fetchEntries();
      textareaRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: InboxEntry) {
    setEditingId(entry.id);
    setEditingText(entry.content ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("inbox_entries")
        .update({ content: editingText.trim() || null })
        .eq("id", editingId);
      if (error) throw error;
      toast({ title: "Registro atualizado" });
      setEntries((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, content: editingText.trim() || null } : e)),
      );
      cancelEdit();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deletingEntry) return;
    setDeleting(true);
    try {
      const paths: string[] = [];
      if (deletingEntry.media_path) paths.push(deletingEntry.media_path);
      (deletingEntry.attachments ?? []).forEach((a) => {
        if (a.path && !paths.includes(a.path)) paths.push(a.path);
      });
      if (paths.length) {
        await supabase.storage.from("media").remove(paths);
      }
      const { error } = await supabase.from("inbox_entries").delete().eq("id", deletingEntry.id);
      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== deletingEntry.id));
      toast({ title: "Registro excluído" });
      setDeletingEntry(null);
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  function formatDateTime(iso: string) {
    try {
      return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return iso;
    }
  }

  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function renderEntryAttachments(entry: InboxEntry) {
    const list: Attachment[] =
      entry.attachments && entry.attachments.length > 0
        ? entry.attachments
        : entry.media_url
          ? [
              {
                url: entry.media_url,
                path: entry.media_path ?? "",
                name: entry.media_url.split("/").pop() ?? "arquivo",
                type:
                  entry.entry_type === "foto"
                    ? "image/*"
                    : entry.entry_type === "video"
                      ? "video/*"
                      : entry.entry_type === "audio"
                        ? "audio/*"
                        : "application/octet-stream",
                size: 0,
              },
            ]
          : [];

    if (!list.length) return null;

    return (
      <div className="space-y-2">
        {list.map((a, i) => {
          if (a.type.startsWith("image/")) {
            return (
              <img
                key={i}
                src={a.url}
                alt={a.name}
                loading="lazy"
                className="max-h-56 rounded border border-border"
              />
            );
          }
          if (a.type.startsWith("video/")) {
            return (
              <video
                key={i}
                src={a.url}
                controls
                className="max-h-56 rounded border border-border w-full"
              />
            );
          }
          if (a.type.startsWith("audio/")) {
            return <audio key={i} src={a.url} controls className="w-full" />;
          }
          const Icon = iconFor(a.type);
          return (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{a.name}</span>
              {a.size > 0 && (
                <span className="text-xs text-muted-foreground">{fmtSize(a.size)}</span>
              )}
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Inbox className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">
              Captura Central
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Caixa de Entrada universal — registre sem classificar
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {entries.length} pendentes
          </Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        {/* Capture card */}
        <Card className="p-4 sm:p-5 space-y-3 shadow-sm">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite ou registre qualquer ideia, tarefa, problema, reflexão ou informação..."
            className="min-h-[120px] resize-y text-base leading-relaxed border-none focus-visible:ring-0 shadow-none px-0"
          />

          {/* Pending attachments preview */}
          {pending.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pending.map((p) => {
                const Icon = iconFor(p.file.type);
                return (
                  <div
                    key={p.id}
                    className="relative rounded-lg border border-border bg-muted/30 overflow-hidden group"
                  >
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => removePending(p.id)}
                      className="absolute top-1 right-1 h-6 w-6 z-10"
                      aria-label="Remover"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    {p.kind === "foto" && (
                      <img src={p.previewUrl} alt={p.file.name} className="w-full h-32 object-cover" />
                    )}
                    {p.kind === "video" && (
                      <video src={p.previewUrl} className="w-full h-32 object-cover" />
                    )}
                    {p.kind === "audio" && (
                      <div className="p-3 h-32 flex flex-col justify-center gap-1">
                        <FileAudio className="h-6 w-6 text-muted-foreground" />
                        <audio src={p.previewUrl} controls className="w-full" />
                      </div>
                    )}
                    {p.kind === "arquivo" && (
                      <div className="p-3 h-32 flex flex-col items-center justify-center text-center">
                        <Icon className="h-8 w-8 text-muted-foreground mb-1" />
                        <span className="text-xs truncate max-w-full">{p.file.name}</span>
                      </div>
                    )}
                    <div className="px-2 py-1 text-[10px] text-muted-foreground border-t truncate">
                      {p.file.name} · {fmtSize(p.file.size)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recording indicator */}
          {recording && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              Gravando áudio — {formatDuration(recSeconds)}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => textareaRef.current?.focus()}
              className="gap-1.5"
            >
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Texto</span>
            </Button>

            {!recording ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startRecording}
                className="gap-1.5"
              >
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">Áudio</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                className="gap-1.5"
              >
                <Square className="h-4 w-4" />
                Parar
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => photoInputRef.current?.click()}
              className="gap-1.5"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Foto</span>
            </Button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => videoInputRef.current?.click()}
              className="gap-1.5"
            >
              <VideoIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Vídeo</span>
            </Button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Paperclip className="h-4 w-4" />
              <span className="hidden sm:inline">Arquivo</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <div className="ml-auto">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving || recording}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Registrar
              </Button>
            </div>
          </div>
        </Card>

        {/* Pending list */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Aguardando Seleção
            </h2>
            <Badge variant="outline" className="text-xs">
              {entries.length}
            </Badge>
          </div>

          {loadingList ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhum registro pendente. Comece capturando algo acima.
            </Card>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const meta = TYPE_META[entry.entry_type] ?? TYPE_META.texto;
                const isEditing = editingId === entry.id;
                const attachmentCount =
                  (entry.attachments?.length ?? 0) || (entry.media_url ? 1 : 0);
                return (
                  <Card key={entry.id} className="p-3 sm:p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={meta.color}>
                          {meta.label}
                        </Badge>
                        {attachmentCount > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Paperclip className="h-3 w-3" />
                            {attachmentCount}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">
                          {formatDateTime(entry.created_at)}
                        </span>
                        {!isEditing && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => startEdit(entry)}
                              title="Editar texto"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingEntry(entry)}
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 mb-2">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={4}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingEdit}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={saveEdit} disabled={savingEdit} className="gap-1.5">
                            {savingEdit ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      entry.content && (
                        <p className="text-sm whitespace-pre-wrap break-words mb-2">
                          {entry.content}
                        </p>
                      )
                    )}

                    {renderEntryAttachments(entry)}

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      <span>{entry.user_name ?? "Sem usuário"}</span>
                      <span className="italic">Aguardando Seleção</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AlertDialog open={!!deletingEntry} onOpenChange={(o) => !o && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o texto e todos os anexos deste registro da Caixa de Entrada. Não é
              possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
