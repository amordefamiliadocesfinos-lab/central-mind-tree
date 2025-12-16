import { useState } from 'react';
import { useOrders, Order, Product, OrderItem } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Package, ShoppingCart, Factory, ArrowLeft, Trash2, AlertTriangle, Image, History, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ProductGallery } from '@/components/ProductGallery';
import { InventoryMovementDialog } from '@/components/InventoryMovementDialog';
import { ProductMovementHistory } from '@/components/ProductMovementHistory';

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

  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  
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
  const [editingInventory, setEditingInventory] = useState<{ productId: string; quantity: number } | null>(null);

  const kpis = calculateKPIs();
  const productionPlan = calculateProductionPlan();

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

  const handleUpdateInventory = async () => {
    if (editingInventory) {
      await updateInventory(editingInventory.productId, editingInventory.quantity);
      setEditingInventory(null);
    }
  };

  const getProductBalance = (productId: string) => {
    const inv = inventory.find(i => i.product_id === productId);
    return inv?.quantity || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando operações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Operações</h1>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{kpis.totalOrders}</p>
            <p className="text-xs text-muted-foreground">Pedidos (mês)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">R$ {kpis.totalValue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Faturamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">R$ {kpis.avgTicket.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Ticket Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{kpis.lowStock.length}</p>
            <p className="text-xs text-muted-foreground">Estoque Baixo</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders" className="gap-1">
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="production" className="gap-1">
            <Factory className="h-4 w-4" />
            Produção
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1">
            <Package className="h-4 w-4" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Pedidos</h2>
            <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Pedido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Novo Pedido</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <Label>Cliente</Label>
                    <Input
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
                      <SelectTrigger>
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
                          <SelectTrigger className="flex-1">
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
                          className="w-16"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        />
                        <Input
                          type="number"
                          className="w-20"
                          placeholder="R$"
                          value={item.unit_price}
                          onChange={(e) => updateOrderItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                        <Button size="icon" variant="ghost" onClick={() => removeOrderItem(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleAddOrder} className="w-full">
                    Criar Pedido
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {orders.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum pedido ainda.</p>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">
                            {order.order_number || `#${order.id.slice(0, 6)}`}
                          </h3>
                          <Badge
                            className={cn(
                              'text-white',
                              orderStatus[order.status as keyof typeof orderStatus]?.color
                            )}
                          >
                            {orderStatus[order.status as keyof typeof orderStatus]?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.customer_name || 'Cliente não informado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {orderChannels[order.channel as keyof typeof orderChannels]} • {order.order_date}
                          {order.due_date && ` • Prazo: ${order.due_date}`}
                        </p>
                        {order.items && order.items.length > 0 && (
                          <p className="text-xs mt-1">
                            {order.items.map(item => 
                              `${item.quantity}x ${item.product?.name || 'Produto'}`
                            ).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">R$ {(order.total_value || 0).toFixed(2)}</p>
                        <Select
                          value={order.status}
                          onValueChange={(v) => updateOrderStatus(order.id, v)}
                        >
                          <SelectTrigger className="w-32 h-8 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(orderStatus).map(([key, { label }]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Pedido</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Produzir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionPlan.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium">{item.product.name}</TableCell>
                        <TableCell className="text-right">{item.ordered}</TableCell>
                        <TableCell className="text-right">{item.inStock}</TableCell>
                        <TableCell className="text-right font-bold text-amber-600">
                          {item.toProduce}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const qty = getProductBalance(product.id);
                    const isLow = qty <= product.min_stock;

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {product.cover_image_url && (
                              <img 
                                src={product.cover_image_url} 
                                alt={product.name}
                                className="h-8 w-8 rounded object-cover"
                              />
                            )}
                            <div>
                              {product.name}
                              {isLow && <AlertTriangle className="h-4 w-4 text-amber-500 inline ml-2" />}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={isLow ? 'text-amber-500 font-bold' : ''}>
                            {qty} {product.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.min_stock}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMovementProduct({ 
                                id: product.id, 
                                name: product.name, 
                                balance: qty 
                              })}
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryProductId(product.id)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Produtos</h2>
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Produto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>SKU</Label>
                      <Input
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
                        <SelectTrigger>
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
                      <SelectTrigger>
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
                        value={newProduct.min_stock || 0}
                        onChange={(e) => setNewProduct({ ...newProduct, min_stock: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
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
                      value={newProduct.cost || 0}
                      onChange={(e) => setNewProduct({ ...newProduct, cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <Button onClick={handleAddProduct} className="w-full">
                    Criar Produto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const qty = getProductBalance(product.id);
              const isLow = qty <= product.min_stock;
              
              return (
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setEditingProduct(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {product.cover_image_url ? (
                        <img 
                          src={product.cover_image_url} 
                          alt={product.name}
                          className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{product.name}</h3>
                        <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        {product.category && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {product.category}
                          </Badge>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold">R$ {(product.price || 0).toFixed(2)}</span>
                          <span className={cn(
                            "text-xs",
                            isLow ? "text-amber-500 font-bold" : "text-muted-foreground"
                          )}>
                            Est: {qty}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SKU</Label>
                  <Input
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
                    <SelectTrigger>
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
                  <SelectTrigger>
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
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ 
                      ...editingProduct, 
                      price: parseFloat(e.target.value) || 0 
                    })}
                  />
                </div>
              </div>
              
              <Button onClick={handleUpdateProduct} className="w-full">
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
