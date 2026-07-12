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
  Inbox,
  Mic,
  Square,
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  Loader2,
  X,
  Type,
} from "lucide-react";

type EntryType = "texto" | "audio" | "foto" | "video";

interface InboxEntry {
  id: string;
  content: string | null;
  entry_type: EntryType;
  media_url: string | null;
  user_name: string | null;
  created_at: string;
  status: string;
}

const TYPE_META: Record<EntryType, { label: string; color: string }> = {
  texto: { label: "Texto", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  audio: { label: "Áudio", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  foto: { label: "Foto", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  video: { label: "Vídeo", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

export default function CapturaCentral() {
  const { activeUser } = useActiveUser();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<EntryType | null>(null);
  const [saving, setSaving] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);

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

  async function fetchEntries() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("inbox_entries")
      .select("id, content, entry_type, media_url, user_name, created_at, status")
      .eq("status", "aguardando_selecao")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setEntries(data as InboxEntry[]);
    setLoadingList(false);
  }

  function clearMedia() {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setMediaType(null);
  }

  function handleFilePicked(file: File, type: EntryType) {
    clearMedia();
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
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
        handleFilePicked(file, "audio");
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

  async function uploadMedia(): Promise<{ url: string; path: string } | null> {
    if (!mediaFile) return null;
    const ext = mediaFile.name.split(".").pop() || "bin";
    const path = `inbox/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("media")
      .upload(path, mediaFile, { contentType: mediaFile.type || undefined, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  async function handleSubmit() {
    const hasText = text.trim().length > 0;
    if (!hasText && !mediaFile) {
      toast({ title: "Nada para registrar", description: "Digite algo ou anexe uma mídia." });
      return;
    }
    setSaving(true);
    try {
      let media: { url: string; path: string } | null = null;
      if (mediaFile) media = await uploadMedia();

      const entryType: EntryType = mediaType ?? "texto";

      const { error } = await supabase.from("inbox_entries").insert({
        content: hasText ? text.trim() : null,
        entry_type: entryType,
        media_url: media?.url ?? null,
        media_path: media?.path ?? null,
        user_id: activeUser?.id ?? null,
        user_name: activeUser?.name ?? null,
        status: "aguardando_selecao",
      });
      if (error) throw error;

      setText("");
      clearMedia();
      toast({ title: "Registrado na Caixa de Entrada" });
      fetchEntries();
      textareaRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
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

          {/* Media preview */}
          {mediaPreview && mediaType && (
            <div className="relative rounded-lg border border-border bg-muted/30 p-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={clearMedia}
                className="absolute top-2 right-2 h-7 w-7 z-10"
                aria-label="Remover mídia"
              >
                <X className="h-4 w-4" />
              </Button>
              {mediaType === "foto" && (
                <img src={mediaPreview} alt="Prévia" className="max-h-64 mx-auto rounded" />
              )}
              {mediaType === "video" && (
                <video src={mediaPreview} controls className="max-h-64 mx-auto rounded w-full" />
              )}
              {mediaType === "audio" && (
                <audio src={mediaPreview} controls className="w-full" />
              )}
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
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFilePicked(f, "foto");
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
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFilePicked(f, "video");
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
                return (
                  <Card key={entry.id} className="p-3 sm:p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="outline" className={meta.color}>
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>

                    {entry.content && (
                      <p className="text-sm whitespace-pre-wrap break-words mb-2">
                        {entry.content}
                      </p>
                    )}

                    {entry.media_url && entry.entry_type === "foto" && (
                      <img
                        src={entry.media_url}
                        alt="Anexo"
                        loading="lazy"
                        className="max-h-56 rounded border border-border"
                      />
                    )}
                    {entry.media_url && entry.entry_type === "video" && (
                      <video
                        src={entry.media_url}
                        controls
                        className="max-h-56 rounded border border-border w-full"
                      />
                    )}
                    {entry.media_url && entry.entry_type === "audio" && (
                      <audio src={entry.media_url} controls className="w-full" />
                    )}

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
    </div>
  );
}
