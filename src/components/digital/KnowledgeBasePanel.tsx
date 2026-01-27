import { useState } from 'react';
import { useKnowledgeBase, KnowledgeItem } from '@/hooks/useKnowledgeBase';
import { usePlatforms } from '@/hooks/usePlatforms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Plus, 
  Search,
  Book,
  Edit2,
  Trash2,
  Loader2,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';

export function KnowledgeBasePanel() {
  const { items, loading, createItem, updateItem, deleteItem, getCategories } = useKnowledgeBase();
  const { activePlatforms } = usePlatforms();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [formData, setFormData] = useState({
    platform_id: '',
    category: 'geral',
    question: '',
    answer: '',
    keywords: '',
  });

  const categories = getCategories();

  const handleSubmit = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error('Pergunta e resposta são obrigatórias');
      return;
    }

    const keywords = formData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (editingItem) {
      await updateItem(editingItem.id, {
        platform_id: formData.platform_id || null,
        category: formData.category,
        question: formData.question,
        answer: formData.answer,
        keywords,
      });
      toast.success('FAQ atualizada!');
    } else {
      await createItem({
        platform_id: formData.platform_id || null,
        category: formData.category,
        question: formData.question,
        answer: formData.answer,
        keywords,
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      platform_id: '',
      category: 'geral',
      question: '',
      answer: '',
      keywords: '',
    });
    setEditingItem(null);
    setShowNewDialog(false);
  };

  const handleEdit = (item: KnowledgeItem) => {
    setFormData({
      platform_id: item.platform_id || '',
      category: item.category,
      question: item.question,
      answer: item.answer,
      keywords: item.keywords?.join(', ') || '',
    });
    setEditingItem(item);
    setShowNewDialog(true);
  };

  const getPlatformName = (platformId: string | null) => {
    if (!platformId) return null;
    const platform = activePlatforms.find(p => p.id === platformId);
    return platform ? `${platform.icon} ${platform.name}` : null;
  };

  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.question.toLowerCase().includes(query) && 
          !item.answer.toLowerCase().includes(query) &&
          !item.keywords?.some(k => k.toLowerCase().includes(query))) {
        return false;
      }
    }
    return true;
  });

  // Group by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, KnowledgeItem[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <Book className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Base de Conhecimento</h2>
          <Badge variant="secondary">{items.length} FAQs</Badge>
        </div>

        <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar FAQ' : 'Nova FAQ'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ex: Pagamento, Envio, Produto"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Plataforma (opcional)</label>
                  <Select 
                    value={formData.platform_id || '__none__'} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, platform_id: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Todas as plataformas</SelectItem>
                      {activePlatforms.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.icon} {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pergunta</label>
                <Input
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="Ex: Qual o prazo de entrega?"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resposta</label>
                <Textarea
                  value={formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="Digite a resposta padrão..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Palavras-chave (separadas por vírgula)</label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="Ex: entrega, prazo, dias, demora"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit} className="flex-1">
                  {editingItem ? 'Salvar Alterações' : 'Criar FAQ'}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por pergunta, resposta ou palavra-chave..."
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* FAQ List */}
      <ScrollArea className="h-[500px]">
        {Object.keys(groupedItems).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma FAQ encontrada. Adicione perguntas frequentes para usar com a IA de atendimento.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{category}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {categoryItems.length} {categoryItems.length === 1 ? 'pergunta' : 'perguntas'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {categoryItems.map((item) => (
                    <Card key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{item.question}</h4>
                              {getPlatformName(item.platform_id) && (
                                <Badge variant="secondary" className="text-xs">
                                  {getPlatformName(item.platform_id)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{item.answer}</p>
                            {item.keywords && item.keywords.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                {item.keywords.map((keyword, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Usado {item.usage_count} {item.usage_count === 1 ? 'vez' : 'vezes'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Switch
                              checked={item.is_active}
                              onCheckedChange={(checked) => updateItem(item.id, { is_active: checked })}
                            />
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollArea>
    </div>
  );
}
