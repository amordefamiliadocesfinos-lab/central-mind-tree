import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveUser } from '@/hooks/useActiveUser';
import { toast } from 'sonner';

export type CampaignStatus = 'rascunho' | 'aprovada' | 'em_execucao' | 'concluida' | 'cancelada';

export interface CampaignApplication {
  id: string;
  idea_id: string;
  title: string;
  objective: string;
  success_definition: string;
  metric_name: string;
  metric_unit: string;
  status: CampaignStatus;
  owner_user_id: string;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  owner_name?: string | null;
}

export interface CampaignExecution {
  id: string;
  campaign_id: string;
  title: string;
  planned_at: string | null;
  status: 'planejada' | 'confirmada' | 'cancelada';
  confirmed_at: string | null;
}

export interface CampaignEvidence {
  id: string;
  campaign_id: string;
  execution_id: string;
  kind: string;
  description: string | null;
  url: string | null;
  created_at: string;
}

export interface CampaignMetric {
  id: string;
  campaign_id: string;
  metric_name: string;
  metric_unit: string;
  metric_value: number;
  measured_at: string;
  note: string | null;
}

export interface CampaignLearning {
  id: string;
  campaign_id: string;
  content: string;
  created_at: string;
}

const asAny = supabase as any;

export function useCampaigns() {
  const { activeUserId, isLinked, loading: userLoading } = useActiveUser();
  const [campaigns, setCampaigns] = useState<CampaignApplication[]>([]);
  const [executions, setExecutions] = useState<CampaignExecution[]>([]);
  const [evidence, setEvidence] = useState<CampaignEvidence[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetric[]>([]);
  const [learnings, setLearnings] = useState<CampaignLearning[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isLinked) {
      setCampaigns([]); setExecutions([]); setEvidence([]); setMetrics([]); setLearnings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [c, e, ev, m, l] = await Promise.all([
      asAny.from('campaign_applications').select('*, owner:app_users!campaign_applications_owner_user_id_fkey(name)').order('created_at', { ascending: false }),
      asAny.from('campaign_executions').select('*').order('created_at', { ascending: true }),
      asAny.from('campaign_evidence').select('*').order('created_at', { ascending: true }),
      asAny.from('campaign_metrics').select('*').order('measured_at', { ascending: false }),
      asAny.from('campaign_learnings').select('*').order('created_at', { ascending: false }),
    ]);
    if (c.data) {
      setCampaigns(c.data.map((campaign: any) => ({
        ...campaign,
        owner_name: campaign.owner?.name || null,
      })));
    }
    if (e.data) setExecutions(e.data);
    if (ev.data) setEvidence(ev.data);
    if (m.data) setMetrics(m.data);
    if (l.data) setLearnings(l.data);
    setLoading(false);
  }, [isLinked]);

  useEffect(() => {
    if (userLoading) return;
    fetchAll();
  }, [userLoading, fetchAll]);

  const guard = () => {
    if (!activeUserId) {
      toast.error('Sua conta não possui vínculo operacional ativo. Ação bloqueada.');
      return false;
    }
    return true;
  };

  const createCampaign = useCallback(
    async (input: {
      idea_id: string;
      title: string;
      objective: string;
      success_definition: string;
      metric_name: string;
      metric_unit: string;
      execution_title: string;
      execution_planned_at?: string | null;
    }) => {
      if (!guard()) return null;
      const { data, error } = await asAny
        .from('campaign_applications')
        .insert({
          idea_id: input.idea_id,
          title: input.title,
          objective: input.objective,
          success_definition: input.success_definition,
          metric_name: input.metric_name,
          metric_unit: input.metric_unit,
          owner_user_id: activeUserId,
        })
        .select()
        .single();
      if (error) { toast.error(error.message); return null; }

      const { error: exErr } = await asAny.from('campaign_executions').insert({
        campaign_id: data.id,
        title: input.execution_title,
        planned_at: input.execution_planned_at || null,
        created_by: activeUserId,
      });
      if (exErr) toast.error(exErr.message);

      toast.success('Campanha essencial criada');
      await fetchAll();
      return data as CampaignApplication;
    },
    [activeUserId, fetchAll],
  );

  const approveCampaign = useCallback(async (campaignId: string) => {
    if (!guard()) return false;
    const { error } = await asAny.rpc('approve_campaign', { _campaign_id: campaignId });
    if (error) { toast.error(error.message); return false; }
    toast.success('Campanha aprovada');
    await fetchAll();
    return true;
  }, [activeUserId, fetchAll]);

  const addEvidence = useCallback(
    async (campaignId: string, executionId: string, input: { kind: string; description?: string; url?: string }) => {
      if (!guard()) return false;
      const { error } = await asAny.from('campaign_evidence').insert({
        campaign_id: campaignId,
        execution_id: executionId,
        kind: input.kind,
        description: input.description || null,
        url: input.url || null,
        created_by: activeUserId,
      });
      if (error) { toast.error(error.message); return false; }
      toast.success('Evidência registrada');
      await fetchAll();
      return true;
    },
    [activeUserId, fetchAll],
  );

  const confirmExecution = useCallback(async (executionId: string) => {
    if (!guard()) return false;
    const { error } = await asAny.rpc('confirm_campaign_execution', { _execution_id: executionId });
    if (error) { toast.error(error.message); return false; }
    toast.success('Execução confirmada');
    await fetchAll();
    return true;
  }, [activeUserId, fetchAll]);

  const addMetric = useCallback(
    async (campaign: CampaignApplication, value: number, note?: string) => {
      if (!guard()) return false;
      const { error } = await asAny.from('campaign_metrics').insert({
        campaign_id: campaign.id,
        metric_name: campaign.metric_name,
        metric_unit: campaign.metric_unit,
        metric_value: value,
        note: note || null,
        created_by: activeUserId,
      });
      if (error) { toast.error(error.message); return false; }
      toast.success('Métrica registrada');
      await fetchAll();
      return true;
    },
    [activeUserId, fetchAll],
  );

  const addLearning = useCallback(async (campaignId: string, content: string) => {
    if (!guard()) return false;
    const { error } = await asAny.from('campaign_learnings').insert({
      campaign_id: campaignId,
      content,
      created_by: activeUserId,
    });
    if (error) { toast.error(error.message); return false; }
    toast.success('Aprendizado registrado');
    await fetchAll();
    return true;
  }, [activeUserId, fetchAll]);

  const completeCampaign = useCallback(async (campaignId: string) => {
    if (!guard()) return false;
    const { error } = await asAny.rpc('complete_campaign', { _campaign_id: campaignId });
    if (error) { toast.error(error.message); return false; }
    toast.success('Campanha concluída');
    await fetchAll();
    return true;
  }, [activeUserId, fetchAll]);

  return {
    campaigns, executions, evidence, metrics, learnings,
    loading: loading || userLoading,
    isLinked,
    refetch: fetchAll,
    createCampaign, approveCampaign, addEvidence, confirmExecution,
    addMetric, addLearning, completeCampaign,
  };
}
