import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Brain,
  BookOpen,
  Eye,
  Building2,
  TrendingUp,
  Plus,
  Trash2,
  FileText,
  Save,
  Search,
  ChevronRight,
  History,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------

type AreaId = "biblioteca" | "consciencia" | "arquitetura" | "evolucao";

interface AreaMeta {
  id: AreaId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface PageVersion {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  label?: string;
}

interface DocPage {
  id: string;
  areaId: AreaId;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  versions: PageVersion[];
}

// ---------- Config ----------

const AREAS: AreaMeta[] = [
  {
    id: "biblioteca",
    title: "Biblioteca do Projeto",
    description: "Documentos, referências e materiais de apoio.",
    icon: BookOpen,
    color: "#3B82F6",
  },
  {
    id: "consciencia",
    title: "Consciência",
    description: "Propósito, missão, visão e princípios do projeto.",
    icon: Eye,
    color: "#8B5CF6",
  },
  {
    id: "arquitetura",
    title: "Arquitetura",
    description: "Estrutura, módulos, fluxos e decisões técnicas.",
    icon: Building2,
    color: "#F59E0B",
  },
  {
    id: "evolucao",
    title: "Evolução do Projeto",
    description: "Marcos, aprendizados e histórico de mudanças.",
    icon: TrendingUp,
    color: "#10B981",
  },
];

const STORAGE_KEY = "nucleo_painel_central_pages_v3";
const SEED_FLAG_KEY = "nucleo_biblioteca_seed_v1";

const BIBLIOTECA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Carta Zero — A Teoria do Painel Central",
    tags: ["carta", "teoria", "fundamento"],
    content:
      "Carta Zero — A Teoria do Painel Central\n\n" +
      "Documento fundacional que apresenta a teoria por trás do Painel Central: a razão de existir, o problema que resolve e a visão que sustenta todo o sistema.\n\n" +
      "— Escreva aqui a teoria completa.",
  },
  {
    title: "Carta I — Manifesto",
    tags: ["carta", "manifesto"],
    content:
      "Carta I — Manifesto\n\n" +
      "Declaração pública dos princípios, crenças e compromissos que guiam o Painel Central.\n\n" +
      "— Escreva aqui o manifesto.",
  },
  {
    title: "Carta II — Constituição",
    tags: ["carta", "constituição", "regras"],
    content:
      "Carta II — Constituição\n\n" +
      "Conjunto de regras, direitos e deveres que estruturam o funcionamento do Painel Central.\n\n" +
      "— Escreva aqui a constituição.",
  },
  {
    title: "Carta III — Consciência",
    tags: ["carta", "consciência"],
    content:
      "Carta III — Consciência\n\n" +
      "Reflexão sobre a consciência do sistema: propósito, autopercepção e responsabilidade.\n\n" +
      "— Escreva aqui a carta da consciência.",
  },
  {
    title: "Carta IV — Filosofia da Experiência",
    tags: ["carta", "filosofia", "experiência"],
    content:
      "Carta IV — Filosofia da Experiência\n\n" +
      "Como o Painel Central entende, projeta e entrega experiência ao usuário.\n\n" +
      "— Escreva aqui a filosofia da experiência.",
  },
  {
    title: "Carta V — Arquitetura da Inteligência",
    tags: ["carta", "arquitetura", "inteligência"],
    content:
      "Carta V — Arquitetura da Inteligência\n\n" +
      "Como a inteligência do sistema é estruturada: dados, decisões, automações e IA.\n\n" +
      "— Escreva aqui a arquitetura da inteligência.",
  },
];

// ---------- Persistence ----------

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPages(): DocPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let pages: DocPage[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        pages = parsed.map((p) => ({
          ...p,
          versions: Array.isArray(p.versions) ? p.versions : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
        }));
      }
    }
    // Seed biblioteca once
    if (!localStorage.getItem(SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "biblioteca").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = BIBLIOTECA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "biblioteca",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(SEED_FLAG_KEY, "1");
    }
    return pages;
  } catch {
    return [];
  }
}

