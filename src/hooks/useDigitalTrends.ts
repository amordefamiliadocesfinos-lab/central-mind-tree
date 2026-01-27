import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TrendResult {
  title: string;
  description: string;
  platforms: string[];
  engagement_potential: string;
  action_suggestion: string;
}

export interface CompetitorInsight {
  strategy: string;
  why_works: string;
  how_to_adapt: string;
}

export interface ContentIdea {
  format: string;
  hook: string;
  topic: string;
}

export interface TrendsData {
  trends?: TrendResult[];
  competitors_insights?: CompetitorInsight[];
  content_ideas?: ContentIdea[];
  summary?: string;
  raw_response?: string;
}

export interface DigitalTrend {
  id: string;
  query: string;
  niche: string | null;
  results: TrendsData;
  insights: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useDigitalTrends() {
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<DigitalTrend[]>([]);
  const [currentResult, setCurrentResult] = useState<TrendsData | null>(null);

  const fetchTrends = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_trends')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching trends:', error);
      return;
    }

    setTrends((data || []) as unknown as DigitalTrend[]);
  }, []);

  const searchTrends = useCallback(async (query: string, niche?: string) => {
    setLoading(true);
    setCurrentResult(null);

    try {
      // Call edge function
      const { data: functionData, error: functionError } = await supabase.functions.invoke('digital-trends', {
        body: { query, niche, type: 'trends' },
      });

      if (functionError) {
        throw functionError;
      }

      if (!functionData?.success) {
        throw new Error(functionData?.error || 'Erro ao pesquisar tendências');
      }

      const result = functionData.data as TrendsData;
      setCurrentResult(result);

      // Save to database
      const { error: insertError } = await supabase
        .from('digital_trends')
        .insert([{
          query,
          niche: niche || null,
          results: JSON.parse(JSON.stringify(result)),
          insights: result.summary || null,
          status: 'completed',
        }]);

      if (insertError) {
        console.error('Error saving trend:', insertError);
      }

      toast.success('Tendências analisadas com sucesso!');
      fetchTrends();

      return result;
    } catch (error) {
      console.error('Error searching trends:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao pesquisar tendências');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTrends]);

  const deleteTrend = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('digital_trends')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir pesquisa');
      return;
    }

    toast.success('Pesquisa excluída');
    fetchTrends();
  }, [fetchTrends]);

  return {
    loading,
    trends,
    currentResult,
    searchTrends,
    fetchTrends,
    deleteTrend,
    setCurrentResult,
  };
}
