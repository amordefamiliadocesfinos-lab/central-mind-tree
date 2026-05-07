import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, Maximize2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  sourceBlob: Blob;
  initialBbox?: { x: number; y: number; width: number; height: number } | null;
  onConfirm: (publicUrl: string) => void;
  onCancel: () => void;
}

// Editor interativo: mostra a imagem original e um quadrado (com máscara circular)
// que o usuário pode arrastar e redimensionar para enquadrar exatamente a foto de perfil.
export function AvatarCropEditor({ sourceBlob, initialBbox, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgUrl, setImgUrl] = useState<string>('');
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [crop, setCrop] = useState<{ x: number; y: number; size: number } | null>(null); // em pixels da IMAGEM ORIGINAL
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ mode: 'move' | 'resize' | null; startX: number; startY: number; orig: { x: number; y: number; size: number } } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(sourceBlob);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sourceBlob]);

  const handleImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    const W = el.naturalWidth;
    const H = el.naturalHeight;
    setImgSize({ w: W, h: H });
    setDisplaySize({ w: el.clientWidth, h: el.clientHeight });

    // posicionar crop inicial a partir do bbox da IA, ou centro
    if (initialBbox && initialBbox.width > 0) {
      const cx = (initialBbox.x + initialBbox.width / 2) * W;
      const cy = (initialBbox.y + initialBbox.height / 2) * H;
      const size = Math.min(W, H, Math.max(initialBbox.width * W, initialBbox.height * H));
      setCrop({
        x: Math.max(0, Math.min(W - size, cx - size / 2)),
        y: Math.max(0, Math.min(H - size, cy - size / 2)),
        size,
      });
    } else {
      const size = Math.min(W, H) * 0.5;
      setCrop({ x: (W - size) / 2, y: (H - size) / 2, size });
    }
  };

  // resize observer
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (imgRef.current) {
        setDisplaySize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
      }
    });
    if (imgRef.current) obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [imgUrl]);

  const scale = imgSize.w > 0 ? displaySize.w / imgSize.w : 1;

  const onPointerDown = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...crop } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !d.mode || !crop) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (d.mode === 'move') {
      const nx = Math.max(0, Math.min(imgSize.w - d.orig.size, d.orig.x + dx));
      const ny = Math.max(0, Math.min(imgSize.h - d.orig.size, d.orig.y + dy));
      setCrop({ x: nx, y: ny, size: d.orig.size });
    } else {
      // resize a partir do canto inferior direito mantendo quadrado
      const delta = (dx + dy) / 2;
      const minSize = 32;
      const maxSize = Math.min(imgSize.w - d.orig.x, imgSize.h - d.orig.y);
      const ns = Math.max(minSize, Math.min(maxSize, d.orig.size + delta));
      setCrop({ x: d.orig.x, y: d.orig.y, size: ns });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
    dragRef.current = null;
  };

  const [enhancing, setEnhancing] = useState(false);
  const [enhancedDataUrl, setEnhancedDataUrl] = useState<string | null>(null);

  const buildCroppedBlob = async (): Promise<Blob | null> => {
    if (!crop) return null;
    const img = imgRef.current!;
    const out = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.beginPath();
    ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, out, out);
    ctx.restore();
    return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png', 0.95));
  };

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const r = await fetch(dataUrl);
    return await r.blob();
  };

  const enhance = async () => {
    if (!crop) return;
    setEnhancing(true);
    setEnhancedDataUrl(null);
    const tid = toast.loading('✨ Melhorando resolução com IA...');
    try {
      const cropped = await buildCroppedBlob();
      if (!cropped) throw new Error('Falha ao gerar recorte');
      // upload temporário para gerar URL pública (Gemini precisa de URL/base64)
      const tmpPath = `ai-extract/enhance-src-${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage.from('media').upload(tmpPath, cropped, { upsert: true, contentType: 'image/png', cacheControl: '60' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('media').getPublicUrl(tmpPath);
      const { data, error } = await supabase.functions.invoke('enhance-image', { body: { imageUrl: pub.publicUrl } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.imageDataUrl) throw new Error('IA não retornou imagem');
      setEnhancedDataUrl(data.imageDataUrl);
      toast.success('Resolução melhorada! Confirme para aplicar.', { id: tid });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao melhorar', { id: tid });
    } finally {
      setEnhancing(false);
    }
  };

  const confirm = async () => {
    if (!crop) return;
    setSaving(true);
    try {
      let blob: Blob | null;
      if (enhancedDataUrl) {
        // Aplica máscara circular sobre a imagem melhorada
        const enhBlob = await dataUrlToBlob(enhancedDataUrl);
        const enhImg = new Image();
        const u = URL.createObjectURL(enhBlob);
        await new Promise<void>((res, rej) => { enhImg.onload = () => res(); enhImg.onerror = () => rej(new Error('img')); enhImg.src = u; });
        const out = 1080;
        const c = document.createElement('canvas');
        c.width = out; c.height = out;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.beginPath();
        ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // cobre o quadrado mantendo proporção
        const s = Math.min(enhImg.naturalWidth, enhImg.naturalHeight);
        const sx = (enhImg.naturalWidth - s) / 2;
        const sy = (enhImg.naturalHeight - s) / 2;
        ctx.drawImage(enhImg, sx, sy, s, s, 0, 0, out, out);
        ctx.restore();
        URL.revokeObjectURL(u);
        blob = await new Promise((res) => c.toBlob((b) => res(b), 'image/png', 0.95));
      } else {
        blob = await buildCroppedBlob();
      }
      if (!blob) throw new Error('Falha ao gerar imagem');
      const path = `ai-extract/avatar-${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from('media').upload(path, blob, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
      if (error) throw error;
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      onConfirm(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar foto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-purple-700 dark:text-purple-300">
          Ajuste o recorte arrastando o círculo. Use o canto para redimensionar.
        </div>
        <Button size="sm" variant="ghost" type="button" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={containerRef} className="relative inline-block max-w-full bg-black/5 rounded overflow-hidden select-none touch-none">
        {imgUrl && (
          <img
            ref={imgRef}
            src={imgUrl}
            alt="Origem"
            onLoad={handleImgLoad}
            className="block max-h-[420px] w-auto h-auto"
            draggable={false}
          />
        )}
        {crop && imgSize.w > 0 && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at ${(crop.x + crop.size / 2) * scale}px ${(crop.y + crop.size / 2) * scale}px, transparent ${(crop.size / 2) * scale - 1}px, rgba(0,0,0,0.55) ${(crop.size / 2) * scale}px)`,
              }}
            />
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="absolute rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(168,85,247,0.9)] cursor-move"
              style={{
                left: crop.x * scale,
                top: crop.y * scale,
                width: crop.size * scale,
                height: crop.size * scale,
              }}
            >
              <div
                onPointerDown={(e) => onPointerDown(e, 'resize')}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="absolute -right-2 -bottom-2 h-5 w-5 rounded-full bg-white border-2 border-purple-500 cursor-se-resize flex items-center justify-center"
              >
                <Maximize2 className="h-3 w-3 text-purple-600" />
              </div>
            </div>
          </>
        )}
      </div>

      {enhancedDataUrl && (
        <div className="flex items-center gap-3 p-2 rounded border border-purple-200 dark:border-purple-800 bg-background">
          <div className="text-xs font-medium text-purple-700 dark:text-purple-300">Preview melhorado:</div>
          <img src={enhancedDataUrl} alt="Melhorada" className="h-20 w-20 rounded-full object-cover border-2 border-green-500" />
          <Button size="sm" variant="ghost" type="button" onClick={() => setEnhancedDataUrl(null)} className="ml-auto text-xs">
            Descartar
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={enhance}
          disabled={enhancing || saving || !crop}
          className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300"
        >
          {enhancing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Melhorar resolução (IA)
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" type="button" onClick={confirm} disabled={saving || !crop} className="bg-purple-600 hover:bg-purple-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            {enhancedDataUrl ? 'Usar versão melhorada' : 'Usar como foto'}
          </Button>
        </div>
      </div>
    </div>
  );
}
