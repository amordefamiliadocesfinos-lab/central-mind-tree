import { useState } from 'react';
import { usePlatforms, Platform, CustomField } from '@/hooks/usePlatforms';
import { usePlatformGroups, PlatformGroup } from '@/hooks/usePlatformGroups';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Settings2, Sparkles, Loader2, GripVertical, Type, AlignLeft, ChevronRight, Copy, FolderPlus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EMOJI_OPTIONS = ['📱', '📷', '🎬', '📺', '⚡', '🎵', '📘', '🎥', '🎠', '🛒', '🟡', '🧡', '🟢', '🔵', '🟣', '📦', '🏪', '💼', '🌐', '📧'];

interface PlatformFormData {
  name: string;
  icon: string;
  group_id: string;
  parent_id: string;
  aspect_ratio: string;
  duration: string;
  custom_fields: CustomField[];
  checklist_items: string;
}

interface GroupFormData {
  name: string;
  icon: string;
}

const DEFAULT_FIELDS: CustomField[] = [
  { id: 'caption', label: 'Legenda', type: 'textarea' },
  { id: 'cta', label: 'Call to Action', type: 'input' },
];

export function PlatformsManager() {
  const { 
    platforms, 
    groupedPlatforms, 
    getChildren,
    loading, 
    createPlatform, 
    updatePlatform, 
    deletePlatform, 
    toggleActive 
  } = usePlatforms();

  const {
    groups,
    groupsMap,
    loading: groupsLoading,
    createGroup,
    updateGroup,
    deleteGroup,
  } = usePlatformGroups();

  const [showDialog, setShowDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [editingGroup, setEditingGroup] = useState<PlatformGroup | null>(null);
  const [formData, setFormData] = useState<PlatformFormData>({
    name: '',
    icon: '📱',
    group_id: '',
    parent_id: '',
    aspect_ratio: '',
    duration: '',
    custom_fields: [...DEFAULT_FIELDS],
    checklist_items: '',
  });
  const [groupFormData, setGroupFormData] = useState<GroupFormData>({ name: '', icon: '📦' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  // AI checklist suggestion
  const generateChecklistWithAI = async () => {
    if (!formData.name.trim()) {
      toast.error('Preencha o nome da plataforma primeiro');
      return;
    }
    
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: formData.name,
          field: 'checklist_suggestion',
          platform: formData.name,
          platformType: groupsMap[formData.group_id]?.name || 'social',
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.checklist) {
        setFormData(prev => ({ ...prev, checklist_items: data.checklist }));
        toast.success('Checklist sugerido pela IA!');
      }
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Erro ao gerar checklist com IA');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenCreate = (parentId?: string, groupId?: string) => {
    setEditingPlatform(null);
    setFormData({
      name: '',
      icon: '📱',
      group_id: groupId || groups[0]?.id || '',
      parent_id: parentId || '',
      aspect_ratio: '',
      duration: '',
      custom_fields: [...DEFAULT_FIELDS],
      checklist_items: '',
    });
    setShowDialog(true);
  };

  const handleOpenEdit = (platform: Platform) => {
    setEditingPlatform(platform);
    setFormData({
      name: platform.name,
      icon: platform.icon,
      group_id: platform.group_id || '',
      parent_id: platform.parent_id || '',
      aspect_ratio: platform.aspect_ratio || '',
      duration: platform.duration || '',
      custom_fields: platform.custom_fields.length > 0 ? platform.custom_fields : [...DEFAULT_FIELDS],
      checklist_items: platform.checklist_template.map(c => c.text).join('\n'),
    });
    setShowDialog(true);
  };

  const handleDuplicate = async (platform: Platform) => {
    const newPlatform = await createPlatform({
      name: `${platform.name} (cópia)`,
      icon: platform.icon,
      group_id: platform.group_id,
      parent_id: platform.parent_id,
      aspect_ratio: platform.aspect_ratio,
      duration: platform.duration,
      custom_fields: platform.custom_fields,
      checklist_template: platform.checklist_template,
    });
    if (newPlatform) {
      toast.success('Plataforma duplicada!');
    }
  };

  const handleSave = async () => {
    // Parse checklist items from text
    const checklistLines = formData.checklist_items.split('\n').filter(l => l.trim());
    const checklist_template = checklistLines.map((text, i) => ({
      id: `item-${i}`,
      text: text.trim(),
    }));

    // Convert custom_fields to fields array for backwards compatibility
    const fields = formData.custom_fields.map(f => f.id);

    // Map group_id back to group_type for legacy compatibility
    const group = groupsMap[formData.group_id];
    const group_type: 'social' | 'ecommerce' | 'marketplace' | 'other' = 
      group?.name === 'Redes Sociais' ? 'social' :
      group?.name === 'E-commerce' ? 'ecommerce' :
      group?.name === 'Marketplaces' ? 'marketplace' : 'other';

    const platformData = {
      name: formData.name,
      icon: formData.icon,
      group_id: formData.group_id || null,
      group_type,
      parent_id: formData.parent_id || null,
      aspect_ratio: formData.aspect_ratio || null,
      duration: formData.duration || null,
      fields,
      custom_fields: formData.custom_fields,
      checklist_template,
    };

    if (editingPlatform) {
      await updatePlatform(editingPlatform.id, platformData);
    } else {
      await createPlatform(platformData);
    }

    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    const success = await deletePlatform(id);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  // Group CRUD
  const handleOpenGroupCreate = () => {
    setEditingGroup(null);
    setGroupFormData({ name: '', icon: '📦' });
    setShowGroupDialog(true);
  };

  const handleOpenGroupEdit = (group: PlatformGroup) => {
    setEditingGroup(group);
    setGroupFormData({ name: group.name, icon: group.icon });
    setShowGroupDialog(true);
  };

  const handleSaveGroup = async () => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, groupFormData);
    } else {
      await createGroup(groupFormData);
    }
    setShowGroupDialog(false);
  };

  const handleDeleteGroup = async (id: string) => {
    const success = await deleteGroup(id);
    if (success) {
      setDeleteGroupConfirm(null);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: prev[groupId] === undefined ? false : !prev[groupId] }));
  };

  const togglePlatformExpand = (platformId: string) => {
    setExpandedPlatforms(prev => ({ ...prev, [platformId]: !prev[platformId] }));
  };

  // Field CRUD operations
  const addField = () => {
    const newId = `field_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      custom_fields: [...prev.custom_fields, { id: newId, label: '', type: 'input' }],
    }));
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f, i) => 
        i === index ? { ...f, ...updates } : f
      ),
    }));
  };

  const removeField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index),
    }));
  };

  // Render platform row with children
  const renderPlatform = (platform: Platform, depth: number = 0) => {
    const children = getChildren(platform.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedPlatforms[platform.id] !== false;

    return (
      <div key={platform.id}>
        <div
          className={cn(
            'flex items-center justify-between p-3 rounded-lg border',
            !platform.is_active && 'opacity-50 bg-muted/30',
            depth > 0 && 'ml-6 border-l-2 border-l-primary/30'
          )}
        >
          <div className="flex items-center gap-3">
            {hasChildren && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => togglePlatformExpand(platform.id)}
              >
                <ChevronRight className={cn(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-90'
                )} />
              </Button>
            )}
            {!hasChildren && depth > 0 && <div className="w-6" />}
            <span className="text-2xl">{platform.icon}</span>
            <div>
              <div className="font-medium">{platform.name}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {platform.custom_fields.length > 0 && (
                  <span>{platform.custom_fields.length} campos</span>
                )}
                {platform.aspect_ratio && (
                  <span>• {platform.aspect_ratio}</span>
                )}
                {platform.checklist_template.length > 0 && (
                  <span>• {platform.checklist_template.length} itens</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Switch
              checked={platform.is_active}
              onCheckedChange={(checked) => toggleActive(platform.id, checked)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleOpenCreate(platform.id, platform.group_id || undefined)}
              title="Adicionar sub-plataforma"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDuplicate(platform)}
              title="Duplicar"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleOpenEdit(platform)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => setDeleteConfirm(platform.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-2 mt-2">
            {children.map(child => renderPlatform(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading || groupsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Gerenciar Plataformas
          </h2>
          <p className="text-sm text-muted-foreground">
            {platforms.length} plataformas em {groups.length} grupos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenGroupCreate}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Novo Grupo
          </Button>
          <Button onClick={() => handleOpenCreate()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Plataforma
          </Button>
        </div>
      </div>

      {/* Groups */}
      {groups.map(group => {
        const groupPlatforms = (groupedPlatforms[group.id] || []).filter(p => !p.parent_id);
        const isExpanded = expandedGroups[group.id] !== false;

        return (
          <Collapsible
            key={group.id}
            open={isExpanded}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">{group.icon}</span>
                      {group.name}
                      <Badge variant="secondary" className="ml-2">
                        {groupPlatforms.length}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenGroupEdit(group);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteGroupConfirm(group.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  {groupPlatforms.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma plataforma neste grupo.
                    </p>
                  ) : (
                    groupPlatforms.map(platform => renderPlatform(platform, 0))
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleOpenCreate(undefined, group.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar plataforma
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Empty State */}
      {groups.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum grupo configurado.</p>
          <Button className="mt-4" onClick={handleOpenGroupCreate}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Criar Primeiro Grupo
          </Button>
        </Card>
      )}

      {/* Platform Create/Edit Dialog */}
      <ResponsiveDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingPlatform ? 'Editar Plataforma' : 'Nova Plataforma'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Icon and Name */}
          <div className="flex gap-3">
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={formData.icon}
                onValueChange={(v) => setFormData({ ...formData, icon: v })}
              >
                <SelectTrigger className="w-16 h-12 text-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="grid grid-cols-5 gap-1 p-2">
                    {EMOJI_OPTIONS.map(emoji => (
                      <SelectItem
                        key={emoji}
                        value={emoji}
                        className="text-xl justify-center p-2"
                      >
                        {emoji}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Nome da Plataforma</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Instagram Feed"
                className="h-12"
              />
            </div>
          </div>

          {/* Group */}
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select
              value={formData.group_id || '__none__'}
              onValueChange={(v) => setFormData({ ...formData, group_id: v === '__none__' ? '' : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem grupo</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    <div className="flex items-center gap-2">
                      <span>{g.icon}</span>
                      {g.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parent Platform (hierarchy) */}
          <div className="space-y-2">
            <Label>Plataforma Pai (opcional)</Label>
            <Select
              value={formData.parent_id || '__none__'}
              onValueChange={(v) => setFormData({ ...formData, parent_id: v === '__none__' ? '' : v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Nenhuma (raiz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                {platforms
                  .filter(p => p.id !== editingPlatform?.id)
                  .map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use para criar hierarquia. Ex: Instagram &gt; Instagram Feed, Instagram Reels
            </p>
          </div>

          {/* Aspect Ratio and Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Proporção (opcional)</Label>
              <Input
                value={formData.aspect_ratio}
                onChange={(e) => setFormData({ ...formData, aspect_ratio: e.target.value })}
                placeholder="Ex: 9:16, 1:1"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Duração (opcional)</Label>
              <Input
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="Ex: 15-60s"
                className="h-11"
              />
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Campos Personalizados</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={addField}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar Campo
              </Button>
            </div>
            
            <div className="space-y-2">
              {formData.custom_fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(index, { 
                      label: e.target.value,
                      id: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || field.id
                    })}
                    placeholder="Nome do campo"
                    className="h-9 flex-1"
                  />
                  
                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(index, { type: v as 'input' | 'textarea' })}
                  >
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="input">
                        <div className="flex items-center gap-2">
                          <Type className="h-3.5 w-3.5" />
                          Linha
                        </div>
                      </SelectItem>
                      <SelectItem value="textarea">
                        <div className="flex items-center gap-2">
                          <AlignLeft className="h-3.5 w-3.5" />
                          Texto
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {formData.custom_fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  Nenhum campo definido. Clique em "Adicionar Campo" acima.
                </p>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Defina os campos que aparecerão ao criar conteúdo para esta plataforma. Ex: Título, Descrição, Legenda...
            </p>
          </div>

          {/* Checklist Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist Padrão (um item por linha)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:text-primary"
                onClick={generateChecklistWithAI}
                disabled={aiLoading || !formData.name.trim()}
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span className="ml-1">Sugerir com IA</span>
              </Button>
            </div>
            <Textarea
              value={formData.checklist_items}
              onChange={(e) => setFormData({ ...formData, checklist_items: e.target.value })}
              placeholder="Imagem em alta resolução?&#10;Legenda otimizada?&#10;CTA incluído?"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Cada linha será um item do checklist nas variações desta plataforma.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-background">
            <Button 
              variant="outline" 
              className="flex-1 h-12" 
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 h-12" 
              onClick={handleSave}
              disabled={!formData.name.trim()}
            >
              {editingPlatform ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Group Create/Edit Dialog */}
      <ResponsiveDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        title={editingGroup ? 'Editar Grupo' : 'Novo Grupo'}
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={groupFormData.icon}
                onValueChange={(v) => setGroupFormData({ ...groupFormData, icon: v })}
              >
                <SelectTrigger className="w-16 h-12 text-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="grid grid-cols-5 gap-1 p-2">
                    {EMOJI_OPTIONS.map(emoji => (
                      <SelectItem
                        key={emoji}
                        value={emoji}
                        className="text-xl justify-center p-2"
                      >
                        {emoji}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Nome do Grupo</Label>
              <Input
                value={groupFormData.name}
                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                placeholder="Ex: Redes Sociais"
                className="h-12"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12" 
              onClick={() => setShowGroupDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 h-12" 
              onClick={handleSaveGroup}
              disabled={!groupFormData.name.trim()}
            >
              {editingGroup ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Delete Platform Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plataforma?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A plataforma será removida permanentemente.
              Se existirem variações usando esta plataforma, a exclusão não será permitida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={!!deleteGroupConfirm} onOpenChange={() => setDeleteGroupConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O grupo será removido permanentemente.
              Se existirem plataformas neste grupo, a exclusão não será permitida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupConfirm && handleDeleteGroup(deleteGroupConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
