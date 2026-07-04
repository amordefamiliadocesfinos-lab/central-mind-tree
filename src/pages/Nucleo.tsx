import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Compass,
  Target,
  BookOpen,
  Landmark,
  Shield,
  Sparkles,
  FileText,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface Section {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  placeholder: string;
}

const SECTIONS: Section[] = [
  {
    id: "missao",
    title: "Missão",
    description: "Propósito central do Painel Central.",
    icon: Compass,
    placeholder: "Qual é a razão de existir do Painel Central?",
  },
  {
    id: "visao",
    title: "Visão",
    description: "Onde queremos chegar.",
    icon: Target,
    placeholder: "Aonde o Painel Central deve chegar nos próximos anos?",
  },
  {
    id: "valores",
    title: "Valores",
    description: "Princípios inegociáveis de operação.",
    icon: Shield,
    placeholder: "Quais valores guiam as decisões diárias?",
  },
  {
    id: "estrategia",
    title: "Estratégia",
    description: "Pilares e frentes estratégicas.",
    icon: Sparkles,
    placeholder: "Quais são os pilares estratégicos ativos?",
  },
  {
    id: "governanca",
    title: "Governança",
    description: "Regras, papéis e rituais de decisão.",
    icon: Landmark,
    placeholder: "Como as decisões são tomadas e revisadas?",
  },
  {
    id: "documentacao",
    title: "Documentação Base",
    description: "Documentos-chave e referências oficiais.",
    icon: BookOpen,
    placeholder: "Links, políticas e documentos de referência.",
  },
];

const STORAGE_KEY = "nucleo_painel_central_v1";

function loadData(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function Nucleo() {
  const [data, setData] = useState<Record<string, string>>(loadData);
  const [title, setTitle] = useState<string>(
    () => loadData()._title || "Núcleo do Painel Central"
  );

  const save = () => {
    const payload = { ...data, _title: title };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    toast.success("Núcleo salvo");
  };

  const update = (id: string, value: string) => {
    setData((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
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
          <Button size="sm" onClick={save} className="gap-1.5">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Intro */}
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-semibold">Sobre esta área</h2>
              <p className="text-sm text-muted-foreground">
                O Núcleo é o espaço reservado para consolidar a essência do
                Painel Central: missão, visão, estratégia e governança. As
                informações aqui são preservadas localmente e servirão de base
                para integrações futuras com os demais módulos.
              </p>
            </div>
          </div>
        </Card>

        {/* Identity */}
        <Card className="p-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Identidade
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do Núcleo"
            className="text-base font-semibold"
          />
        </Card>

        {/* Sections grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const value = data[section.id] || "";
            return (
              <Card key={section.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  {value.trim() && (
                    <Badge variant="outline" className="text-[10px]">
                      preenchido
                    </Badge>
                  )}
                </div>
                <Textarea
                  value={value}
                  onChange={(e) => update(section.id, e.target.value)}
                  placeholder={section.placeholder}
                  rows={5}
                  className="resize-none text-sm"
                />
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Área independente — nenhuma integração ativa com os demais módulos.
        </p>
      </main>
    </div>
  );
}
