import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  min_stock: number;
  cost: number | null;
  price: number | null;
  is_active: boolean;
  category: string | null;
  attributes: Record<string, unknown>;
  media_urls: string[];
  cover_image_url: string | null;
  expiry_days: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_g: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  location: string | null;
  updated_at: string;
  product?: Product;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
  product?: Product;
}

export type OrderType = 'stock' | 'production';

export interface Order {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  contact_id: string | null;
  channel: string;
  status: string;
  total_value: number | null;
  order_date: string;
  due_date: string | null;
  notes: string | null;
  order_type: OrderType;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface ProductionNeed {
  product_id: string;
  product: Product;
  ordered: number;
  inStock: number;
  toProduce: number;
}

const ORDER_STATUS = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500' },
  producao: { label: 'Em Produção', color: 'bg-red-500' },
  produzido: { label: 'Produzido', color: 'bg-emerald-600' },
  pronto: { label: 'Pronto', color: 'bg-green-500' },
  enviado: { label: 'Enviado', color: 'bg-blue-500' },
  faturado: { label: 'Faturado', color: 'bg-indigo-600' },
  concluido: { label: 'Concluído', color: 'bg-gray-500' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-400' },
};

const ORDER_CHANNELS = {
  direto: 'Venda Direta',
  marketplace: 'Marketplace',
  ecommerce: 'E-commerce',
  social: 'Redes Sociais',
};

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(*))')
        .is('deleted_at', null)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      // Transform to match expected format
      const ordersWithItems = (data || []).map(order => ({
        ...order,
        items: order.order_items || [],
      }));

      setOrders(ordersWithItems as Order[]);
    } catch (err) {
      console.error('Error in fetchOrders:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProducts((data as Product[]) || []);
    } catch (err) {
      console.error('Error in fetchProducts:', err);
    }
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('products')
      .update({ 
        deleted_at: new Date().toISOString(),
        is_active: false 
      })
      .eq('id', productId);

    if (error) {
      toast.error('Erro ao excluir produto');
      return false;
    }

    toast.success('Produto excluído!');
    fetchProducts();
    return true;
  }, [fetchProducts]);

  const fetchInventory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, product:products(*)');

      if (error) {
        console.error('Error fetching inventory:', error);
        return;
      }

      setInventory((data as InventoryItem[]) || []);
      setLoading(false);
    } catch (err) {
      console.error('Error in fetchInventory:', err);
      setLoading(false);
    }
  }, []);

  const createProduct = useCallback(async (product: Partial<Product>) => {
    const { data, error } = await (supabase
      .from('products')
      .insert({
        sku: product.sku || `SKU-${Date.now()}`,
        name: product.name || 'Novo Produto',
        description: product.description || null,
        unit: product.unit || 'un',
        min_stock: product.min_stock || 0,
        cost: product.cost || null,
        price: product.price || null,
        category: product.category || null,
        attributes: (product.attributes || {}) as any,
        media_urls: (product.media_urls || []) as any,
        cover_image_url: product.cover_image_url || null,
        expiry_days: product.expiry_days || null,
      }) as any)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar produto');
      return null;
    }

    toast.success('Produto criado!');
    fetchProducts();
    return data as Product;
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const updateData: any = { ...updates };
    if (updates.attributes) updateData.attributes = updates.attributes;
    if (updates.media_urls) updateData.media_urls = updates.media_urls;
    
    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar produto');
      return;
    }

    toast.success('Produto atualizado!');
    fetchProducts();
  }, [fetchProducts]);

  const updateInventory = useCallback(async (productId: string, quantity: number, location?: string) => {
    // Upsert inventory
    const { error } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        quantity,
        location: location || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,location',
      });

    if (error) {
      toast.error('Erro ao atualizar estoque');
      return;
    }

    toast.success('Estoque atualizado!');
    fetchInventory();
  }, [fetchInventory]);

  const createOrder = useCallback(async (order: Partial<Order>, items: Partial<OrderItem>[]) => {
    const pricingData = order as Partial<Order> & {
      discount_amount?: number;
      shipping_amount?: number;
    };

    const subtotal = items.reduce((acc, item) => {
      return acc + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
    const discountAmount = pricingData.discount_amount || 0;
    const shippingAmount = pricingData.shipping_amount || 0;
    const total = Math.max(0, subtotal - discountAmount + shippingAmount);

    const orderType = order.order_type || 'production';

    const pricingNotes = [
      discountAmount > 0 ? `Desconto: ${discountAmount.toFixed(2)}` : null,
      shippingAmount > 0 ? `Frete: ${shippingAmount.toFixed(2)}` : null,
    ].filter(Boolean).join(' | ');

    const combinedNotes = [order.notes, pricingNotes].filter(Boolean).join('\n');

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: order.order_number || `PED-${Date.now()}`,
        customer_name: order.customer_name,
        customer_contact: order.customer_contact,
        contact_id: order.contact_id || null,
        channel: order.channel || 'direto',
        status: 'pendente',
        total_value: total,
        order_date: order.order_date || new Date().toISOString().split('T')[0],
        due_date: order.due_date,
        notes: combinedNotes || null,
        order_type: orderType,
      })
      .select()
      .single();

    if (orderError) {
      toast.error('Erro ao criar pedido');
      return null;
    }

    // Insert items
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(
          items.map(item => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            notes: item.notes,
          }))
        );

      if (itemsError) {
        console.error('Error adding items:', itemsError);
      }

      // Handle based on order type
      if (orderType === 'stock') {
        // STOCK SALE: Consume from finished goods inventory directly
        for (const item of items) {
          if (!item.product_id) continue;

          // Get current balance
          const { data: inv } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('product_id', item.product_id)
            .maybeSingle();

          const prevBalance = inv?.quantity || 0;
          const newBalance = Math.max(0, prevBalance - (item.quantity || 1));

          // Create inventory movement
          await supabase
            .from('inventory_movements')
            .insert({
              product_id: item.product_id,
              quantity: -(item.quantity || 1),
              previous_balance: prevBalance,
              new_balance: newBalance,
              movement_type: 'out',
              reference_type: 'order',
              reference_id: newOrder.id,
              notes: `Venda ${newOrder.order_number}`,
            });

          // Update inventory balance
          await supabase
            .from('inventory')
            .upsert({
              product_id: item.product_id,
              quantity: newBalance,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'product_id' });
        }

        toast.success('Pedido criado! Estoque atualizado.');
      } else {
        // PRODUCTION: Auto-create production orders for each item
        for (const item of items) {
          if (!item.product_id) continue;

          // Get processes associated with this product
          const { data: productProcesses } = await supabase
            .from('product_processes')
            .select('process_id')
            .eq('product_id', item.product_id);

          // OP name follows the sales order number with OP- prefix
          const orderNumber = `OP-${newOrder.order_number}`;

          // Create production order with source_order_id link
          const { data: prodOrder, error: prodError } = await supabase
            .from('production_orders')
            .insert({
              order_number: orderNumber,
              product_id: item.product_id,
              target_quantity: item.quantity || 1,
              status: 'aberto',
              notes: `Gerado automaticamente do pedido ${newOrder.order_number}`,
              source_order_id: newOrder.id,
            } as any)
            .select()
            .single();

          if (prodError) {
            console.error('Error creating production order:', prodError);
            continue;
          }

          // Add processes to production order if any exist
          if (productProcesses && productProcesses.length > 0) {
            await supabase
              .from('production_order_processes')
              .insert(productProcesses.map(p => ({
                production_order_id: prodOrder.id,
                process_id: p.process_id,
                is_required: true,
              })));
          }
        }

        toast.success('Pedido e ordens de produção criados!');
      }
    } else {
      toast.success('Pedido criado!');
    }

    // Auto-create financial entry (conta a receber) for every new order
    if (newOrder && total > 0) {
      const { error: finError } = await supabase
        .from('financial_entries')
        .insert({
          type: 'receber',
          description: `Pedido ${newOrder.order_number || newOrder.id.slice(0, 8)} - ${order.customer_name || 'Cliente'}`,
          value: total,
          due_date: order.due_date || new Date().toISOString().split('T')[0],
          order_id: newOrder.id,
          contact_id: order.contact_id || null,
          notes: `Gerado automaticamente na criação do pedido`,
        });

      if (finError) {
        console.error('Error creating financial entry:', finError);
      } else {
        toast.success('Conta a receber gerada no financeiro!');
      }
    }

    fetchOrders();
    return newOrder as Order;
  }, [fetchOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    const currentOrder = orders.find(o => o.id === orderId);
    const isChangingToConcluido = status === 'concluido' && currentOrder?.status !== 'concluido';

    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }

    // Ensure financial entry exists for this order (safety check)
    if (currentOrder && (currentOrder.total_value || 0) > 0) {
      const { data: existingEntry } = await supabase
        .from('financial_entries')
        .select('id, value, value_paid')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!existingEntry) {
        // Create entry if it doesn't exist (e.g., legacy orders)
        await supabase
          .from('financial_entries')
          .insert({
            type: 'receber',
            description: `Pedido ${currentOrder.order_number || orderId.slice(0, 8)} - ${currentOrder.customer_name || 'Cliente'}`,
            value: currentOrder.total_value || 0,
            due_date: currentOrder.due_date || new Date().toISOString().split('T')[0],
            order_id: orderId,
            contact_id: currentOrder.contact_id || null,
            notes: `Gerado automaticamente do pedido`,
          });
      }

      // Entry exists or was just created — no auto-payment.
      // User must go to Financeiro > A Receber to register payment manually.
    }

    toast.success('Status atualizado!');
    fetchOrders();
  }, [fetchOrders, orders]);

  const updateOrder = useCallback(async (
    orderId: string, 
    updates: Partial<Order>, 
    items?: Partial<OrderItem>[]
  ) => {
    // Update order
    const total = items?.reduce((acc, item) => {
      return acc + (item.quantity || 0) * (item.unit_price || 0);
    }, 0) || updates.total_value;

    // Get current order to check if order_number changed
    const currentOrder = orders.find(o => o.id === orderId);
    const orderNumberChanged = updates.order_number && currentOrder?.order_number !== updates.order_number;

    const { error: orderError } = await supabase
      .from('orders')
      .update({
        order_number: updates.order_number,
        customer_name: updates.customer_name,
        customer_contact: updates.customer_contact,
        contact_id: updates.contact_id,
        channel: updates.channel,
        status: updates.status,
        order_date: updates.order_date,
        due_date: updates.due_date,
        notes: updates.notes,
        total_value: total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderError) {
      toast.error('Erro ao atualizar pedido');
      return;
    }

    // Sync production orders names when order_number changes
    if (orderNumberChanged && updates.order_number) {
      const newOPName = `OP-${updates.order_number}`;
      const { error: opError } = await supabase
        .from('production_orders')
        .update({ order_number: newOPName, updated_at: new Date().toISOString() })
        .eq('source_order_id', orderId);

      if (opError) {
        console.error('Error updating production orders names:', opError);
      }
    }

    // Update items if provided
    if (items) {
      // Delete existing items
      await supabase.from('order_items').delete().eq('order_id', orderId);
      
      // Insert new items
      if (items.length > 0) {
        await supabase.from('order_items').insert(
          items.map(item => ({
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            notes: item.notes,
          }))
        );
      }
    }

    // Sync financial entry when order value or details change
    const { data: existingFinEntry } = await supabase
      .from('financial_entries')
      .select('id, value_paid')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingFinEntry && total !== undefined) {
      // Only update if the entry hasn't been fully paid yet
      if (existingFinEntry.value_paid < (total || 0)) {
        await supabase
          .from('financial_entries')
          .update({
            description: `Pedido ${updates.order_number || currentOrder?.order_number || orderId.slice(0, 8)} - ${updates.customer_name || currentOrder?.customer_name || 'Cliente'}`,
            value: total,
            due_date: updates.due_date || currentOrder?.due_date || new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFinEntry.id);
      }
    }

    // No auto-payment on status change — user handles payment manually in Financeiro > A Receber

    toast.success('Pedido atualizado!');
    fetchOrders();
  }, [fetchOrders, orders]);

  const updateOrderDueDate = useCallback(async (orderId: string, dueDate: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ due_date: dueDate, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      toast.error('Erro ao atualizar prazo');
      return;
    }

    toast.success('Prazo atualizado!');
    fetchOrders();
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      toast.error('Erro ao excluir pedido');
      return;
    }

    toast.success('Pedido excluído!');
    fetchOrders();
  }, [fetchOrders]);

  // Calculate production needs
  const calculateProductionPlan = useCallback((): ProductionNeed[] => {
    const pendingOrders = orders.filter(o => 
      o.status === 'pendente' || o.status === 'producao'
    );

    // Sum quantities by product
    const ordersByProduct: Record<string, number> = {};
    pendingOrders.forEach(order => {
      order.items?.forEach(item => {
        ordersByProduct[item.product_id] = 
          (ordersByProduct[item.product_id] || 0) + item.quantity;
      });
    });

    // Calculate needs
    const needs: ProductionNeed[] = [];
    Object.entries(ordersByProduct).forEach(([productId, ordered]) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const invItem = inventory.find(i => i.product_id === productId);
      const inStock = invItem?.quantity || 0;
      const toProduce = Math.max(0, ordered - inStock);

      needs.push({
        product_id: productId,
        product,
        ordered,
        inStock,
        toProduce,
      });
    });

    return needs.filter(n => n.toProduce > 0);
  }, [orders, products, inventory]);

  // Calculate KPIs
  const calculateKPIs = useCallback(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthOrders = orders.filter(o => o.order_date.startsWith(thisMonth));
    
    const totalOrders = monthOrders.length;
    const totalValue = monthOrders.reduce((acc, o) => acc + (o.total_value || 0), 0);
    const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;

    const byChannel = monthOrders.reduce((acc, o) => {
      acc[o.channel] = (acc[o.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lowStock = inventory.filter(i => {
      const product = products.find(p => p.id === i.product_id);
      return product && i.quantity <= product.min_stock;
    });

    return {
      totalOrders,
      totalValue,
      avgTicket,
      byChannel,
      byStatus,
      lowStock,
    };
  }, [orders, inventory, products]);

  useEffect(() => {
    // Fetch all data in parallel for better performance
    Promise.all([fetchOrders(), fetchProducts(), fetchInventory()]).catch(err => {
      console.error('Error fetching initial data:', err);
    });

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, fetchOrders)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
      }, fetchProducts)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory',
      }, fetchInventory)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, fetchProducts, fetchInventory]);

  return {
    orders,
    products,
    inventory,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    updateInventory,
    createOrder,
    updateOrder,
    updateOrderStatus,
    updateOrderDueDate,
    deleteOrder,
    calculateProductionPlan,
    calculateKPIs,
    orderStatus: ORDER_STATUS,
    orderChannels: ORDER_CHANNELS,
    refetch: () => {
      fetchOrders();
      fetchProducts();
      fetchInventory();
    },
  };
}
