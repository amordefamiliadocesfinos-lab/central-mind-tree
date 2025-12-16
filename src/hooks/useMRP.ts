import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useInventoryMovements } from './useInventoryMovements';

export interface MaterialNeed {
  component_id: string;
  component_name: string;
  component_sku: string;
  unit: string;
  total_needed: number;
  stock_available: number;
  reserved: number;
  shortage: number;
  orders_affected: string[];
}

export interface PurchaseSuggestion {
  component_id: string;
  component_name: string;
  component_sku: string;
  unit: string;
  suggested_qty: number;
  urgency: 'high' | 'medium' | 'low';
}

export function useMRP() {
  const { createMovement, getCurrentBalance } = useInventoryMovements();

  // Calculate material needs for confirmed/production orders
  const calculateMaterialNeeds = useCallback(async (): Promise<MaterialNeed[]> => {
    // Get confirmed and in-production orders with items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        items:order_items(
          product_id,
          quantity
        )
      `)
      .in('status', ['confirmado', 'producao'])
      .is('deleted_at', null);

    if (ordersError || !orders) {
      console.error('Error fetching orders:', ordersError);
      return [];
    }

    // Get all product IDs from orders
    const productIds = new Set<string>();
    orders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        if (item.product_id) productIds.add(item.product_id);
      });
    });

    if (productIds.size === 0) return [];

    // Get BOM for all products
    const { data: allComponents } = await supabase
      .from('product_components')
      .select(`
        product_id,
        component_id,
        qty_per_unit,
        component:products!product_components_component_id_fkey(id, name, sku, unit)
      `)
      .in('product_id', Array.from(productIds));

    if (!allComponents || allComponents.length === 0) return [];

    // Build component needs map
    const needsMap: Record<string, {
      total_needed: number;
      component: any;
      orders_affected: Set<string>;
    }> = {};

    orders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        const components = allComponents.filter((c: any) => c.product_id === item.product_id);
        components.forEach((comp: any) => {
          const compId = comp.component_id;
          const qtyNeeded = comp.qty_per_unit * item.quantity;

          if (!needsMap[compId]) {
            needsMap[compId] = {
              total_needed: 0,
              component: comp.component,
              orders_affected: new Set(),
            };
          }
          needsMap[compId].total_needed += qtyNeeded;
          needsMap[compId].orders_affected.add(order.order_number || order.id.slice(0, 8));
        });
      });
    });

    // Get stock and reserved amounts for all components
    const componentIds = Object.keys(needsMap);
    const { data: invData } = await supabase
      .from('inventory')
      .select('product_id, quantity')
      .in('product_id', componentIds);

    // Get reserved amounts from movements
    const { data: reservedData } = await supabase
      .from('inventory_movements')
      .select('product_id, quantity')
      .in('product_id', componentIds)
      .eq('movement_type', 'reserve');

    const stockMap: Record<string, number> = {};
    const reservedMap: Record<string, number> = {};

    (invData || []).forEach((inv: any) => {
      stockMap[inv.product_id] = inv.quantity;
    });

    (reservedData || []).forEach((mov: any) => {
      reservedMap[mov.product_id] = (reservedMap[mov.product_id] || 0) + mov.quantity;
    });

    // Build final needs array
    return componentIds.map(compId => {
      const need = needsMap[compId];
      const stockAvailable = stockMap[compId] || 0;
      const reserved = reservedMap[compId] || 0;
      const effectiveStock = stockAvailable - reserved;
      const shortage = Math.max(0, need.total_needed - effectiveStock);

      return {
        component_id: compId,
        component_name: need.component?.name || 'Unknown',
        component_sku: need.component?.sku || '',
        unit: need.component?.unit || 'un',
        total_needed: need.total_needed,
        stock_available: stockAvailable,
        reserved,
        shortage,
        orders_affected: Array.from(need.orders_affected),
      };
    });
  }, []);

  // Get purchase suggestions based on material needs
  const getPurchaseSuggestions = useCallback(async (): Promise<PurchaseSuggestion[]> => {
    const needs = await calculateMaterialNeeds();
    
    return needs
      .filter(n => n.shortage > 0)
      .map(n => {
        const urgency: 'high' | 'medium' | 'low' = 
          n.shortage > n.total_needed * 0.5 ? 'high' : 
          n.shortage > n.total_needed * 0.25 ? 'medium' : 'low';
        return {
          component_id: n.component_id,
          component_name: n.component_name,
          component_sku: n.component_sku,
          unit: n.unit,
          suggested_qty: n.shortage,
          urgency,
        };
      })
      .sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });
  }, [calculateMaterialNeeds]);

  // Reserve materials when order is confirmed for production
  const reserveMaterials = useCallback(async (
    orderId: string,
    orderItems: { product_id: string; quantity: number }[]
  ): Promise<boolean> => {
    // Get BOM for all products in order
    const productIds = orderItems.map(i => i.product_id);
    const { data: components } = await supabase
      .from('product_components')
      .select('product_id, component_id, qty_per_unit')
      .in('product_id', productIds);

    if (!components || components.length === 0) {
      // No BOM defined, nothing to reserve
      return true;
    }

    // Calculate total needs per component
    const reservations: { componentId: string; qty: number }[] = [];
    
    orderItems.forEach(item => {
      const itemComponents = components.filter((c: any) => c.product_id === item.product_id);
      itemComponents.forEach((comp: any) => {
        const existing = reservations.find(r => r.componentId === comp.component_id);
        const qtyNeeded = comp.qty_per_unit * item.quantity;
        if (existing) {
          existing.qty += qtyNeeded;
        } else {
          reservations.push({ componentId: comp.component_id, qty: qtyNeeded });
        }
      });
    });

    // Create reserve movements
    const results = await Promise.all(
      reservations.map(r => 
        createMovement(
          r.componentId,
          'reserve',
          r.qty,
          `Reserva para pedido ${orderId.slice(0, 8)}`,
          'order',
          orderId
        )
      )
    );

    const allSuccess = results.every(r => r !== null);
    if (allSuccess) {
      toast.success('Materiais reservados');
    } else {
      toast.error('Alguns materiais não puderam ser reservados');
    }

    return allSuccess;
  }, [createMovement]);

  // Consume reserved materials when production starts
  const consumeMaterials = useCallback(async (
    orderId: string,
    orderItems: { product_id: string; quantity: number }[]
  ): Promise<boolean> => {
    // Get BOM for all products in order
    const productIds = orderItems.map(i => i.product_id);
    const { data: components } = await supabase
      .from('product_components')
      .select('product_id, component_id, qty_per_unit')
      .in('product_id', productIds);

    if (!components || components.length === 0) {
      return true;
    }

    // Calculate total consumption per component
    const consumptions: { componentId: string; qty: number }[] = [];
    
    orderItems.forEach(item => {
      const itemComponents = components.filter((c: any) => c.product_id === item.product_id);
      itemComponents.forEach((comp: any) => {
        const existing = consumptions.find(c => c.componentId === comp.component_id);
        const qtyNeeded = comp.qty_per_unit * item.quantity;
        if (existing) {
          existing.qty += qtyNeeded;
        } else {
          consumptions.push({ componentId: comp.component_id, qty: qtyNeeded });
        }
      });
    });

    // Create consume movements
    const results = await Promise.all(
      consumptions.map(c => 
        createMovement(
          c.componentId,
          'consume',
          c.qty,
          `Consumo para pedido ${orderId.slice(0, 8)}`,
          'order',
          orderId
        )
      )
    );

    const allSuccess = results.every(r => r !== null);
    if (allSuccess) {
      toast.success('Materiais consumidos do estoque');
    } else {
      toast.error('Erro ao consumir alguns materiais');
    }

    return allSuccess;
  }, [createMovement]);

  // Calculate BOM for specific order
  const calculateOrderBOM = useCallback(async (
    orderItems: { product_id: string; quantity: number }[]
  ): Promise<{
    component_id: string;
    component_name: string;
    qty_needed: number;
    stock_available: number;
    shortage: number;
  }[]> => {
    const productIds = orderItems.map(i => i.product_id);
    
    const { data: components } = await supabase
      .from('product_components')
      .select(`
        product_id,
        component_id,
        qty_per_unit,
        component:products!product_components_component_id_fkey(id, name, sku, unit)
      `)
      .in('product_id', productIds);

    if (!components || components.length === 0) return [];

    // Aggregate needs
    const needsMap: Record<string, { qty: number; component: any }> = {};
    
    orderItems.forEach(item => {
      const itemComponents = components.filter((c: any) => c.product_id === item.product_id);
      itemComponents.forEach((comp: any) => {
        const compId = comp.component_id;
        const qtyNeeded = comp.qty_per_unit * item.quantity;
        if (!needsMap[compId]) {
          needsMap[compId] = { qty: 0, component: comp.component };
        }
        needsMap[compId].qty += qtyNeeded;
      });
    });

    // Get stock
    const componentIds = Object.keys(needsMap);
    const { data: invData } = await supabase
      .from('inventory')
      .select('product_id, quantity')
      .in('product_id', componentIds);

    const stockMap: Record<string, number> = {};
    (invData || []).forEach((inv: any) => {
      stockMap[inv.product_id] = inv.quantity;
    });

    return componentIds.map(compId => {
      const need = needsMap[compId];
      const stock = stockMap[compId] || 0;
      return {
        component_id: compId,
        component_name: need.component?.name || 'Unknown',
        qty_needed: need.qty,
        stock_available: stock,
        shortage: Math.max(0, need.qty - stock),
      };
    });
  }, []);

  return {
    calculateMaterialNeeds,
    getPurchaseSuggestions,
    reserveMaterials,
    consumeMaterials,
    calculateOrderBOM,
  };
}
