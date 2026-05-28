import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  X,
  Plus,
  Rows,
  Columns,
  LayoutGrid,
} from "lucide-react";

interface ModuleDef {
  id: string;
  label: string;
  path: string;
}

const MODULES: ModuleDef[] = [
  { id: "arvore", label: "Árvore", path: "/" },
  { id: "foco", label: "Foco", path: "/foco" },
  { id: "planejamento", label: "Planejamento", path: "/planejamento" },
  { id: "calendario", label: "Calendário", path: "/calendario" },
  { id: "rotina", label: "Rotina", path: "/rotina" },
  { id: "operacoes", label: "Operações", path: "/operacoes" },
  { id: "digital", label: "Digital", path: "/digital" },
  { id: "reunioes", label: "Reuniões", path: "/reunioes" },
  { id: "financeiro", label: "Financeiro", path: "/financeiro" },
  { id: "contatos", label: "CRM / Contatos", path: "/contatos" },
  { id: "atendimento", label: "Atendimento", path: "/contatos/inbox" },
  { id: "rotas", label: "Rotas", path: "/rotas" },
  { id: "minha-area", label: "Minha Área", path: "/minha-area" },
  { id: "dashboard", label: "Dashboard", path: "/dashboard" },
  { id: "planilhas", label: "Planilhas", path: "/planilhas" },
  { id: "assistente", label: "Assistente", path: "/assistente" },
];

interface MultiViewProps {
  onClose: () => void;
}

interface PaneInstance {
  uid: string;
  moduleId: string;
}

let paneCounter = 0;
const newUid = () => `pane-${++paneCounter}-${Date.now()}`;

export function MultiView({ onClose }: MultiViewProps) {
  const [panes, setPanes] = useState<PaneInstance[]>([
    { uid: newUid(), moduleId: "digital" },
    { uid: newUid(), moduleId: "contatos" },
  ]);
  const [direction, setDirection] = useState<"horizontal" | "vertical">("horizontal");

  const addPane = (moduleId: string) => {
    setPanes((prev) => [...prev, { uid: newUid(), moduleId }]);
  };

  const removePane = (uid: string) => {
    setPanes((prev) => prev.filter((p) => p.uid !== uid));
  };

  const changeModule = (uid: string, moduleId: string) => {
    setPanes((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, moduleId } : p))
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
          <h2 className="text-sm font-semibold truncate">MULTI — Múltiplas telas</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {panes.length} painel(éis)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setDirection((d) => (d === "horizontal" ? "vertical" : "horizontal"))
            }
            title={direction === "horizontal" ? "Dividir em linhas" : "Dividir em colunas"}
          >
            {direction === "horizontal" ? (
              <Rows className="h-4 w-4" />
            ) : (
              <Columns className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="default" size="sm" className="h-8 gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar tela</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto z-[70]">
              <DropdownMenuLabel>Escolha um módulo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MODULES.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => addPane(m.id)}>
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Panels */}
      <div className="flex-1 min-h-0">
        {panes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Adicione uma tela para começar.
          </div>
        ) : (
          <ResizablePanelGroup
            key={`${direction}-${panes.length}`}
            direction={direction}
            className="h-full w-full"
          >
            {panes.map((pane, idx) => {
              const mod = MODULES.find((m) => m.id === pane.moduleId) ?? MODULES[0];
              return (
                <>
                  <ResizablePanel
                    key={pane.uid}
                    defaultSize={100 / panes.length}
                    minSize={15}
                  >
                    <div className="flex h-full flex-col border bg-background">
                      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs font-medium"
                            >
                              {mod.label}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto z-[70]">
                            <DropdownMenuLabel>Trocar módulo</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {MODULES.map((m) => (
                              <DropdownMenuItem
                                key={m.id}
                                onClick={() => changeModule(pane.uid, m.id)}
                              >
                                {m.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removePane(pane.uid)}
                          title="Remover tela"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <iframe
                        src={`${mod.path}?multi=1`}
                        title={mod.label}
                        className="flex-1 w-full border-0 bg-background"
                      />
                    </div>
                  </ResizablePanel>
                  {idx < panes.length - 1 && <ResizableHandle withHandle />}
                </>
              );
            })}
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
