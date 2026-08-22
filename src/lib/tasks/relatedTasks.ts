/**
 * Sugestão simples de tarefas relacionadas.
 * Comparação leve por palavras relevantes em comum (título + descrição),
 * com pequeno reforço quando estão na mesma área/nó. Sem IA, sem embeddings.
 */

export interface RelatableTask {
  id: string;
  title: string;
  description?: string | null;
  node_id: string;
}

const STOPWORDS = new Set([
  "de","da","do","das","dos","a","o","as","os","e","ou","em","no","na","nos","nas","um","uma","uns","umas",
  "para","por","com","sem","que","ao","aos","à","às","se","the","of","to","and","pra","pro","sobre","como",
  "fazer","tarefa","novo","nova","mais","menos","tem","ter","ser","est","ate","até","dia","hoje",
]);

/** Normaliza (minúsculas, sem acentos) e extrai palavras relevantes. */
export function extractKeywords(text: string): Set<string> {
  const normalized = text
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  return new Set(
    normalized
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
  );
}

function taskKeywords(task: RelatableTask): Set<string> {
  return extractKeywords(`${task.title} ${task.description || ""}`);
}

/**
 * Retorna as tarefas mais prováveis de pertencerem ao mesmo assunto.
 * Nunca associa nada — apenas sugere candidatas.
 */
export function findRelatedTasks(
  base: RelatableTask,
  candidates: RelatableTask[],
  options: { limit?: number; isGroupedNode?: (nodeId: string) => boolean } = {}
): RelatableTask[] {
  const limit = options.limit ?? 10;
  const baseWords = taskKeywords(base);
  if (baseWords.size === 0) return [];

  const baseGrouped = options.isGroupedNode?.(base.node_id) ?? false;

  const scored = candidates
    .filter((task) => task.id !== base.id)
    // Já no mesmo projeto? não precisa sugerir.
    .filter((task) => !(baseGrouped && task.node_id === base.node_id))
    .map((task) => {
      const words = taskKeywords(task);
      let common = 0;
      words.forEach((word) => {
        if (baseWords.has(word)) common += 1;
      });
      if (common === 0) return { task, score: 0 };
      // Proporção de palavras em comum + leve reforço de mesma área.
      const score = common / Math.min(baseWords.size, words.size) + (task.node_id === base.node_id ? 0.15 : 0);
      return { task, score };
    })
    .filter((item) => item.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => item.task);
}
