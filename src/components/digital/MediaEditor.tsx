import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Wand2, 
  Download, 
  Upload, 
  RotateCcw, 
  Sun, 
  Contrast, 
  Crop, 
  History,
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowUpCircle,
  Palette,
  ImageOff,
  Maximize2
} from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  filename: string | null;
  file_type: string | null;
  quality_status?: string;
  version?: number;
  parent_media_id?: string | null;
  ai_enhanced?: boolean;
  original_url?: string | null;
  enhancement_type?: string | null;
}

interface MediaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem;
  onUpdate: () => void;
}

type EnhancementType = 'upscale' | 'remove_bg' | 'auto_adjust' | 'sharpen';

const ENHANCEMENT_OPTIONS: { value: EnhancementType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'upscale', label: 'Aumentar Resolução', icon: <ArrowUpCircle className="h-4 w-4" />, description: 'Dobra a resolução mantendo qualidade' },
  { value: 'remove_bg', label: 'Remover Fundo', icon: <ImageOff className="h-4 w-4" />, description: 'Remove o fundo da imagem' },
  { value: 'auto_adjust', label: 'Ajuste Automático', icon: <Sparkles className="h-4 w-4" />, description: 'Melhora cores, brilho e contraste' },
  { value: 'sharpen', label: 'Nitidez', icon: <Maximize2 className="h-4 w-4" />, description: 'Aumenta a nitidez da imagem' },
];

const QUALITY_OPTIONS = [
  { value: 'approved', label: 'Aprovada', color: 'bg-green-500' },
  { value: 'review', label: 'Revisar', color: 'bg-yellow-500' },
  { value: 'low', label: 'Baixa Qualidade', color: 'bg-red-500' },
  { value: 'pending', label: 'Pendente', color: 'bg-gray-400' },
];