function savePages(pages: DocPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ---------- Component ----------

export default function Nucleo() {
  const [pages, setPages] = useState<DocPage[]>(loadPages);
  const [activeArea, setActiveArea] = useState<AreaId>("biblioteca");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    savePages(pages);
  }, [pages]);

  const activeAreaMeta = AREAS.find((a) => a.id === activeArea)!;

  const areaPages = useMemo(
    () =>
      pages
        .filter((p) => p.areaId === activeArea)
        .filter((p) =>
          search.trim()
            ? (p.title + " " + p.content + " " + p.tags.join(" "))
                .toLowerCase()
                .includes(search.toLowerCase())
            : true
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [pages, activeArea, search]
  );

  const activePage = pages.find((p) => p.id === activePageId) || null;

  const countByArea = useMemo(() => {
    const m = new Map<AreaId, number>();
    pages.forEach((p) => m.set(p.areaId, (m.get(p.areaId) || 0) + 1));
    return m;
  }, [pages]);

  const createPage = () => {
    const now = new Date().toISOString();
    const page: DocPage = {
      id: uid(),
      areaId: activeArea,
      title: "Nova página",
      content: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    setPages((prev) => [page, ...prev]);
    setActivePageId(page.id);
    toast.success("Página criada");
  };

  const updatePage = (id: string, patch: Partial<DocPage>) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const deletePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (activePageId === id) setActivePageId(null);
    toast.success("Página excluída");
  };

  const saveVersion = (id: string, label?: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const version: PageVersion = {
          id: uid(),
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          label,
        };
        return { ...p, versions: [version, ...p.versions] };
      })
    );
    toast.success("Versão salva");
  };

  const restoreVersion = (id: string, versionId: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const v = p.versions.find((x) => x.id === versionId);
        if (!v) return p;
        // Snapshot current before restoring
        const snapshot: PageVersion = {
          id: uid(),
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          label: "auto — antes de restaurar",
        };
        return {
          ...p,
          title: v.title,
          content: v.content,
          updatedAt: new Date().toISOString(),
          versions: [snapshot, ...p.versions],
        };
      })
    );
    toast.success("Versão restaurada");
  };

  const deleteVersion = (id: string, versionId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, versions: p.versions.filter((v) => v.id !== versionId) }
          : p
      )
    );
  };

  const selectArea = (id: AreaId) => {
    setActiveArea(id);
    setActivePageId(null);
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header
        className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">
                Núcleo do Painel Central
              </h1>
              <Badge variant="secondary" className="text-[10px]">
                Área administrativa
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Base estratégica e documental do sistema
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Areas grid */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {AREAS.map((a) => {
            const Icon = a.icon;
            const isActive = a.id === activeArea;
            const count = countByArea.get(a.id) || 0;
            return (
              <button
                key={a.id}
                onClick={() => selectArea(a.id)}
                className={cn(
                  "text-left rounded-xl border p-3 transition-all bg-card hover:border-primary/40 hover:shadow-sm",
                  isActive
                    ? "border-primary/60 shadow-sm ring-1 ring-primary/20"
                    : "border-border"
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: a.color + "1F",
                      color: a.color,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold truncate">
                        {a.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                      {a.description}
                    </p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {count} {count === 1 ? "página" : "páginas"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Workspace */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Pages list */}
          <Card className="p-3 flex flex-col min-h-[420px]">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: activeAreaMeta.color + "1F",
                  color: activeAreaMeta.color,
                }}
              >
                <activeAreaMeta.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold truncate">
                  {activeAreaMeta.title}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {areaPages.length} {areaPages.length === 1 ? "página" : "páginas"}
                </p>
              </div>
              <Button size="sm" onClick={createPage} className="gap-1">
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>

            <ScrollArea className="flex-1 -mx-1">
              <div className="px-1 space-y-1">
                {areaPages.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Nenhuma página ainda</p>
                    <p className="text-[11px] opacity-70">
                      Clique em "Nova" para começar
                    </p>
                  </div>
                )}
                {areaPages.map((p) => {
                  const isActive = p.id === activePageId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePageId(p.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition-colors group",
                        isActive
                          ? "border-primary/50 bg-accent"
                          : "border-transparent hover:bg-accent/60"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {p.title || "Sem título"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDate(p.updatedAt)}
                            {p.versions.length > 0 &&
                              ` · v${p.versions.length}`}
                            {p.tags.length > 0 &&
                              ` · ${p.tags.slice(0, 2).join(", ")}`}
                          </p>
                        </div>
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-opacity",
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                          )}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Editor */}
          <Card className="p-4 min-h-[420px]">
            {!activePage ? (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: activeAreaMeta.color + "1F",
                    color: activeAreaMeta.color,
                  }}
                >
                  <activeAreaMeta.icon className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold">
                  {activeAreaMeta.title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  {activeAreaMeta.description}
                </p>
                <Button
                  className="mt-4 gap-1.5"
                  onClick={createPage}
                >
                  <Plus className="h-4 w-4" />
                  Criar primeira página
                </Button>
              </div>
            ) : (
              <PageEditor
                key={activePage.id}
                page={activePage}
                onChange={(patch) => updatePage(activePage.id, patch)}
                onDelete={() => deletePage(activePage.id)}
                onSaveVersion={(label) => saveVersion(activePage.id, label)}
                onRestoreVersion={(vid) => restoreVersion(activePage.id, vid)}
                onDeleteVersion={(vid) => deleteVersion(activePage.id, vid)}
                areaColor={activeAreaMeta.color}
              />
            )}
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Estrutura preparada para crescimento — sem integrações ativas com
          outros módulos.
        </p>
      </main>
    </div>
  );
}

// ---------- Page Editor ----------

interface PageEditorProps {
  page: DocPage;
  onChange: (patch: Partial<DocPage>) => void;
  onDelete: () => void;
  onSaveVersion: (label?: string) => void;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  areaColor: string;
}

function PageEditor({
  page,
  onChange,
  onDelete,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  areaColor,
}: PageEditorProps) {
  const [tagInput, setTagInput] = useState("");
  const [versionLabel, setVersionLabel] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (page.tags.includes(t)) {
      setTagInput("");
      return;
    }
    onChange({ tags: [...page.tags, t] });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    onChange({ tags: page.tags.filter((x) => x !== t) });
  };

  const handleSaveVersion = () => {
    onSaveVersion(versionLabel.trim() || undefined);
    setVersionLabel("");
  };

  return (
    <div className="flex flex-col h-full min-h-[380px]">
      <div className="flex items-center gap-2 mb-3">
        <Input
          value={page.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título da página"
          className="text-base font-semibold border-0 shadow-none px-0 h-auto py-1 focus-visible:ring-0"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 shrink-0">
              <History className="h-4 w-4" />
              <span className="text-xs">
                {page.versions.length > 0
                  ? `${page.versions.length} versões`
                  : "Versões"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Salvar versão</p>
                <p className="text-[11px] text-muted-foreground">
                  Cria um snapshot do conteúdo atual.
                </p>
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="Rótulo (opcional)"
                  className="h-8 text-xs"
                />
                <Button size="sm" onClick={handleSaveVersion} className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </Button>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1.5">Histórico</p>
                {page.versions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-3 text-center">
                    Nenhuma versão salva ainda.
                  </p>
                ) : (
                  <ScrollArea className="max-h-64 -mx-1">
                    <div className="px-1 space-y-1">
                      {page.versions.map((v, idx) => (
                        <div
                          key={v.id}
                          className="rounded border border-border p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                v{page.versions.length - idx}
                                {v.label ? ` — ${v.label}` : ""}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(v.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Restaurar"
                                onClick={() => onRestoreVersion(v.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                title="Excluir versão"
                                onClick={() => onDeleteVersion(v.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                            {v.content.slice(0, 120) || "(vazio)"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
        <span>Criada em {formatDate(page.createdAt)}</span>
        <span>·</span>
        <span>Atualizada em {formatDate(page.updatedAt)}</span>
        {page.versions.length > 0 && (
          <>
            <span>·</span>
            <span>{page.versions.length} versões</span>
          </>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {page.tags.map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className="text-[10px] gap-1 cursor-pointer"
            onClick={() => removeTag(t)}
          >
            {t}
            <span className="opacity-60">×</span>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="+ tag"
            className="h-6 w-24 text-[11px] px-2"
          />
        </div>
      </div>

      <div
        className="h-0.5 w-12 rounded-full mb-3"
        style={{ backgroundColor: areaColor }}
      />

      <Textarea
        value={page.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Escreva o conteúdo desta página..."
        className="flex-1 min-h-[280px] resize-none text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
        <span>{page.content.length} caracteres</span>
        <span className="flex items-center gap-1">
          <Save className="h-3 w-3" />
          Salvamento automático
        </span>
      </div>
    </div>
  );
}
