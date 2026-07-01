import { useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';
import { AddToRoutineDialog, AddToRoutineSource } from './AddToRoutineDialog';

interface Props extends Omit<ButtonProps, 'onClick'> {
  source: AddToRoutineSource;
  defaultTitle?: string;
  defaultFocus?: string;
  defaultDurationMin?: number;
  defaultNotes?: string;
  label?: string;
  iconOnly?: boolean;
}

export function AddToRoutineButton({
  source, defaultTitle, defaultFocus, defaultDurationMin, defaultNotes,
  label = 'Adicionar à Rotina', iconOnly = false,
  variant = 'outline', size = 'sm', className, ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? 'icon' : size}
        className={className}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={label}
        {...rest}
      >
        <CalendarPlus className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 mr-1'} />
        {!iconOnly && label}
      </Button>
      <AddToRoutineDialog
        open={open}
        onOpenChange={setOpen}
        source={source}
        defaultTitle={defaultTitle}
        defaultFocus={defaultFocus}
        defaultDurationMin={defaultDurationMin}
        defaultNotes={defaultNotes}
      />
    </>
  );
}
