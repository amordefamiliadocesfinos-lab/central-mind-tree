import { useState, useCallback, useMemo } from 'react';
import { useOrders, Order, Product, OrderItem } from '@/hooks/useOrders';
import { useMRP } from '@/hooks/useMRP';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, ShoppingCart, Factory, ArrowLeft, Trash2, AlertTriangle, Image } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ProductGallery } from '@/components/ProductGallery';
import { InventoryMovementDialog } from '@/components/InventoryMovementDialog';
import { ProductMovementHistory } from '@/components/ProductMovementHistory';
import { BOMEditor } from '@/components/BOMEditor';
import { MRPPanel } from '@/components/MRPPanel';
import { OperationsBottomNav, OperationsTab } from '@/components/operations/OperationsBottomNav';
import { OperationsSearchBar } from '@/components/operations/OperationsSearchBar';
import { OrderCard } from '@/components/operations/OrderCard';
import { ProductCard } from '@/components/operations/ProductCard';
import { KPICards } from '@/components/operations/KPICards';

const PRODUCT_CATEGORIES = [
  'Alimentos',
  'Bebidas',
  'Doces',
  'Salgados',
  'Embalagens',
  'Insumos',
  'Outros',
];

export default function Operacoes() {
  const {
    orders,
    products,
    inventory,
    loading,
    createProduct,
    updateProduct,
    updateInventory,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    calculateProductionPlan,
    calculateKPIs,
    orderStatus,
    orderChannels,
    refetch,
  } = useOrders();

  const { reserveMaterials, consumeMaterials, calculateOrderBOM } = useMRP();

  // Tab state
  const [activeTab, setActiveTab] = useState<OperationsTab>('overview');
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [orderBOM, setOrderBOM] = useState<{ component_id: string; component_name: string; qty_needed: number; stock_available: number; shortage: number }[]>([]);
  
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

  const kpis = calculateKPIs();
  const productionPlan = calculateProductionPlan();

  // Filter logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const getProductBalance = (productId: string) => {
    const inv = inventory.find(i => i.product_id === productId);
    return inv?.quantity || 0;
  };

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
      const product = products.find(p => p.id === value);
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

  const statusList = Object.entries(orderStatus).map(([key, value]) => ({ key, label: value.label }));

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
                {orders.slice(0, 3).map(order => (
                  <OrderCard 
                    key={order.id}
                    order={order}
                    orderStatus={orderStatus}
                    orderChannels={orderChannels}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {orders.length > 3 && (
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setActiveTab('orders')}
                  >
                    Ver todos ({orders.length})
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
                    {products
                      .filter(p => kpis.lowStock.some(l => l.id === p.id))
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
              categories={PRODUCT_CATEGORIES}
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
                          {Object.entries(orderChannels).map(([key, label]) => (
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
                              {products.map((p) => (
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
                    order={order}
                    orderStatus={orderStatus}
                    orderChannels={orderChannels}
                    onStatusChange={handleStatusChange}
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
              categories={PRODUCT_CATEGORIES}
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
                    product={product}
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
              categories={PRODUCT_CATEGORIES}
              statuses={[]}
              placeholder="Buscar no estoque..."
              showStatusFilter={false}
            />
            
            <h2 className="text-lg font-semibold">Estoque ({filteredProducts.length})</h2>

            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  balance={getProductBalance(product.id)}
                  onEdit={setEditingProduct}
                  onMovement={setMovementProduct}
                  onHistory={setHistoryProductId}
                  showInventoryActions
                />
              ))}
            </div>
          </div>
        );

      case 'production':
        return (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  Plano de Produção
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productionPlan.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma produção necessária. Todos os pedidos podem ser atendidos pelo estoque atual.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {productionPlan.map((item) => (
                      <Card key={item.product_id} className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{item.product.name}</h3>
                              <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                <span>Pedido: {item.ordered}</span>
                                <span>Estoque: {item.inStock}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-amber-600">
                                {item.toProduce}
                              </p>
                              <p className="text-xs text-muted-foreground">a produzir</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'mrp':
        return <MRPPanel />;

      case 'calendar':
        return (
          <div className="space-y-3">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Agenda de produção em desenvolvimento
              </p>
              <Link to="/calendario">
                <Button variant="outline" className="mt-4">
                  Ir para Calendário
                </Button>
              </Link>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Operações</h1>
          </div>
          <KPICards kpis={kpis} compact />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-24">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <OperationsBottomNav 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSearchTerm('');
          setCategoryFilter('all');
          setStatusFilter('all');
        }} 
      />

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
                  availableComponents={products.map(p => ({
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
              
              <Button onClick={handleUpdateProduct} className="w-full h-12 text-base">
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inventory Movement Dialog */}
      {movementProduct && (
        <InventoryMovementDialog
          open={!!movementProduct}
          onOpenChange={(open) => !open && setMovementProduct(null)}
          productId={movementProduct.id}
          productName={movementProduct.name}
          currentBalance={movementProduct.balance}
          onSuccess={() => {
            refetch();
            setMovementProduct(null);
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
    </div>
  );
}
