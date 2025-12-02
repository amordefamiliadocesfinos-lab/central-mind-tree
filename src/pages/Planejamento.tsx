import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Star, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReplanningBanner } from "@/components/ReplanningBanner";

interface Task {
  id: string;
  title: string;
  status: string;
  node_id: string;
  progress: number;
}

interface Node {
  id: string;
  title: string;
  color: string;
}

interface AreaItem {
  name: string;
  note: string;
  status: "ok" | "pendente";
}

interface PlanTemplate {
  areas: string[];
}

interface CurrentPlan {
  weekStartISO: string;
  notesByArea: Record<string, string>;
  statusByArea: Record<string, "ok" | "pendente">;
  selectedTaskIds: string[];
  prioritizedTaskIds: string[];
}

const DEFAULT_AREAS = [
  "Produção semanal",
  "Controle de pedidos",
  "Controle de tarefas",
  "Insumos a comprar",
];

const STATUS_COLORS: Record<string, string> = {
  andamento: "bg-red-500",
  pendente: "bg-yellow-500",
};

const getWeekStartISO = () => {
  return startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
};

const Planejamento = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  // Template (customizable areas)
  const [template, setTemplate] = useState<PlanTemplate>(() => {
    const saved = localStorage.getItem("pc.plan.template");
    return saved ? JSON.parse(saved) : { areas: DEFAULT_AREAS };
  });

  // Current plan state
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan>(() => {
    const saved = localStorage.getItem("pc.plan.current");
    const weekStart = getWeekStartISO();
    if (saved) {
      const parsed = JSON.parse(saved);
      // Reset if it's a new week
      if (parsed.weekStartISO !== weekStart) {
        return {
          weekStartISO: weekStart,
          notesByArea: {},
          statusByArea: {},
          selectedTaskIds: [],
          prioritizedTaskIds: [],
        };
      }
      return parsed;
    }
    return {
      weekStartISO: weekStart,
      notesByArea: {},
      statusByArea: {},
      selectedTaskIds: [],
      prioritizedTaskIds: [],
    };
  });

  const [newAreaName, setNewAreaName] = useState("");

  // Persist template
  useEffect(() => {
    localStorage.setItem("pc.plan.template", JSON.stringify(template));
  }, [template]);

  // Persist current plan
  useEffect(() => {
    localStorage.setItem("pc.plan.current", JSON.stringify(currentPlan));
  }, [currentPlan]);

  // Load tasks and nodes
  useEffect(() => {
    const loadData = async () => {
      const [tasksRes, nodesRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, node_id, progress")
          .in("status", ["andamento", "pendente"]),
        supabase.from("nodes").select("id, title, color"),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (nodesRes.data) setNodes(nodesRes.data);
      setLoading(false);
    };
    loadData();
  }, []);

  // Group tasks by node
  const tasksByNode = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (!grouped[task.node_id]) grouped[task.node_id] = [];
      grouped[task.node_id].push(task);
    });
    return grouped;
  }, [tasks]);

  const nodesMap = useMemo(() => {
    const map: Record<string, Node> = {};
    nodes.forEach((n) => (map[n.id] = n));
    return map;
  }, [nodes]);

  // Week period display
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekPeriod = `${format(weekStart, "dd/MM", { locale: ptBR })} - ${format(weekEnd, "dd/MM", { locale: ptBR })}`;

  // Area handlers
  const addArea = () => {
    if (!newAreaName.trim()) return;
    setTemplate((prev) => ({ areas: [...prev.areas, newAreaName.trim()] }));
    setNewAreaName("");
  };

  const removeArea = (index: number) => {
    setTemplate((prev) => ({
      areas: prev.areas.filter((_, i) => i !== index),
    }));
  };

  const updateAreaNote = (area: string, note: string) => {
    setCurrentPlan((prev) => ({
      ...prev,
      notesByArea: { ...prev.notesByArea, [area]: note },
    }));
  };

  const toggleAreaStatus = (area: string) => {
    setCurrentPlan((prev) => ({
      ...prev,
      statusByArea: {
        ...prev.statusByArea,
        [area]: prev.statusByArea[area] === "ok" ? "pendente" : "ok",
      },
    }));
  };

  // Task selection handlers
  const toggleTaskSelected = (taskId: string) => {
    setCurrentPlan((prev) => {
      const isSelected = prev.selectedTaskIds.includes(taskId);
      return {
        ...prev,
        selectedTaskIds: isSelected
          ? prev.selectedTaskIds.filter((id) => id !== taskId)
          : [...prev.selectedTaskIds, taskId],
      };
    });
  };

  const toggleTaskPrioritized = (taskId: string) => {
    setCurrentPlan((prev) => {
      const isPrioritized = prev.prioritizedTaskIds.includes(taskId);
      let newPrioritized = isPrioritized
        ? prev.prioritizedTaskIds.filter((id) => id !== taskId)
        : [...prev.prioritizedTaskIds, taskId];
      
      // Also add to selected if prioritizing
      let newSelected = prev.selectedTaskIds;
      if (!isPrioritized && !prev.selectedTaskIds.includes(taskId)) {
        newSelected = [...prev.selectedTaskIds, taskId];
      }
      
      return {
        ...prev,
        selectedTaskIds: newSelected,
        prioritizedTaskIds: newPrioritized,
      };
    });
  };

  // Action handlers
  const handleSendToFocus = () => {
    localStorage.setItem(
      "pc.focus.queue",
      JSON.stringify(currentPlan.prioritizedTaskIds)
    );
    if (currentPlan.prioritizedTaskIds.length > 0) {
      localStorage.setItem(
        "pc.focus.currentTaskId",
        currentPlan.prioritizedTaskIds[0]
      );
    }
    toast.success("Fila do Foco atualizada!");
  };

  const handleSavePlan = () => {
    localStorage.setItem("pc.plan.current", JSON.stringify(currentPlan));
    toast.success("Plano salvo!");
  };

  const handleCompletePlanning = () => {
    localStorage.setItem("pc.plan.lastCompletedAt", Date.now().toString());
    toast.success("Planejamento concluído!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Planejamento Semanal</h1>
            <Badge variant="outline">{weekPeriod}</Badge>
          </div>
          <Link to="/foco">
            <Button variant="outline">Ir para Foco</Button>
          </Link>
        </div>

        {/* Block 1: Checklist de Áreas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checklist de Áreas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {template.areas.map((area, index) => (
              <div
                key={area}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <Checkbox
                  checked={currentPlan.statusByArea[area] === "ok"}
                  onCheckedChange={() => toggleAreaStatus(area)}
                />
                <span className="font-medium flex-shrink-0 w-40">{area}</span>
                <Input
                  placeholder="Observações..."
                  value={currentPlan.notesByArea[area] || ""}
                  onChange={(e) => updateAreaNote(area, e.target.value)}
                  className="flex-1"
                />
                <Badge
                  variant={
                    currentPlan.statusByArea[area] === "ok"
                      ? "default"
                      : "secondary"
                  }
                >
                  {currentPlan.statusByArea[area] === "ok" ? "OK" : "Pendente"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArea(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Nova área..."
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addArea()}
              />
              <Button onClick={addArea} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Block 2: Seleção de Tarefas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seleção de Tarefas para a Semana</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(tasksByNode).map(([nodeId, nodeTasks]) => {
              const node = nodesMap[nodeId];
              if (!node) return null;
              return (
                <div key={nodeId} className="space-y-2">
                  <h3
                    className="font-semibold px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: node.color + "33" }}
                  >
                    {node.title}
                  </h3>
                  <div className="space-y-1 pl-2">
                    {nodeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${STATUS_COLORS[task.status]}`}
                        />
                        <span className="flex-1 text-sm">{task.title}</span>
                        <Button
                          variant={
                            currentPlan.selectedTaskIds.includes(task.id)
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => toggleTaskSelected(task.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Plano
                        </Button>
                        <Button
                          variant={
                            currentPlan.prioritizedTaskIds.includes(task.id)
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => toggleTaskPrioritized(task.id)}
                          className={
                            currentPlan.prioritizedTaskIds.includes(task.id)
                              ? "bg-amber-500 hover:bg-amber-600"
                              : ""
                          }
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Priorizar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.keys(tasksByNode).length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma tarefa em andamento ou pendente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Block 3: Plano da Semana */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Plano da Semana ({weekPeriod})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground mb-1">Tarefas no Plano</p>
                <p className="text-2xl font-bold">
                  {currentPlan.selectedTaskIds.length}
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground mb-1">Priorizadas (Foco)</p>
                <p className="text-2xl font-bold text-amber-500">
                  {currentPlan.prioritizedTaskIds.length}
                </p>
              </div>
            </div>

            {currentPlan.prioritizedTaskIds.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Fila de prioridades:
                </p>
                {currentPlan.prioritizedTaskIds.map((id, i) => {
                  const task = tasks.find((t) => t.id === id);
                  return task ? (
                    <div
                      key={id}
                      className="flex items-center gap-2 text-sm p-2 rounded bg-amber-500/10"
                    >
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span>{task.title}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSendToFocus} className="flex-1">
                <Star className="h-4 w-4 mr-2" />
                Enviar ao Foco
              </Button>
              <Button onClick={handleSavePlan} variant="outline" className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Salvar Plano
              </Button>
              <Button
                onClick={handleCompletePlanning}
                variant="secondary"
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Concluir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <ReplanningBanner />
    </div>
  );
};

export default Planejamento;
