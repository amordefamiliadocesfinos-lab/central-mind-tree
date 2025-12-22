import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { useMRP } from '@/hooks/useMRP';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { useMultiLocationInventory } from '@/hooks/useMultiLocationInventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, ShoppingCart, Factory, ArrowLeft, Trash2, AlertTriangle, Warehouse, DollarSign, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductMovementHistory } from '@/components/ProductMovementHistory';
import { BOMEditor } from '@/components/BOMEditor';
import { OperationsTab, OperationsBottomNav } from '@/components/operations/OperationsBottomNav';
import { OperationsSearchBar } from '@/components/operations/OperationsSearchBar';
import { OperationsTopTabs } from '@/components/operations/OperationsTopTabs';
import { OrderCard } from '@/components/operations/OrderCard';
import { ProductCard } from '@/components/operations/ProductCard';
import { KPICards } from '@/components/operations/KPICards';
import { MultiLocationMovementDialog } from '@/components/operations/MultiLocationMovementDialog';
import { LocationsManager } from '@/components/operations/LocationsManager';
import { ProductDeleteDialog } from '@/components/operations/ProductDeleteDialog';
import { OrderEditDialog } from '@/components/operations/OrderEditDialog';
import { ProductionTab } from '@/components/operations/ProductionTab';
import { OperationsCalendarTab } from '@/components/operations/OperationsCalendarTab';
import { MRPTab } from '@/components/operations/MRPTab';
import { ProductCostEditor } from '@/components/operations/ProductCostEditor';
import { 
  useAppStore, 
  PRODUCT_CATEGORIES, 
  ORDER_STATUS,
  ORDER_CHANNELS,
  sortProductsByCategory,
  sortOrdersByStatus,
  Product as StoreProduct,
  Order as StoreOrder,
  OrderItem as StoreOrderItem,
} from '@/stores/appStore';
import { useStockCheckStore } from '@/stores/stockCheckStore';
import { useKPIsSelector, useFilteredOrders, useFilteredProducts, useSearchFilters } from '@/stores/selectors';
import type { Order, OrderItem, Product } from '@/hooks/useOrders';

const VALID_TABS: OperationsTab[] = ['overview', 'orders', 'products', 'inventory', 'production', 'mrp', 'calendar'];