export function MediaEditor({ open, onOpenChange, media, onUpdate }: MediaEditorProps) {
  const [activeTab, setActiveTab] = useState('enhance');
  const [enhancing, setEnhancing] = useState(false);
  const [selectedEnhancement, setSelectedEnhancement] = useState<EnhancementType>('auto_adjust');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [uploading, setUploading] = useState(false);
  const [versions, setVersions] = useState<MediaItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Load versions when history tab is selected
  const loadVersions = useCallback(async () => {
    if (activeTab !== 'history' || !media.id) return;
    
    setLoadingVersions(true);
    const { data } = await supabase
      .from('digital_media')
      .select('*')
      .or(`id.eq.${media.id},parent_media_id.eq.${media.id}`)
      .order('version', { ascending: false });
    
    if (data) {
      setVersions(data as MediaItem[]);
    }
    setLoadingVersions(false);
  }, [activeTab, media.id]);

  // Update quality status
  const handleUpdateQuality = async (status: string) => {
    const { error } = await supabase
      .from('digital_media')
      .update({ quality_status: status })
      .eq('id', media.id);

    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }
    
    toast.success('Status atualizado');
    onUpdate();
  };

  // Apply AI enhancement
  const handleEnhance = async () => {
    setEnhancing(true);
    
    try {
      const response = await supabase.functions.invoke('media-enhance', {
        body: {
          imageUrl: media.url,
          enhancementType: selectedEnhancement,
          brightness,
          contrast,
        },
      });

      if (response.error) throw response.error;

      const enhancedUrl = response.data?.enhancedUrl;
      if (enhancedUrl) {
        setPreviewUrl(enhancedUrl);
        toast.success('Melhoria aplicada! Revise antes de salvar.');
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error('Erro ao processar imagem. Tente novamente.');
    } finally {
      setEnhancing(false);
    }
  };

  // Save enhanced version
  const handleSaveEnhanced = async () => {
    if (!previewUrl) return;
    
    setUploading(true);
    try {
      // Create new version record
      const newVersion = (media.version || 1) + 1;
      
      const { error } = await supabase.from('digital_media').insert({
        url: previewUrl,
        filename: `${media.filename?.replace(/\.[^/.]+$/, '')}_v${newVersion}${media.filename?.match(/\.[^/.]+$/)?.[0] || '.png'}`,
        file_type: media.file_type,
        parent_media_id: media.parent_media_id || media.id,
        version: newVersion,
        quality_status: 'approved',
        ai_enhanced: true,
        original_url: media.url,
        enhancement_type: selectedEnhancement,
        idea_id: null,
        variation_id: null,
      });

      if (error) throw error;

      toast.success('Nova versão salva!');
      setPreviewUrl(null);
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erro ao salvar');
    } finally {
      setUploading(false);
    }
  };

  // Download original - using fetch + blob to force real download
  const handleDownload = async () => {
    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = media.filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download iniciado!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  // Replace with uploaded file - updates the CURRENT media record
  const handleReplace = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `digital/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath);
      const newVersion = (media.version || 1) + 1;

      // Update the CURRENT media record with the new image
      const { error: dbError } = await supabase.from('digital_media')
        .update({
          url: urlData.publicUrl,
          filename: file.name,
          file_type: file.type,
          file_size: file.size,
          version: newVersion,
          quality_status: 'pending',
          original_url: media.url, // Keep reference to old URL
        })
        .eq('id', media.id);

      if (dbError) throw dbError;

      toast.success('Imagem substituída com sucesso!');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Replace error:', error);
      toast.error('Erro ao substituir arquivo');
    } finally {
      setUploading(false);
    }
  };

  // Restore version
  const handleRestoreVersion = async (version: MediaItem) => {
    const { error } = await supabase
      .from('digital_media')
      .update({ 
        url: version.url,
        version: (media.version || 1) + 1,
        original_url: media.url,
      })
      .eq('id', media.id);

    if (error) {
      toast.error('Erro ao restaurar versão');
      return;
    }

    toast.success('Versão restaurada!');
    onUpdate();
  };

  const imageStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Editor de Mídia
            {media.ai_enhanced && (
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="h-3 w-3 mr-1" />
                IA Aprimorada
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'history') loadVersions(); }} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="enhance">✨ IA</TabsTrigger>
            <TabsTrigger value="adjust">🎨 Ajustar</TabsTrigger>
            <TabsTrigger value="replace">📤 Substituir</TabsTrigger>
            <TabsTrigger value="history">📜 Histórico</TabsTrigger>
          </TabsList>

          {/* Preview Area */}
          <div className="flex-1 overflow-hidden flex gap-4 mt-4">
            {/* Current Image */}
            <div className="flex-1 flex flex-col">
              <Label className="text-xs text-muted-foreground mb-2">
                {previewUrl ? 'Original' : 'Imagem Atual'}
              </Label>
              <div className="flex-1 bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
                <img
                  src={media.url}
                  alt={media.filename || 'Preview'}
                  className="max-w-full max-h-full object-contain"
                  style={activeTab === 'adjust' && !previewUrl ? imageStyle : undefined}
                />
              </div>
            </div>

            {/* Preview (when available) */}
            {previewUrl && (
              <div className="flex-1 flex flex-col">
                <Label className="text-xs text-muted-foreground mb-2">Preview Melhorado</Label>
                <div className="flex-1 bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[300px] border-2 border-primary">
                  <img
                    src={previewUrl}
                    alt="Preview melhorado"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tab Contents */}
          <div className="mt-4 border-t pt-4">
            <TabsContent value="enhance" className="m-0">
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {ENHANCEMENT_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={selectedEnhancement === opt.value ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3 gap-1"
                      onClick={() => setSelectedEnhancement(opt.value)}
                    >
                      {opt.icon}
                      <span className="text-xs">{opt.label}</span>
                    </Button>
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground text-center">
                  {ENHANCEMENT_OPTIONS.find(o => o.value === selectedEnhancement)?.description}
                </p>

                <div className="flex gap-2 justify-center">
                  <Button onClick={handleEnhance} disabled={enhancing}>
                    {enhancing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Aplicar Melhoria
                      </>
                    )}
                  </Button>

                  {previewUrl && (
                    <>
                      <Button variant="outline" onClick={() => setPreviewUrl(null)}>
                        <X className="h-4 w-4 mr-2" />
                        Descartar
                      </Button>
                      <Button variant="default" onClick={handleSaveEnhanced} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                        Salvar Nova Versão
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adjust" className="m-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    <Label>Brilho: {brightness}%</Label>
                  </div>
                  <Slider
                    value={[brightness]}
                    onValueChange={([v]) => setBrightness(v)}
                    min={50}
                    max={150}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Contrast className="h-4 w-4" />
                    <Label>Contraste: {contrast}%</Label>
                  </div>
                  <Slider
                    value={[contrast]}
                    onValueChange={([v]) => setContrast(v)}
                    min={50}
                    max={150}
                    step={5}
                  />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => { setBrightness(100); setContrast(100); }}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resetar
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="replace" className="m-0">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground text-center">
                    Baixe a imagem atual, edite em um software externo, e faça upload da versão melhorada.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Original
                    </Button>
                    <Button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleReplace(file);
                        };
                        input.click();
                      }}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload Nova Versão
                    </Button>
                  </div>
                </div>

                {/* Quality Status */}
                <div className="space-y-2">
                  <Label>Status de Qualidade</Label>
                  <div className="flex gap-2 flex-wrap">
                    {QUALITY_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={media.quality_status === opt.value ? 'default' : 'outline'}
                        size="sm"
                        className="gap-2"
                        onClick={() => handleUpdateQuality(opt.value)}
                      >
                        <div className={`h-2 w-2 rounded-full ${opt.color}`} />
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="m-0">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum histórico de versões
                </p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-h-[200px] overflow-y-auto">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        v.id === media.id ? 'border-primary' : 'border-transparent hover:border-muted-foreground'
                      }`}
                      onClick={() => v.id !== media.id && handleRestoreVersion(v)}
                    >
                      <img src={v.url} alt={`v${v.version}`} className="aspect-square object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center">
                        v{v.version || 1}
                        {v.ai_enhanced && ' ✨'}
                      </div>
                      {v.id === media.id && (
                        <Badge className="absolute top-1 right-1 text-[10px]">Atual</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
