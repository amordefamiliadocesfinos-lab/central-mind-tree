import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, FileText, Box, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface NodeItem {
  id: string;
  title: string;
  parent_id: string | null;
  is_visible: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  node_id: string;
}

interface SearchResult {
  type: "node" | "task";
  id: string;
  title: string;
  parentTitle?: string;
  nodeId?: string;
}

interface GlobalSearchBarProps {
  onNodeSelect?: (nodeId: string) => void;
}

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(str: string): string[] {
  return normalizeStr(str).split(/\s+/).filter(Boolean);
}

function matchesQuery(queryTokens: string[], ...fields: (string | null)[]): boolean {
  const combined = fields.filter(Boolean).join(" ");
  const normalized = normalizeStr(combined);
  return queryTokens.every((token) => normalized.includes(token));
}

export function GlobalSearchBar({ onNodeSelect }: GlobalSearchBarProps) {
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNodes, setShowNodes] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [nodesRes, tasksRes] = await Promise.all([
        supabase.from("nodes").select("id, title, parent_id, is_visible"),
        supabase.from("tasks").select("id, title, description, node_id"),
      ]);
      if (nodesRes.data) setNodes(nodesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    };
    fetchData();

    const nodesChannel = supabase
      .channel("global-search-nodes")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodes" }, fetchData)
      .subscribe();

    const tasksChannel = supabase
      .channel("global-search-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const nodeTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    nodes.forEach((n) => (map[n.id] = n.title));
    return map;
  }, [nodes]);

  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 2) return [];
    const queryTokens = tokenize(query);
    const out: SearchResult[] = [];

    if (showNodes) {
      nodes.forEach((node) => {
        if (matchesQuery(queryTokens, node.title)) {
          const parentTitle = node.parent_id ? nodeTitleMap[node.parent_id] : undefined;
          out.push({ type: "node", id: node.id, title: node.title, parentTitle });
        }
      });
    }

    if (showTasks) {
      tasks.forEach((task) => {
        if (matchesQuery(queryTokens, task.title, task.description)) {
          out.push({
            type: "task",
            id: task.id,
            title: task.title,
            parentTitle: nodeTitleMap[task.node_id],
            nodeId: task.node_id,
          });
        }
      });
    }

    return out.slice(0, 20);
  }, [query, nodes, tasks, nodeTitleMap, showNodes, showTasks]);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setQuery("");
      setIsOpen(false);

      if (result.type === "node") {
        if (onNodeSelect) {
          onNodeSelect(result.id);
        } else {
          navigate(`/?highlight=${result.id}`);
        }
      } else if (result.type === "task") {
        if (result.nodeId && onNodeSelect) {
          onNodeSelect(result.nodeId);
        } else {
          navigate(`/?highlight=${result.nodeId}`);
        }
      }
    },
    [onNodeSelect, navigate]
  );

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 right-0 z-[9999] bg-background/95 backdrop-blur-sm border-b shadow-sm"
    >
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) setIsOpen(true);
            }}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder='Pesquisar nós e tarefas... (pressione "/")'
            className="pl-10 pr-10"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isOpen && query.length >= 2 && (
          <div className="absolute left-4 right-4 mt-1 bg-popover border rounded-lg shadow-lg max-h-80 overflow-y-auto">
            <div className="flex gap-4 p-2 border-b text-sm">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNodes}
                  onChange={(e) => setShowNodes(e.target.checked)}
                  className="rounded"
                />
                <Box className="h-3 w-3" />
                Nós
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTasks}
                  onChange={(e) => setShowTasks(e.target.checked)}
                  className="rounded"
                />
                <FileText className="h-3 w-3" />
                Tarefas
              </label>
            </div>

            {results.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">Nenhum resultado</div>
            ) : (
              <div className="py-1">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left transition-colors"
                  >
                    {result.type === "node" ? (
                      <Box className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.parentTitle && (
                        <div className="text-xs text-muted-foreground truncate">{result.parentTitle}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
