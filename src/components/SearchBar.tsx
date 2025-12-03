import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Box, CheckSquare, X } from "lucide-react";

interface NodeItem {
  id: string;
  title: string;
  parent_id: string | null;
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

interface SearchBarProps {
  onResultClick: (result: SearchResult) => void;
}

// Normalize string: lowercase and remove accents
const normalizeStr = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Tokenize string by spaces
const tokenize = (str: string): string[] => {
  return normalizeStr(str).split(/\s+/).filter(Boolean);
};

// Check if all query tokens match any field
const matchesQuery = (queryTokens: string[], ...fields: (string | null)[]): boolean => {
  const normalizedFields = fields
    .filter((f): f is string => f !== null)
    .map(normalizeStr);
  
  return queryTokens.every((token) =>
    normalizedFields.some((field) => field.includes(token))
  );
};

export function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showNodes, setShowNodes] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all data once for in-memory search
  useEffect(() => {
    const fetchData = async () => {
      const [nodesRes, tasksRes] = await Promise.all([
        supabase.from("nodes").select("id, title, parent_id").eq("is_visible", true),
        supabase.from("tasks").select("id, title, description, node_id"),
      ]);

      if (nodesRes.data) setNodes(nodesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    };

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("search-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodes" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as HTMLElement)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Create node title lookup for tasks
  const nodeTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node) => map.set(node.id, node.title));
    return map;
  }, [nodes]);

  // Filter results based on query
  const results = useMemo((): SearchResult[] => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return [];

    const queryTokens = tokenize(trimmedQuery);
    if (queryTokens.length === 0) return [];

    const searchResults: SearchResult[] = [];

    // Search nodes
    if (showNodes) {
      nodes.forEach((node) => {
        if (matchesQuery(queryTokens, node.title)) {
          searchResults.push({
            type: "node",
            id: node.id,
            title: node.title,
          });
        }
      });
    }

    // Search tasks
    if (showTasks) {
      tasks.forEach((task) => {
        if (matchesQuery(queryTokens, task.title, task.description)) {
          searchResults.push({
            type: "task",
            id: task.id,
            title: task.title,
            parentTitle: nodeTitleMap.get(task.node_id),
            nodeId: task.node_id,
          });
        }
      });
    }

    return searchResults.slice(0, 20); // Limit results
  }, [query, nodes, tasks, showNodes, showTasks, nodeTitleMap]);

  const handleResultClick = (result: SearchResult) => {
    onResultClick(result);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
    >
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar nós e tarefas…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-9 pr-8 border-0 focus-visible:ring-0 bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters and results */}
        {isOpen && query.length >= 2 && (
          <div className="border-t">
            {/* Filter checkboxes */}
            <div className="flex items-center gap-4 px-3 py-2 border-b bg-muted/30">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={showNodes}
                  onCheckedChange={(checked) => setShowNodes(!!checked)}
                  className="h-3.5 w-3.5"
                />
                Nós
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={showTasks}
                  onCheckedChange={(checked) => setShowTasks(!!checked)}
                  className="h-3.5 w-3.5"
                />
                Tarefas
              </label>
            </div>

            {/* Results list */}
            <div className="max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum resultado encontrado
                </p>
              ) : (
                results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                  >
                    {result.type === "node" ? (
                      <Box className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <CheckSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      {result.parentTitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          em {result.parentTitle}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
