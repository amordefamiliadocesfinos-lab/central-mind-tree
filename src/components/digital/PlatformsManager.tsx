import { useState, useRef } from 'react';
import { usePlatforms, Platform, CustomField, PlatformReplica } from '@/hooks/usePlatforms';
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
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Settings2, Sparkles, Loader2, GripVertical, Type, AlignLeft, ChevronRight, Copy, FolderPlus, Wand2, Check, RotateCcw, ImagePlus, Upload, Undo2, FolderOpen } from 'lucide-react';
import { CustomFieldsDefinition } from './CustomFieldsDefinition';
import { MediaLibrary } from './MediaLibrary';
import { PlatformHierarchicalPicker } from './PlatformHierarchicalPicker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to check if icon is a URL (image) vs emoji
function isIconUrl(icon: string): boolean {
  return icon.startsWith('http') || icon.startsWith('/');
}

// Reusable component to render platform icon (emoji or image)
export function PlatformIcon({ icon, size = 'md', className }: { icon: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };
  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  if (isIconUrl(icon)) {
    return (
      <img
        src={icon}
        alt="Ícone"
        className={cn(sizeClasses[size], 'rounded object-cover', className)}
      />
    );
  }
  return <span className={cn(textSizes[size], className)}>{icon}</span>;
}

const EMOJI_OPTIONS = ['📱', '📷', '🎬', '📺', '⚡', '🎵', '📘', '🎥', '🎠', '🛒', '🟡', '🧡', '🟢', '🔵', '🟣', '📦', '🏪', '💼', '🌐', '📧'];

// Reusable panel: upload screenshots/videos showing the real platform UI and extract structure with AI
interface RealStructurePanelProps {
  platformName: string;
  media: string[];
  uploading: boolean;
  loading: boolean;
  notes: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (url: string) => void;
  onExtract: () => void;
}

