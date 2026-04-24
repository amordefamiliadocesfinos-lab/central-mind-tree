import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatDisplayDate } from '@/lib/dateUtils';
import {
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FileText,
  Mail,
  MessageCircle,
  ExternalLink,
  Hash,
  Calendar,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IssuedInvoice {
  id: string;
  invoice_number: string | null;
  invoice_type: 'NFe' | 'NFCe' | 'NFSe';
  status: string;
  customer_name: string | null;
  value: number;
  issue_date: string | null;
  access_key: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  contacts?: { name: string; email?: string | null; whatsapp?: string | null; phone?: string | null } | null;
}

interface Props {
  invoice: IssuedInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const formatAccessKey = (key: string) => {
  // 44 dígitos formatados em blocos de 4
  return key.replace(/(.{4})/g, '$1 ').trim();
};

const onlyDigits = (s: string) => s.replace(/\D/g, '');

export function IssuedInvoiceDetails({ invoice, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState<'email' | 'whatsapp'>('email');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');

  if (!invoice) return null;

  const danfeUrl = invoice.pdf_url || (invoice.access_key
    ? `https://www.nfe.fazenda.gov.br/portal/consultaResumoCompleta.aspx?chNFe=${invoice.access_key}`
    : null);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  const downloadDanfe = () => {
    if (invoice.pdf_url) {
      // Força download
      const a = document.createElement('a');
      a.href = invoice.pdf_url;
      a.download = `DANFE-${invoice.invoice_number || invoice.id}.pdf`;
      a.target = '_blank';
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast({
        title: 'DANFE ainda não disponível',
        description: 'O PDF será gerado pelo provedor (Bling) após emissão concluída.',
        variant: 'destructive',
      });
    }
  };

  const downloadXml = () => {
    if (invoice.xml_url) {
      const a = document.createElement('a');
      a.href = invoice.xml_url;
      a.download = `${invoice.invoice_number || invoice.id}.xml`;
      a.target = '_blank';
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast({
        title: 'XML ainda não disponível',
        description: 'O XML será gerado pelo provedor após emissão concluída.',
        variant: 'destructive',
      });
    }
  };

  const openSendDialog = () => {
    const c = invoice.contacts;
    setSendChannel('email');
    setRecipient(c?.email || '');
    setMessage(
      `Olá${c?.name ? `, ${c.name}` : ''}!\n\n` +
        `Segue a Nota Fiscal nº ${invoice.invoice_number || '—'} no valor de ${formatBRL(invoice.value)}.\n` +
        (invoice.access_key ? `Chave: ${invoice.access_key}\n` : '') +
        (invoice.pdf_url ? `DANFE: ${invoice.pdf_url}\n` : '') +
        (invoice.xml_url ? `XML: ${invoice.xml_url}\n` : '') +
        `\nObrigado!`
    );
    setSendOpen(true);
  };

  const handleSend = () => {
    if (!recipient.trim()) {
      toast({ title: 'Informe o destinatário', variant: 'destructive' });
      return;
    }
    if (sendChannel === 'email') {
      const subject = encodeURIComponent(
        `Nota Fiscal ${invoice.invoice_number || ''} - ${invoice.customer_name || ''}`
      );
      const body = encodeURIComponent(message);
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
    } else {
      const phone = onlyDigits(recipient);
      const text = encodeURIComponent(message);
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    }
    toast({ title: 'Enviando ao cliente', description: `${sendChannel === 'email' ? 'E-mail' : 'WhatsApp'} aberto` });
    setSendOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Nota Fiscal Emitida
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Banner verde */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Nota emitida com sucesso
                </div>
                <div className="text-xs text-muted-foreground">
                  Cliente: {invoice.contacts?.name || invoice.customer_name || '—'} ·{' '}
                  {formatBRL(invoice.value)}
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                {invoice.invoice_type}
              </Badge>
            </div>

            {/* Dados fiscais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DataField
                icon={<Hash className="h-4 w-4" />}
                label="Número da nota"
                value={invoice.invoice_number || '—'}
                onCopy={invoice.invoice_number ? () => copy(invoice.invoice_number!, 'Número') : undefined}
                mono
              />
              <DataField
                icon={<Calendar className="h-4 w-4" />}
                label="Data de emissão"
                value={invoice.issue_date ? formatDisplayDate(invoice.issue_date) : '—'}
              />
            </div>

            <DataField
              icon={<KeyRound className="h-4 w-4" />}
              label="Chave fiscal (44 dígitos)"
              value={invoice.access_key ? formatAccessKey(invoice.access_key) : '—'}
              onCopy={invoice.access_key ? () => copy(invoice.access_key!, 'Chave fiscal') : undefined}
              mono
              full
            />

            {/* Arquivos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FileBox
                icon={<FileText className="h-5 w-5 text-red-600" />}
                label="PDF / DANFE"
                available={!!invoice.pdf_url}
                href={invoice.pdf_url}
              />
              <FileBox
                icon={<FileCode2 className="h-5 w-5 text-blue-600" />}
                label="XML"
                available={!!invoice.xml_url}
                href={invoice.xml_url}
              />
            </div>

            {/* Ações principais */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={downloadDanfe} className="gap-2 flex-1 min-w-[180px]">
                <Download className="h-4 w-4" />
                Baixar DANFE
              </Button>
              <Button onClick={downloadXml} variant="outline" className="gap-2 flex-1 min-w-[160px]">
                <FileCode2 className="h-4 w-4" />
                Baixar XML
              </Button>
              <Button onClick={openSendDialog} variant="secondary" className="gap-2 flex-1 min-w-[180px]">
                <Mail className="h-4 w-4" />
                Enviar para cliente
              </Button>
            </div>

            {danfeUrl && (
              <a
                href={danfeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
              >
                <ExternalLink className="h-3 w-3" />
                Consultar nota no portal da SEFAZ
              </a>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de envio */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar nota para o cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={sendChannel === 'email' ? 'default' : 'outline'}
                onClick={() => {
                  setSendChannel('email');
                  setRecipient(invoice.contacts?.email || '');
                }}
                className="gap-2"
              >
                <Mail className="h-4 w-4" /> E-mail
              </Button>
              <Button
                variant={sendChannel === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => {
                  setSendChannel('whatsapp');
                  setRecipient(invoice.contacts?.whatsapp || invoice.contacts?.phone || '');
                }}
                className="gap-2"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <div>
              <Label>{sendChannel === 'email' ? 'E-mail' : 'WhatsApp (com DDD)'}</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={sendChannel === 'email' ? 'cliente@email.com' : '5511999999999'}
              />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="text-xs font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend} className="gap-2">
              <Mail className="h-4 w-4" />
              Enviar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DataField({
  icon,
  label,
  value,
  onCopy,
  mono,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3', full && 'sm:col-span-2')}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={cn('text-sm break-all', mono && 'font-mono')}>{value}</div>
        {onCopy && (
          <Button size="icon" variant="ghost" onClick={onCopy} className="h-7 w-7 shrink-0">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FileBox({
  icon,
  label,
  available,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  available: boolean;
  href: string | null;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex items-center gap-3',
        available ? 'bg-card hover:border-primary/50 transition' : 'bg-muted/30 opacity-70'
      )}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">
          {available ? 'Disponível' : 'Aguardando provedor'}
        </div>
      </div>
      {available && href && (
        <Button size="icon" variant="ghost" asChild className="h-8 w-8">
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}