export default function Operacoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const {
    orders: rawOrders,
    products: rawProducts,
    inventory,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    createOrder,
    updateOrder,
    updateOrderStatus,
    updateOrderDueDate,
    deleteOrder,
    refetch,
  } = useOrders();

  const { reserveMaterials, consumeMaterials } = useMRP();
  const { locations } = useStorageLocations();
  const { getTotalBalance } = useMultiLocationInventory();

  // Store state
  const setOrders = useAppStore((s) => s.setOrders);
  const setProducts = useAppStore((s) => s.setProducts);
  const setInventory = useAppStore((s) => s.setInventory);
  const setProductBalances = useAppStore((s) => s.setProductBalances);
  const updateProductBalance = useAppStore((s) => s.updateProductBalance);
  const productBalances = useAppStore((s) => s.productBalances);

  // Sync data to store
  useEffect(() => {
    setOrders(rawOrders as StoreOrder[]);
  }, [rawOrders, setOrders]);

  useEffect(() => {
    setProducts(rawProducts as StoreProduct[]);
  }, [rawProducts, setProducts]);

  useEffect(() => {
    setInventory(inventory.map(i => ({
      id: i.id,
      product_id: i.product_id,
      quantity: i.quantity,
      location: i.location,
      location_id: null,
      updated_at: i.updated_at,
    })));
  }, [inventory, setInventory]);

  // Load product balances
  useEffect(() => {
    const loadBalances = async () => {
      const balances: Record<string, number> = {};
      for (const product of rawProducts) {
        balances[product.id] = await getTotalBalance(product.id);
      }
      setProductBalances(balances);
    };
    if (rawProducts.length > 0) {
      loadBalances();
    }
  }, [rawProducts, getTotalBalance, setProductBalances]);

  // Tab from querystring (stable)
  const tabParam = searchParams.get('tab') as OperationsTab | null;
  const activeTab: OperationsTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'orders';
  const setActiveTab = useCallback((tab: OperationsTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Filters from store
  const { searchTerm, categoryFilter, statusFilter, setSearchTerm, setCategoryFilter, setStatusFilter, resetFilters } = useSearchFilters();

  // Stock check
  const openStockCheckWizard = useStockCheckStore((s) => s.openWizard);

  // KPIs from selector
  const kpis = useKPIsSelector();

  // Filtered and sorted data
  const filteredOrders = sortOrdersByStatus(useFilteredOrders());
  const filteredProducts = sortProductsByCategory(useFilteredProducts());

  // Dialog states (local)
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [movementProduct, setMovementProduct] = useState<{ id: string; name: string } | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showCostEditor, setShowCostEditor] = useState(false);

  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    sku: '', 
    name: '', 
    min_stock: 0, 
    price: 0,
    category: '',
    unit: 'un',
    media_urls: [],
    cover_image_url: null,
  });
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    channel: 'direto',
    due_date: '',
    items: [] as { product_id: string; quantity: number; unit_price: number }[],
  });

  const getProductBalance = (productId: string) => productBalances[productId] || 0;

  // Handlers
  const handleAddProduct = async () => {
    const result = await createProduct(newProduct);
    if (result) {
      setShowProductDialog(false);
      setNewProduct({ sku: '', name: '', min_stock: 0, price: 0, category: '', unit: 'un', media_urls: [], cover_image_url: null });
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    await updateProduct(editingProduct.id, editingProduct);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    await deleteProduct(deletingProduct.id);
    setDeletingProduct(null);
    setEditingProduct(null);
  };

  const handleAddOrder = async () => {
    await createOrder(newOrder as Partial<Order>, newOrder.items as Partial<OrderItem>[]);
    setShowOrderDialog(false);
    setNewOrder({ customer_name: '', channel: 'direto', due_date: '', items: [] });
  };

  const addItemToOrder = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { product_id: '', quantity: 1, unit_price: 0 }],
    });
  };

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    const items = [...newOrder.items];
    (items[index] as Record<string, string | number>)[field] = value;
    
    if (field === 'product_id') {
      const product = rawProducts.find(p => p.id === value);
      if (product?.price) {
        items[index].unit_price = product.price;
      }
    }
    
    setNewOrder({ ...newOrder, items });
  };

  const removeOrderItem = (index: number) => {
    const items = newOrder.items.filter((_, i) => i !== index);
    setNewOrder({ ...newOrder, items });
  };

  const handleStatusChange = useCallback(async (order: Order, newStatus: string) => {
    const oldStatus = order.status;
    const items = order.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || [];
    
    if (oldStatus === 'rascunho' && newStatus === 'confirmado' && items.length > 0) {
      await reserveMaterials(order.id, items);
    }
    
    if ((oldStatus === 'confirmado' || oldStatus === 'rascunho') && newStatus === 'producao' && items.length > 0) {
      await consumeMaterials(order.id, items);
    }
    
    await updateOrderStatus(order.id, newStatus);
    refetch();
  }, [reserveMaterials, consumeMaterials, updateOrderStatus, refetch]);

  const handleTabChange = useCallback((tab: OperationsTab) => {
    setActiveTab(tab);
    resetFilters();
  }, [setActiveTab, resetFilters]);

  const statusList = Object.entries(ORDER_STATUS).map(([key, value]) => ({ key, label: value.label }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando operações...</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <KPICards kpis={kpis} />
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pedidos Recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sortOrdersByStatus(rawOrders).slice(0, 3).map(order => (
                  <OrderCard 
                    key={order.id}
                    order={order}
                    orderStatus={ORDER_STATUS}
                    orderChannels={ORDER_CHANNELS}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {rawOrders.length > 3 && (
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => handleTabChange('orders')}
                  >
                    Ver todos ({rawOrders.length})
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Estoque Baixo ({kpis.lowStock.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhum produto com estoque baixo
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortProductsByCategory(kpis.lowStock as Product[])
                      .slice(0, 3)
                      .map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          balance={getProductBalance(product.id)}
                          onEdit={setEditingProduct}
                        />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <LocationsManager />
          </div>
        );

      case 'orders':
        return (
          <div className="space-y-3">
            <OperationsSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={[...PRODUCT_CATEGORIES]}
              statuses={statusList}
              placeholder="Buscar pedidos..."
              showCategoryFilter={false}
            />
            
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Pedidos ({filteredOrders.length})</h2>
              <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" className="h-12 px-6">
                    <Plus className="h-5 w-5 mr-2" />
                    Novo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Pedido</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Cliente</Label>
                      <Input
                        className="h-12"
                        value={newOrder.customer_name}
                        onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Canal</Label>
                      <Select
                        value={newOrder.channel}
                        onValueChange={(v) => setNewOrder({ ...newOrder, channel: v })}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ORDER_CHANNELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prazo de Entrega</Label>
                      <Input
                        type="date"
                        className="h-12"
                        value={newOrder.due_date}
                        onChange={(e) => setNewOrder({ ...newOrder, due_date: e.target.value })}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label>Itens</Label>
                        <Button size="sm" variant="outline" onClick={addItemToOrder}>
                          <Plus className="h-3 w-3 mr-1" />
                          Item
                        </Button>
                      </div>
                      {newOrder.items.map((item, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <Select
                            value={item.product_id}
                            onValueChange={(v) => updateOrderItem(i, 'product_id', v)}
                          >
                            <SelectTrigger className="flex-1 h-10">
                              <SelectValue placeholder="Produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {sortProductsByCategory(rawProducts).map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            className="w-16 h-10"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) => updateOrderItem(i, 'quantity', parseInt(e.target.value) || 1)}
                          />
                          <Input
                            type="number"
                            className="w-20 h-10"
                            placeholder="R$"
                            value={item.unit_price}
                            onChange={(e) => updateOrderItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                          <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => removeOrderItem(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button onClick={handleAddOrder} className="w-full h-12 text-base">
                      Criar Pedido
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' ? 'Nenhum pedido encontrado.' : 'Nenhum pedido ainda.'}
                  </p>
                </Card>
              ) : (
                filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order as Order}
                    orderStatus={ORDER_STATUS}
                    orderChannels={ORDER_CHANNELS}
                    onStatusChange={handleStatusChange}
                    onClick={(o) => setEditingOrder(rawOrders.find(ord => ord.id === o.id) || null)}
                  />
                ))
              )}
            </div>
          </div>
        );

      case 'products':
        return (
          <div className="space-y-3">
            <OperationsSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={[...PRODUCT_CATEGORIES]}
              statuses={[]}
              placeholder="Buscar produtos..."
              showStatusFilter={false}
            />
            
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Produtos ({filteredProducts.length})</h2>
              <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" className="h-12 px-6">
                    <Plus className="h-5 w-5 mr-2" />
                    Novo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Produto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>SKU</Label>
                        <Input
                          className="h-12"
                          value={newProduct.sku || ''}
                          onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                          placeholder="Código único"
                        />
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Select
                          value={newProduct.unit || 'un'}
                          onValueChange={(v) => setNewProduct({ ...newProduct, unit: v })}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="un">Unidade</SelectItem>
                            <SelectItem value="kg">Quilograma</SelectItem>
                            <SelectItem value="g">Grama</SelectItem>
                            <SelectItem value="l">Litro</SelectItem>
                            <SelectItem value="ml">Mililitro</SelectItem>
                            <SelectItem value="cx">Caixa</SelectItem>
                            <SelectItem value="pct">Pacote</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input
                        className="h-12"
                        value={newProduct.name || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={newProduct.category || ''}
                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={newProduct.description || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Estoque Mínimo</Label>
                        <Input
                          type="number"
                          className="h-12"
                          value={newProduct.min_stock || 0}
                          onChange={(e) => setNewProduct({ ...newProduct, min_stock: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Preço (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-12"
                          value={newProduct.price || 0}
                          onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Custo (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-12"
                        value={newProduct.cost || 0}
                        onChange={(e) => setNewProduct({ ...newProduct, cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <Button onClick={handleAddProduct} className="w-full h-12 text-base">
                      Criar Produto
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {filteredProducts.length === 0 ? (
                <Card className="p-8 text-center col-span-full">
                  <p className="text-muted-foreground">
                    {searchTerm || categoryFilter !== 'all' ? 'Nenhum produto encontrado.' : 'Nenhum produto ainda.'}
                  </p>
                </Card>
              ) : (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product as Product}
                    balance={getProductBalance(product.id)}
                    onEdit={setEditingProduct}
                  />
                ))
              )}
            </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-3">
            <OperationsSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={[...PRODUCT_CATEGORIES]}
              statuses={[]}
              placeholder="Buscar no estoque..."
              showStatusFilter={false}
            />

            <div className="flex gap-2 overflow-x-auto pb-2">
              {locations.map(loc => (
                <Badge key={loc.id} variant="secondary" className="shrink-0">
                  <Warehouse className="h-3 w-3 mr-1" />
                  {loc.name}
                </Badge>
              ))}
            </div>
            
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Estoque ({filteredProducts.length})</h2>
              <Button 
                onClick={openStockCheckWizard}
                variant="outline"
                className="h-10 gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <ClipboardCheck className="h-4 w-4" />
                Atualizar Estoque
              </Button>
            </div>

            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product as Product}
                  balance={getProductBalance(product.id)}
                  onEdit={setEditingProduct}
                  onMovement={(p) => setMovementProduct({ id: p.id, name: p.name })}
                  onHistory={setHistoryProductId}
                  showInventoryActions
                />
              ))}
            </div>
          </div>
        );

      case 'production':
        return <ProductionTab products={rawProducts} onRefetch={refetch} />;

      case 'mrp':
        return (
          <MRPTab 
            orders={rawOrders} 
            onReserve={async (order) => {
              const items = order.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || [];
              if (items.length > 0) {
                await reserveMaterials(order.id, items);
                await updateOrderStatus(order.id, 'confirmado');
                refetch();
              }
            }}
            onConsume={async (order) => {
              const items = order.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || [];
              if (items.length > 0) {
                await consumeMaterials(order.id, items);
                await updateOrderStatus(order.id, 'producao');
                refetch();
              }
            }}
          />
        );

      case 'calendar':
        return (
          <OperationsCalendarTab
            orders={rawOrders}
            orderStatus={ORDER_STATUS}
            onOrderClick={setEditingOrder}
            onDateChange={updateOrderDueDate}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background no-overflow-x">
      {/* Header - Sticky with safe area */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-pt">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold truncate">Operações</h1>
          </div>
          <div className="hidden sm:block">
            <KPICards kpis={kpis} compact />
          </div>
        </div>
      </header>

      {/* Main Content - with bottom padding for fixed nav */}
      <main className="px-4 pt-2 pb-bottom-nav space-y-4 no-overflow-x">
        <OperationsTopTabs activeTab={activeTab} onTabChange={handleTabChange} />
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <OperationsBottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <ProductGallery
                productId={editingProduct.id}
                mediaUrls={editingProduct.media_urls || []}
                coverImageUrl={editingProduct.cover_image_url}
                onUpdate={(urls, cover) => setEditingProduct({
                  ...editingProduct,
                  media_urls: urls,
                  cover_image_url: cover,
                })}
              />

              <div className="border-t pt-4">
                <BOMEditor
                  productId={editingProduct.id}
                  productName={editingProduct.name}
                  availableComponents={rawProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    unit: p.unit,
                  }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SKU</Label>
                  <Input
                    className="h-12"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select
                    value={editingProduct.unit}
                    onValueChange={(v) => setEditingProduct({ ...editingProduct, unit: v })}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Unidade</SelectItem>
                      <SelectItem value="kg">Quilograma</SelectItem>
                      <SelectItem value="g">Grama</SelectItem>
                      <SelectItem value="l">Litro</SelectItem>
                      <SelectItem value="ml">Mililitro</SelectItem>
                      <SelectItem value="cx">Caixa</SelectItem>
                      <SelectItem value="pct">Pacote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Nome</Label>
                <Input
                  className="h-12"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Categoria</Label>
                <Select
                  value={editingProduct.category || ''}
                  onValueChange={(v) => setEditingProduct({ ...editingProduct, category: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mínimo</Label>
                  <Input
                    type="number"
                    className="h-12"
                    value={editingProduct.min_stock}
                    onChange={(e) => setEditingProduct({ 
                      ...editingProduct, 
                      min_stock: parseInt(e.target.value) || 0 
                    })}
                  />
                </div>
                <div>
                  <Label>Custo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-12"
                    value={editingProduct.cost || 0}
                    onChange={(e) => setEditingProduct({ 
                      ...editingProduct, 
                      cost: parseFloat(e.target.value) || 0 
                    })}
                  />
                </div>
                <div>
                  <Label>Preço</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-12"
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ 
                      ...editingProduct, 
                      price: parseFloat(e.target.value) || 0 
                    })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="h-12"
                  onClick={() => setShowCostEditor(true)}
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Custos
                </Button>
                <Button onClick={handleUpdateProduct} className="flex-1 h-12 text-base">
                  Salvar Alterações
                </Button>
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="h-12 w-12"
                  onClick={() => setDeletingProduct(editingProduct)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Cost Editor */}
      {editingProduct && (
        <ProductCostEditor
          productId={editingProduct.id}
          productName={editingProduct.name}
          open={showCostEditor}
          onOpenChange={setShowCostEditor}
          onCostUpdated={refetch}
        />
      )}

      {/* Multi-Location Movement Dialog */}
      {movementProduct && (
        <MultiLocationMovementDialog
          open={!!movementProduct}
          onOpenChange={(open) => !open && setMovementProduct(null)}
          productId={movementProduct.id}
          productName={movementProduct.name}
          onSuccess={() => {
            refetch();
            setMovementProduct(null);
            getTotalBalance(movementProduct.id).then(balance => {
              updateProductBalance(movementProduct.id, balance);
            });
          }}
        />
      )}

      {/* Movement History Dialog */}
      <Dialog open={!!historyProductId} onOpenChange={(open) => !open && setHistoryProductId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de Movimentos</DialogTitle>
          </DialogHeader>
          {historyProductId && (
            <ProductMovementHistory productId={historyProductId} />
          )}
        </DialogContent>
      </Dialog>

      {/* Product Delete Dialog */}
      <ProductDeleteDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        productName={deletingProduct?.name || ''}
        onConfirm={handleDeleteProduct}
      />

      {/* Order Edit Dialog */}
      <OrderEditDialog
        open={!!editingOrder}
        onOpenChange={(open) => !open && setEditingOrder(null)}
        order={editingOrder}
        products={rawProducts}
        orderStatus={ORDER_STATUS}
        orderChannels={ORDER_CHANNELS}
        onSave={updateOrder}
        onDelete={deleteOrder}
      />
    </div>
  );
}
