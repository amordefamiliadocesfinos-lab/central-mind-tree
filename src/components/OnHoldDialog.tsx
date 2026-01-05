import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { OnHoldFormData } from "@/hooks/useOnHold";

interface OnHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: OnHoldFormData) => void;
  taskTitle: string;
}

export const OnHoldDialog = ({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
}: OnHoldDialogProps) => {
  const [formData, setFormData] = useState<OnHoldFormData>({
    who: "",
    channel: "",
    deadline: null,
    note: "",
  });

  const handleConfirm = () => {
    onConfirm(formData);
    setFormData({ who: "", channel: "", deadline: null, note: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como Em Espera</DialogTitle>
          <DialogDescription>
            Tarefa: {taskTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Aguardando quem?</label>
            <Input
              placeholder="Ex: Cliente, Fornecedor, João..."
              value={formData.who}
              onChange={(e) => setFormData({ ...formData, who: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Canal de contato</label>
            <Input
              placeholder="Ex: WhatsApp, E-mail, Telefone..."
              value={formData.channel}
              onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prazo para retorno</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !formData.deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deadline 
                      ? format(formData.deadline, "dd/MM/yyyy", { locale: ptBR }) 
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.deadline || undefined}
                    onSelect={(date) => setFormData({ ...formData, deadline: date || null })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {formData.deadline && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFormData({ ...formData, deadline: null })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nota</label>
            <Textarea
              placeholder="Observações adicionais..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
