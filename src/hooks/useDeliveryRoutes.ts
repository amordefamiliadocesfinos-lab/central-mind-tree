import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DeliveryStop {
  id: string;
  route_id: string;
  contact_id: string | null;
  order_id: string | null;
  customer_name: string | null;
  phone: string | null;
  address: string;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  complement: string | null;
  reference_point: string | null;
  latitude: number | null;
  longitude: number | null;
  order_index: number;
  status: 'pendente' | 'entregue' | 'falhou';
  notes: string | null;
  delivery_notes: string | null;
  failure_reason: string | null;
  photo_url: string | null;
  signature_url: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRoute {
  id: string;
  name: string;
  description: string | null;
  route_type: 'fixa' | 'avulsa';
  status: 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';
  scheduled_date: string | null;
  driver_name: string | null;
  vehicle: string | null;
  origin_address: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  stops?: DeliveryStop[];
}

export function useDeliveryRoutes() {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const { data: routesData, error } = await supabase
      .from('delivery_routes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar rotas', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: stopsData } = await supabase
      .from('delivery_stops')
      .select('*')
      .order('order_index', { ascending: true });

    const routesWithStops = (routesData || []).map((r: any) => ({
      ...r,
      stops: (stopsData || []).filter((s: any) => s.route_id === r.id),
    })) as DeliveryRoute[];

    setRoutes(routesWithStops);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const createRoute = async (data: Partial<DeliveryRoute>) => {
    const { data: created, error } = await supabase
      .from('delivery_routes')
      .insert({
        name: data.name || 'Nova rota',
        description: data.description || null,
        route_type: data.route_type || 'avulsa',
        status: data.status || 'planejada',
        scheduled_date: data.scheduled_date || null,
        driver_name: data.driver_name || null,
        vehicle: data.vehicle || null,
        origin_address: data.origin_address || null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar rota', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Rota criada' });
    await fetchRoutes();
    return created as DeliveryRoute;
  };

  const updateRoute = async (id: string, data: Partial<DeliveryRoute>) => {
    const { error } = await supabase.from('delivery_routes').update(data).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar rota', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchRoutes();
  };

  const deleteRoute = async (id: string) => {
    const { error } = await supabase.from('delivery_routes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rota excluída' });
    await fetchRoutes();
  };

  const addStop = async (routeId: string, data: Partial<DeliveryStop>) => {
    const route = routes.find((r) => r.id === routeId);
    const nextIndex = (route?.stops?.length || 0);
    const { error } = await supabase.from('delivery_stops').insert({
      route_id: routeId,
      contact_id: data.contact_id || null,
      order_id: data.order_id || null,
      customer_name: data.customer_name || null,
      phone: data.phone || null,
      address: data.address || '',
      address_number: data.address_number || null,
      neighborhood: data.neighborhood || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zip_code || null,
      complement: data.complement || null,
      reference_point: data.reference_point || null,
      notes: data.notes || null,
      order_index: nextIndex,
      status: 'pendente',
    });
    if (error) {
      toast({ title: 'Erro ao adicionar parada', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchRoutes();
  };

  const updateStop = async (id: string, data: Partial<DeliveryStop>) => {
    const { error } = await supabase.from('delivery_stops').update(data).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar parada', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchRoutes();
  };

  const deleteStop = async (id: string) => {
    const { error } = await supabase.from('delivery_stops').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir parada', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchRoutes();
  };

  const reorderStops = async (routeId: string, orderedIds: string[]) => {
    // optimistic update
    setRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        const stopsById = new Map((r.stops || []).map((s) => [s.id, s]));
        const reordered = orderedIds
          .map((id, idx) => {
            const s = stopsById.get(id);
            return s ? { ...s, order_index: idx } : null;
          })
          .filter(Boolean) as DeliveryStop[];
        return { ...r, stops: reordered };
      })
    );

    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('delivery_stops').update({ order_index: idx }).eq('id', id)
      )
    );
  };

  const completeStopWithProof = async (
    stopId: string,
    payload: {
      status: 'entregue' | 'falhou';
      delivery_notes?: string;
      failure_reason?: string;
      photo_url?: string;
      signature_url?: string;
      order_id?: string | null;
    }
  ) => {
    const { error } = await supabase
      .from('delivery_stops')
      .update({
        status: payload.status,
        delivery_notes: payload.delivery_notes || null,
        failure_reason: payload.failure_reason || null,
        photo_url: payload.photo_url || null,
        signature_url: payload.signature_url || null,
        delivered_at: new Date().toISOString(),
      })
      .eq('id', stopId);

    if (error) {
      toast({ title: 'Erro ao registrar entrega', description: error.message, variant: 'destructive' });
      return;
    }

    // se entregue e tem pedido vinculado → marcar pedido como entregue
    if (payload.status === 'entregue' && payload.order_id) {
      await supabase.from('orders').update({ status: 'entregue' }).eq('id', payload.order_id);
    }

    toast({ title: payload.status === 'entregue' ? 'Entrega registrada' : 'Falha registrada' });
    await fetchRoutes();
  };

  return {
    routes,
    loading,
    fetchRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    addStop,
    updateStop,
    deleteStop,
    reorderStops,
    completeStopWithProof,
  };
}
