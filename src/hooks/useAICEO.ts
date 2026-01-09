import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIInsight {
  id: string;
  created_at: string;
  area: 'Financeiro' | 'Projetos' | 'Tempo' | 'Recursos';
  title: string;
  description: string | null;
  severity: 'baixa' | 'media' | 'alta';
  confidence: number;
  impact: number;
  risk: number;
  decision: {
    type: string;
    endpoint?: string;
    payload?: Record<string, unknown>;
  } | null;
  status: 'proposto' | 'aprovado' | 'executado' | 'rejeitado';
  updated_at: string;
}

export interface AIAction {
  id: string;
  insight_id: string;
  action_type: string;
  payload: Record<string, unknown> | null;
  status: 'pendente' | 'ok' | 'erro';
  result: string | null;
  created_at: string;
  executed_at: string | null;
  ai_insights?: {
    title: string;
    area: string;
  };
}

export interface AIPolicy {
  id: string;
  area: 'Financeiro' | 'Projetos' | 'Tempo' | 'Recursos';
  autopilot: boolean;
  max_risk: number;
  created_at: string;
  updated_at: string;
}

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo`;

export function useAICEO() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [policies, setPolicies] = useState<AIPolicy[]>([]);
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchInsights = useCallback(async (filters?: { status?: string; area?: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.area) params.set('area', filters.area);

      const response = await fetch(`${API_BASE}/insights?${params}`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Erro ao carregar insights');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/policies`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch policies');
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  }, []);

  const fetchActions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/actions`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch actions');
      const data = await response.json();
      setActions(data.actions || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    setRunning(true);
    try {
      const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 429) {
        toast.error('Limite de requisições atingido. Tente novamente mais tarde.');
        return null;
      }
      if (response.status === 402) {
        toast.error('Créditos insuficientes. Adicione créditos para continuar.');
        return null;
      }
      if (!response.ok) throw new Error('Failed to run analysis');

      const data = await response.json();
      toast.success(`Análise concluída: ${data.insights_created} insights gerados`);
      
      // Refresh insights
      await fetchInsights();
      return data;
    } catch (error) {
      console.error('Error running analysis:', error);
      toast.error('Erro ao executar análise');
      return null;
    } finally {
      setRunning(false);
    }
  }, [fetchInsights]);

  const approveInsight = useCallback(async (insightId: string) => {
    try {
      const response = await fetch(`${API_BASE}/approve/${insightId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) throw new Error('Failed to approve insight');
      
      toast.success('Ação aprovada e executada');
      await fetchInsights();
      await fetchActions();
    } catch (error) {
      console.error('Error approving insight:', error);
      toast.error('Erro ao aprovar insight');
    }
  }, [fetchInsights, fetchActions]);

  const rejectInsight = useCallback(async (insightId: string) => {
    try {
      const response = await fetch(`${API_BASE}/reject/${insightId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) throw new Error('Failed to reject insight');
      
      toast.success('Insight rejeitado');
      await fetchInsights();
    } catch (error) {
      console.error('Error rejecting insight:', error);
      toast.error('Erro ao rejeitar insight');
    }
  }, [fetchInsights]);

  const updateAutopilot = useCallback(async (area: string, enabled: boolean, maxRisk?: number) => {
    try {
      const response = await fetch(`${API_BASE}/autopilot`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ area, enabled, max_risk: maxRisk }),
      });

      if (!response.ok) throw new Error('Failed to update autopilot');
      
      toast.success(`Autopilot ${enabled ? 'ativado' : 'desativado'} para ${area}`);
      await fetchPolicies();
    } catch (error) {
      console.error('Error updating autopilot:', error);
      toast.error('Erro ao atualizar autopilot');
    }
  }, [fetchPolicies]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('ai-insights-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_insights' },
        () => {
          fetchInsights();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInsights]);

  // Initial fetch
  useEffect(() => {
    fetchInsights();
    fetchPolicies();
    fetchActions();
  }, [fetchInsights, fetchPolicies, fetchActions]);

  const pendingCount = insights.filter(i => i.status === 'proposto').length;

  return {
    insights,
    policies,
    actions,
    loading,
    running,
    pendingCount,
    fetchInsights,
    fetchPolicies,
    fetchActions,
    runAnalysis,
    approveInsight,
    rejectInsight,
    updateAutopilot,
  };
}
