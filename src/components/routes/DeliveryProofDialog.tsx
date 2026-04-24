import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Camera, Eraser, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { DeliveryStop } from '@/hooks/useDeliveryRoutes';
import SignaturePad from './SignaturePad';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stop: DeliveryStop;
  onConfirm: (payload: {
    status: 'entregue' | 'falhou';
    delivery_notes?: string;
    failure_reason?: string;
    photo_url?: string;
    signature_url?: string;
    order_id?: string | null;
  }) => Promise<void> | void;
}

export function DeliveryProofDialog({ open, onOpenChange, stop, onConfirm }: Props) {
  const [status, setStatus] = useState<'entregue' | 'falhou'>('entregue');
  const [notes, setNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<{ getDataUrl: () => string | null; clear: () => void } | null>(null);
  const { toast } = useToast();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const uploadBlob = async (blob: Blob, ext: string) => {
    const path = `${stop.route_id}/${stop.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('delivery-proof').upload(path, blob, {
      contentType: blob.type || `image/${ext}`,
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('delivery-proof').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      let photo_url: string | undefined;
      let signature_url: string | undefined;

      if (photoFile) {
        photo_url = await uploadBlob(photoFile, photoFile.name.split('.').pop() || 'jpg');
      }

      if (status === 'entregue') {
        const dataUrl = signatureRef.current?.getDataUrl();
        if (dataUrl) {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          signature_url = await uploadBlob(blob, 'png');
        }
      }

      await onConfirm({
        status,
        delivery_notes: notes,
        failure_reason: status === 'falhou' ? failureReason : undefined,
        photo_url,
        signature_url,
        order_id: stop.order_id,
      });

      // reset
      setNotes('');
      setFailureReason('');
      setPhotoFile(null);
      setPhotoPreview(null);
      signatureRef.current?.clear();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar comprovante', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar entrega</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{stop.customer_name || 'Cliente'}</p>
            <p>{stop.address}{stop.address_number ? `, ${stop.address_number}` : ''}</p>
          </div>

          <div>
            <Label>Status</Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as 'entregue' | 'falhou')}
              className="flex gap-4 mt-2"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="entregue" id="entregue" />
                <span>Entregue</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="falhou" id="falhou" />
                <span>Falhou</span>
              </label>
            </RadioGroup>
          </div>

          {status === 'falhou' && (
            <div>
              <Label htmlFor="failure">Motivo da falha</Label>
              <Textarea
                id="failure"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="Cliente ausente, endereço incorreto..."
                rows={2}
              />
            </div>
          )}

          <div>
            <Label>Foto do comprovante</Label>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                {photoFile ? 'Trocar foto' : 'Tirar foto'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="h-16 w-16 rounded object-cover" />
              )}
            </div>
          </div>

          {status === 'entregue' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Assinatura do cliente</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => signatureRef.current?.clear()}
                >
                  <Eraser className="h-3 w-3 mr-1" /> Limpar
                </Button>
              </div>
              <SignaturePad ref={signatureRef as any} />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações da entrega..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