function RealStructurePanel({
  platformName,
  media,
  uploading,
  loading,
  notes,
  inputRef,
  onUpload,
  onRemove,
  onExtract,
}: RealStructurePanelProps) {
  const isVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
  const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-primary" />
            Estrutura Real da Plataforma
          </h4>
          <p className="text-xs text-muted-foreground">
            Envie prints (ou vídeo) da tela real da plataforma e a IA reproduz fielmente todos os campos visíveis (títulos, variações, peso, categorias, etc).
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onUpload}
          className="hidden"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Enviando...' : 'Adicionar prints/vídeo'}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onExtract}
            disabled={loading || media.length === 0 || !platformName.trim()}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {loading ? 'Analisando...' : 'Extrair estrutura com IA'}
          </Button>
        </div>

        {media.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {media.map((url) => (
              <div key={url} className="relative group aspect-square rounded border overflow-hidden bg-muted">
                {isImage(url) ? (
                  <img src={url} alt="Print" className="w-full h-full object-cover" />
                ) : isVideo(url) ? (
                  <video src={url} className="w-full h-full object-cover" muted />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Arquivo
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(url)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
            {notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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
    countVariations,
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; varCount: number; childCount: number } | null>(null);
  const [deleteCascade, setDeleteCascade] = useState(false);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStructureLoading, setAiStructureLoading] = useState(false);
  const [aiStructured, setAiStructured] = useState(false); // Whether AI has populated the form
  const [aiSuggestions, setAiSuggestions] = useState<{
    group_type?: string;
    objective?: string;
    suggested_children?: { name: string; icon: string; aspect_ratio?: string | null }[];
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  // Real platform structure (from screenshot/video analysis)
  const [realStructureMedia, setRealStructureMedia] = useState<string[]>([]);
  const [realStructureLoading, setRealStructureLoading] = useState(false);
  const [realStructureUploading, setRealStructureUploading] = useState(false);
  const [realStructureNotes, setRealStructureNotes] = useState<string>('');
  const [platformReplica, setPlatformReplica] = useState<PlatformReplica>({ sections: [] });
  const realMediaInputRef = useRef<HTMLInputElement>(null);

  // Upload custom icon image
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }
    setIconUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `platform-icons/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      // Mirror into universal media library tagged as platform-icon
      await supabase.from('digital_media').insert({
        url: publicUrl,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        tags: ['platform-icon'],
      });
      setFormData(prev => ({ ...prev, icon: publicUrl }));
      toast.success('Ícone atualizado e salvo na biblioteca!');
    } catch (err) {
      console.error('Icon upload error:', err);
      toast.error('Erro ao fazer upload do ícone');
    } finally {
      setIconUploading(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const [showIconLibrary, setShowIconLibrary] = useState(false);
  const handlePickIconFromLibrary = async (url: string) => {
    setFormData(prev => ({ ...prev, icon: url }));
    // Ensure the picked media is tagged as platform-icon for future filtering
    try {
      const { data: rows } = await supabase
        .from('digital_media')
        .select('id, tags')
        .eq('url', url);
      for (const row of rows || []) {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        if (!tags.includes('platform-icon')) {
          await supabase.from('digital_media').update({ tags: [...tags, 'platform-icon'] }).eq('id', row.id);
        }
      }
    } catch (err) {
      console.error('Tag sync error:', err);
    }
    setShowIconLibrary(false);
    toast.success('Ícone selecionado da biblioteca');
  };

  const restoreDefaultIcon = () => {
    setFormData(prev => ({ ...prev, icon: '📱' }));
  };

  // AI: Generate full platform structure from name
  const generatePlatformStructure = async () => {
    if (!formData.name.trim()) {
      toast.error('Informe o nome da plataforma');
      return;
    }
    
    setAiStructureLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: formData.name,
          field: 'platform_structure',
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Map AI group_type to existing group
      const groupTypeToGroupName: Record<string, string> = {
        social: 'Redes Sociais',
        marketplace: 'Marketplaces',
        ecommerce: 'E-commerce',
        mensageria: 'Mensageria',
        site: 'Site/Página',
        outro: 'Outros',
      };

      const suggestedGroupName = groupTypeToGroupName[data.group_type] || '';
      const matchedGroup = groups.find(g => 
        g.name.toLowerCase() === suggestedGroupName.toLowerCase()
      );

      // Populate form with AI suggestions
      setFormData(prev => ({
        ...prev,
        icon: data.icon || prev.icon,
        group_id: matchedGroup?.id || prev.group_id,
        aspect_ratio: data.aspect_ratio || '',
        duration: data.duration || '',
        custom_fields: data.custom_fields?.map((f: any) => ({
          id: f.id || f.label?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `field_${Date.now()}`,
          label: f.label || '',
          type: f.type === 'textarea' ? 'textarea' : 'input',
        })) || prev.custom_fields,
        checklist_items: data.checklist?.join('\n') || prev.checklist_items,
      }));

      setAiSuggestions({
        group_type: data.group_type,
        objective: data.objective,
        suggested_children: data.suggested_children || [],
      });

      setAiStructured(true);
      setShowAdvanced(false);
      toast.success('Estrutura gerada pela IA! Revise e confirme.');
    } catch (err) {
      console.error('AI structure error:', err);
      toast.error('Erro ao gerar estrutura com IA');
    } finally {
      setAiStructureLoading(false);
    }
  };

  // AI checklist suggestion (legacy, kept for edit mode)
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

  // Upload screenshots/videos showing the real platform interface
  const handleRealStructureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setRealStructureUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `platform-structure/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
      setRealStructureMedia(prev => [...prev, ...newUrls]);
      toast.success(`${newUrls.length} mídia(s) carregada(s)`);
    } catch (err) {
      console.error('Real structure upload error:', err);
      toast.error('Erro ao enviar mídia');
    } finally {
      setRealStructureUploading(false);
      if (realMediaInputRef.current) realMediaInputRef.current.value = '';
    }
  };

  const removeRealStructureMedia = (url: string) => {
    setRealStructureMedia(prev => prev.filter(u => u !== url));
  };

  // Send uploaded screenshots to AI to extract real structure
  const extractRealStructure = async () => {
    if (!formData.name.trim()) {
      toast.error('Informe o nome da plataforma primeiro');
      return;
    }
    // Filter out non-image URLs (videos won't be processed by vision model)
    const imageUrls = realStructureMedia.filter(u =>
      /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)
    );
    if (imageUrls.length === 0) {
      toast.error('Adicione ao menos uma imagem (print) da plataforma');
      return;
    }
    setRealStructureLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: formData.name,
          field: 'platform_structure_from_media',
          mediaUrls: imageUrls,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const newFields: CustomField[] = (data.custom_fields || []).map((f: any) => ({
        id:
          f.id ||
          (f.label || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '') ||
          `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: f.label || 'Campo',
        type: ['input', 'textarea', 'number', 'select', 'date', 'media'].includes(f.type)
          ? f.type
          : 'input',
      }));

      if (newFields.length === 0) {
        toast.error('A IA não conseguiu identificar campos nas imagens');
        return;
      }

      setFormData(prev => ({
        ...prev,
        custom_fields: newFields,
        aspect_ratio: data.aspect_ratio || prev.aspect_ratio,
        checklist_items:
          (data.checklist || []).join('\n') || prev.checklist_items,
      }));
      setRealStructureNotes(data.notes || '');

      // Capture full visual replica schema if AI returned it
      if (data.sections && Array.isArray(data.sections)) {
        setPlatformReplica({
          brand_color: data.brand_color,
          brand_name: data.brand_name || formData.name,
          sections: data.sections,
        });
      }

      setAiStructured(true);
      setShowAdvanced(true);
      toast.success(`Estrutura real extraída: ${newFields.length} campos`);
    } catch (err) {
      console.error('Real structure extraction error:', err);
      toast.error('Erro ao extrair estrutura com IA');
    } finally {
      setRealStructureLoading(false);
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
    setAiStructured(false);
    setAiSuggestions(null);
    setShowAdvanced(false);
    setRealStructureMedia([]);
    setRealStructureNotes('');
    setPlatformReplica({ sections: [] });
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
    setAiStructured(false);
    setAiSuggestions(null);
    setShowAdvanced(true); // Show all fields in edit mode
    setRealStructureMedia(platform.structure_media_urls || []);
    setRealStructureNotes('');
    setPlatformReplica(platform.platform_replica || { sections: [] });
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
      structure_media_urls: realStructureMedia,
      platform_replica: platformReplica,
    };

    if (editingPlatform) {
      await updatePlatform(editingPlatform.id, platformData);
    } else {
      const created = await createPlatform(platformData);

      // Auto-create suggested children if AI suggested them
      if (created && aiSuggestions?.suggested_children?.length) {
        for (const child of aiSuggestions.suggested_children) {
          await createPlatform({
            name: child.name,
            icon: child.icon || '📱',
            group_id: formData.group_id || null,
            parent_id: (created as any).id,
            aspect_ratio: child.aspect_ratio || null,
            custom_fields: formData.custom_fields, // inherit parent fields
            checklist_template, // inherit parent checklist
          });
        }
        toast.success(`${aiSuggestions.suggested_children.length} sub-formatos criados automaticamente!`);
      }
    }

    setAiStructured(false);
    setAiSuggestions(null);
    setRealStructureMedia([]);
    setRealStructureNotes('');
    setPlatformReplica({ sections: [] });
    setShowDialog(false);
  };

  const handleDelete = async (id: string, cascade: boolean) => {
    const success = await deletePlatform(id, { cascade });
    if (success) {
      setDeleteConfirm(null);
      setDeleteCascade(false);
    }
  };

  const openDeleteConfirm = async (platform: Platform) => {
    const childCount = getChildren(platform.id).length;
    const varCount = await countVariations(platform.id);
    setDeleteCascade(false);
    setDeleteConfirm({ id: platform.id, varCount, childCount });
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
    const isExpanded = expandedPlatforms[platform.id] === true;

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
            <PlatformIcon icon={platform.icon} size="lg" />
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
              onClick={() => openDeleteConfirm(platform)}
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

      {/* Platforms without group (orphaned) */}
      {(() => {
        const orphanedPlatforms = platforms.filter(p => !p.group_id && !p.parent_id);
        if (orphanedPlatforms.length === 0) return null;
        
        const isExpanded = expandedGroups['__no_group__'] !== false;
        
        return (
          <Collapsible
            open={isExpanded}
            onOpenChange={() => toggleGroup('__no_group__')}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">📋</span>
                      Sem Grupo
                      <Badge variant="secondary" className="ml-2">
                        {orphanedPlatforms.length}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
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
                  {orphanedPlatforms.map(platform => renderPlatform(platform, 0))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })()}

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
          {/* Step 1: Name input + AI button (creation mode) */}
          {!editingPlatform && !aiStructured && (
            <>
              <div className="space-y-3">
                <div className="text-center space-y-2 py-2">
                  <Wand2 className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Digite o nome da plataforma e a IA vai estruturar tudo automaticamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Nome da Plataforma</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Instagram, OLX, WhatsApp, Blog..."
                    className="h-12 text-lg"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.name.trim()) {
                        generatePlatformStructure();
                      }
                    }}
                  />
                </div>
                <Button
                  className="w-full h-12 gap-2"
                  onClick={generatePlatformStructure}
                  disabled={aiStructureLoading || !formData.name.trim()}
                >
                  {aiStructureLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Wand2 className="h-5 w-5" />
                  )}
                  {aiStructureLoading ? 'Analisando...' : 'Estruturar com IA'}
                </Button>

                {/* Real Platform Structure - from screenshots */}
                <RealStructurePanel
                  platformName={formData.name}
                  media={realStructureMedia}
                  uploading={realStructureUploading}
                  loading={realStructureLoading}
                  notes={realStructureNotes}
                  inputRef={realMediaInputRef}
                  onUpload={handleRealStructureUpload}
                  onRemove={removeRealStructureMedia}
                  onExtract={extractRealStructure}
                />
              </div>
              <div className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => { setShowAdvanced(true); setAiStructured(true); }}
                >
                  Criar manualmente sem IA →
                </Button>
              </div>
            </>
          )}

          {/* Step 2: AI suggestions review OR Manual/Edit mode */}
          {(aiStructured || editingPlatform) && (
            <>
              {/* AI Suggestions Summary (only for creation with AI) */}
              {aiSuggestions && !editingPlatform && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Sugestão da IA
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => {
                          setAiStructured(false);
                          setAiSuggestions(null);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refazer
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {aiSuggestions.group_type && (
                        <Badge variant="outline" className="capitalize">
                          Tipo: {aiSuggestions.group_type}
                        </Badge>
                      )}
                      {aiSuggestions.objective && (
                        <Badge variant="outline" className="capitalize">
                          Objetivo: {aiSuggestions.objective}
                        </Badge>
                      )}
                      {formData.aspect_ratio && (
                        <Badge variant="outline">
                          {formData.aspect_ratio}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {formData.custom_fields.length} campos
                      </Badge>
                      {formData.checklist_items && (
                        <Badge variant="outline">
                          {formData.checklist_items.split('\n').filter(l => l.trim()).length} itens checklist
                        </Badge>
                      )}
                    </div>
                    {aiSuggestions.suggested_children && aiSuggestions.suggested_children.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Sub-formatos sugeridos: </span>
                        {aiSuggestions.suggested_children.map((c, i) => (
                          <span key={i}>
                            {c.icon} {c.name}
                            {i < aiSuggestions.suggested_children!.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Real Platform Structure - also accessible in edit/manual mode */}
              <RealStructurePanel
                platformName={formData.name}
                media={realStructureMedia}
                uploading={realStructureUploading}
                loading={realStructureLoading}
                notes={realStructureNotes}
                inputRef={realMediaInputRef}
                onUpload={handleRealStructureUpload}
                onRemove={removeRealStructureMedia}
                onExtract={extractRealStructure}
              />

              <div className="flex gap-3">
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIconUpload}
                    className="hidden"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-16 h-12 p-0 relative"
                        disabled={iconUploading}
                      >
                        {iconUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <PlatformIcon icon={formData.icon} size="lg" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="start">
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Escolha um emoji</p>
                        <div className="grid grid-cols-5 gap-1">
                          {EMOJI_OPTIONS.map(emoji => (
                            <Button
                              key={emoji}
                              variant={formData.icon === emoji ? 'default' : 'ghost'}
                              size="icon"
                              className="text-xl h-9 w-9"
                              onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                            >
                              {emoji}
                            </Button>
                          ))}
                        </div>
                        <div className="border-t pt-2 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Ou use uma imagem</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => iconInputRef.current?.click()}
                            disabled={iconUploading}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload de imagem
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => setShowIconLibrary(true)}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Da Biblioteca
                          </Button>
                          {isIconUrl(formData.icon) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full gap-2 text-xs"
                              onClick={restoreDefaultIcon}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Restaurar emoji padrão
                            </Button>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
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

              {/* Toggle advanced details */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    Editar campos, checklist e detalhes ({formData.custom_fields.length} campos, {formData.checklist_items.split('\n').filter(l => l.trim()).length} itens)
                  </>
                )}
              </Button>

              {showAdvanced && (
                <>
                  {/* Parent Platform (hierarchy) */}
                  <div className="space-y-2">
                    <Label>Plataforma Pai (opcional)</Label>
                    <PlatformHierarchicalPicker
                      platforms={platforms.filter(p => p.id !== editingPlatform?.id)}
                      value={formData.parent_id || null}
                      onChange={(id) => setFormData({ ...formData, parent_id: id || '' })}
                      placeholder="Nenhuma (raiz)"
                      showAllOption
                      allLabel="Nenhuma (raiz)"
                      allowSelectParents
                    />
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

                  {/* Custom Fields Section - using reusable component */}
                  <CustomFieldsDefinition
                    fields={formData.custom_fields}
                    onChange={(fields) => setFormData(prev => ({ ...prev, custom_fields: fields }))}
                  />

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
                </>
              )}

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
                  className="flex-1 h-12 gap-2" 
                  onClick={handleSave}
                  disabled={!formData.name.trim()}
                >
                  {!editingPlatform && aiSuggestions?.suggested_children?.length ? (
                    <>
                      <Check className="h-4 w-4" />
                      Criar com {(aiSuggestions.suggested_children.length)} sub-formatos
                    </>
                  ) : (
                    editingPlatform ? 'Salvar' : 'Criar Plataforma'
                  )}
                </Button>
              </div>
            </>
          )}
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

      {/* Icon Library Picker */}
      <ResponsiveDialog open={showIconLibrary} onOpenChange={setShowIconLibrary} title="Escolher ícone da Biblioteca">
        <div className="-mx-6 -mb-6">
          <MediaLibrary
            mode="select"
            onSelect={handlePickIconFromLibrary}
          />
        </div>
      </ResponsiveDialog>

      {/* Delete Platform Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(null); setDeleteCascade(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plataforma?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Esta ação não pode ser desfeita.</p>
                {deleteConfirm?.childCount ? (
                  <p className="text-destructive font-medium">
                    ⚠️ Esta plataforma possui {deleteConfirm.childCount} sub-plataforma(s). Mova ou exclua os filhos primeiro.
                  </p>
                ) : null}
                {deleteConfirm && deleteConfirm.varCount > 0 ? (
                  <>
                    <p className="text-amber-600 font-medium">
                      ⚠️ Existem <strong>{deleteConfirm.varCount}</strong> variação(ões) vinculada(s) a esta plataforma.
                    </p>
                    <label className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={deleteCascade}
                        onChange={(e) => setDeleteCascade(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Excluir junto com as <strong>{deleteConfirm.varCount}</strong> variação(ões) vinculada(s).
                        <br />
                        <span className="text-xs text-muted-foreground">
                          As variações em ideias serão removidas permanentemente.
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm.id, deleteCascade)}
              disabled={!!deleteConfirm?.childCount || (!!deleteConfirm?.varCount && !deleteCascade)}
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
