import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  GraduationCap,
  Plus,
  Target,
  Route as RouteIcon,
  TrendingUp,
  LayoutDashboard,
  Trash2,
  Pencil,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

type Level = "Iniciante" | "Intermediário" | "Avançado";

interface Step {
  id: string;
  title: string;
  done: boolean;
}

interface Learning {
  id: string;
  theme: string;
  goal: string;
  level: Level;
  notes?: string;
  steps: Step[];
  createdAt: string;
}

const STORAGE_KEY = "pc.academia.learnings";

const loadLearnings = (): Learning[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Learning[]) : [];
  } catch {
    return [];
  }
};

const saveLearnings = (items: Learning[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const newId = () => `lrn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const LEVEL_COLOR: Record<Level, string> = {
  Iniciante: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  Intermediário: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  Avançado: "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

const progressOf = (l: Learning) => {
  if (!l.steps.length) return 0;
  const done = l.steps.filter((s) => s.done).length;
  return Math.round((done / l.steps.length) * 100);
};

export default function Academia() {
  const [items, setItems] = useState<Learning[]>([]);
  const [tab, setTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Learning | null>(null);
  const [form, setForm] = useState({
    theme: "",
    goal: "",
    level: "Iniciante" as Level,
    notes: "",
  });
  const [newStepInputs, setNewStepInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(loadLearnings());
  }, []);

  const persist = (next: Learning[]) => {
    setItems(next);
    saveLearnings(next);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ theme: "", goal: "", level: "Iniciante", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (l: Learning) => {
    setEditing(l);
    setForm({ theme: l.theme, goal: l.goal, level: l.level, notes: l.notes ?? "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.theme.trim()) {
      toast.error("Informe o nome do tema");
      return;
    }
    if (!form.goal.trim()) {
      toast.error("Informe o objetivo final");
      return;
    }
    if (editing) {
      persist(
        items.map((it) =>
          it.id === editing.id
            ? { ...it, theme: form.theme, goal: form.goal, level: form.level, notes: form.notes }
            : it,
        ),
      );
      toast.success("Aprendizado atualizado");
    } else {
      const created: Learning = {
        id: newId(),
        theme: form.theme.trim(),
        goal: form.goal.trim(),
        level: form.level,
        notes: form.notes.trim() || undefined,
        steps: [],
        createdAt: new Date().toISOString(),
      };
      persist([created, ...items]);
      toast.success("Aprendizado criado");
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Excluir este aprendizado?")) return;
    persist(items.filter((it) => it.id !== id));
  };

  const addStep = (id: string) => {
    const title = (newStepInputs[id] ?? "").trim();
    if (!title) return;
    persist(
      items.map((it) =>
        it.id === id
          ? { ...it, steps: [...it.steps, { id: newId(), title, done: false }] }
          : it,
      ),
    );
    setNewStepInputs((p) => ({ ...p, [id]: "" }));
  };

  const toggleStep = (lid: string, sid: string) => {
    persist(
      items.map((it) =>
        it.id === lid
          ? {
              ...it,
              steps: it.steps.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)),
            }
          : it,
      ),
    );
  };

  const removeStep = (lid: string, sid: string) => {
    persist(
      items.map((it) =>
        it.id === lid ? { ...it, steps: it.steps.filter((s) => s.id !== sid) } : it,
      ),
    );
  };

  // KPIs
  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => progressOf(i) === 100).length;
    const inProgress = items.filter((i) => {
      const p = progressOf(i);
      return p > 0 && p < 100;
    }).length;
    const notStarted = items.filter((i) => progressOf(i) === 0).length;
    const avg = total
      ? Math.round(items.reduce((acc, i) => acc + progressOf(i), 0) / total)
      : 0;
    return { total, completed, inProgress, notStarted, avg };
  }, [items]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">
                  Academia
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Aprendizado, cursos e desenvolvimento de competências
                </p>
              </div>
            </div>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo aprendizado</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      <div className="px-3 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="objetivos" className="gap-1.5">
              <Target className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Objetivos</span>
            </TabsTrigger>
            <TabsTrigger value="trilhas" className="gap-1.5">
              <RouteIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Trilhas</span>
            </TabsTrigger>
            <TabsTrigger value="progresso" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Progresso</span>
            </TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Aprendizados</p>
                  <p className="text-2xl font-bold mt-1">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">
                    {stats.completed}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Em progresso</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">
                    {stats.inProgress}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Progresso médio</p>
                  <p className="text-2xl font-bold mt-1">{stats.avg}%</p>
                  <Progress value={stats.avg} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Aprendizados recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <EmptyState onCreate={openCreate} />
                ) : (
                  <div className="space-y-2">
                    {items.slice(0, 5).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card/50 hover:bg-muted/40 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{l.theme}</p>
                            <Badge variant="outline" className={LEVEL_COLOR[l.level]}>
                              {l.level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {l.goal}
                          </p>
                        </div>
                        <div className="w-24 shrink-0">
                          <Progress value={progressOf(l)} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground text-right mt-1">
                            {progressOf(l)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OBJETIVOS */}
          <TabsContent value="objetivos" className="space-y-3">
            {items.length === 0 ? (
              <EmptyState onCreate={openCreate} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((l) => (
                  <Card key={l.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{l.theme}</CardTitle>
                          <Badge
                            variant="outline"
                            className={`mt-1.5 ${LEVEL_COLOR[l.level]}`}
                          >
                            {l.level}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(l)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(l.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                          Objetivo
                        </p>
                        <p className="text-sm">{l.goal}</p>
                      </div>
                      {l.notes && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                            Notas
                          </p>
                          <p className="text-sm text-muted-foreground">{l.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TRILHAS */}
          <TabsContent value="trilhas" className="space-y-3">
            {items.length === 0 ? (
              <EmptyState onCreate={openCreate} />
            ) : (
              items.map((l) => (
                <Card key={l.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <RouteIcon className="h-4 w-4 text-primary shrink-0" />
                        <CardTitle className="text-base truncate">{l.theme}</CardTitle>
                        <Badge variant="outline" className={LEVEL_COLOR[l.level]}>
                          {l.level}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {l.steps.filter((s) => s.done).length}/{l.steps.length} etapas
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {l.steps.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        Nenhuma etapa adicionada ainda.
                      </p>
                    )}
                    {l.steps.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 group p-2 rounded hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={s.done}
                          onChange={() => toggleStep(l.id, s.id)}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        />
                        <span
                          className={`text-sm flex-1 ${
                            s.done ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {s.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => removeStep(l.id, s.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Input
                        placeholder="Nova etapa da trilha..."
                        value={newStepInputs[l.id] ?? ""}
                        onChange={(e) =>
                          setNewStepInputs((p) => ({ ...p, [l.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addStep(l.id);
                        }}
                        className="h-9"
                      />
                      <Button size="sm" onClick={() => addStep(l.id)} className="gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* PROGRESSO */}
          <TabsContent value="progresso" className="space-y-3">
            {items.length === 0 ? (
              <EmptyState onCreate={openCreate} />
            ) : (
              <div className="space-y-2">
                {items
                  .slice()
                  .sort((a, b) => progressOf(b) - progressOf(a))
                  .map((l) => {
                    const p = progressOf(l);
                    return (
                      <Card key={l.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-medium text-sm truncate">{l.theme}</p>
                              <Badge variant="outline" className={LEVEL_COLOR[l.level]}>
                                {l.level}
                              </Badge>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">
                              {p}%
                            </span>
                          </div>
                          <Progress value={p} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-2">
                            {l.steps.filter((s) => s.done).length} de {l.steps.length}{" "}
                            etapas concluídas
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar aprendizado" : "Novo aprendizado"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="theme">Nome do tema *</Label>
              <Input
                id="theme"
                placeholder="Ex: Marketing Digital"
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal">Objetivo final *</Label>
              <Textarea
                id="goal"
                placeholder="Ex: Aprender a captar clientes pela internet"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Nível atual</Label>
              <RadioGroup
                value={form.level}
                onValueChange={(v) => setForm({ ...form, level: v as Level })}
                className="grid grid-cols-3 gap-2"
              >
                {(["Iniciante", "Intermediário", "Avançado"] as Level[]).map((lvl) => (
                  <label
                    key={lvl}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm transition ${
                      form.level === lvl
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-muted/40"
                    }`}
                  >
                    <RadioGroupItem value={lvl} />
                    <span>{lvl}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Recursos, links, observações..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-10">
      <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">
        Nenhum aprendizado cadastrado ainda.
      </p>
      <Button onClick={onCreate} className="mt-3 gap-1.5" size="sm">
        <Plus className="h-4 w-4" />
        Criar primeiro aprendizado
      </Button>
    </div>
  );
}
