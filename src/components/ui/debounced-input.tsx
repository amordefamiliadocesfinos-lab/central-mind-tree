import * as React from 'react';
import { Input } from './input';
import { Textarea } from './textarea';

/**
 * Debounced controlled input/textarea.
 * Keeps local state while user types and only flushes onChange after `delay` ms.
 * Fixes input lag caused by remote-syncing parents (e.g. Supabase realtime refetches).
 */
type CommonProps = {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  delay?: number;
};

export const DebouncedInput = React.forwardRef<
  HTMLInputElement,
  CommonProps & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>
>(({ value, onChange, delay = 400, onBlur, ...props }, ref) => {
  const [local, setLocal] = React.useState<string>(value == null ? '' : String(value));
  const focused = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = React.useRef<string>(value == null ? '' : String(value));

  // Sync from parent only when not focused (avoid clobbering user typing)
  React.useEffect(() => {
    const v = value == null ? '' : String(value);
    if (!focused.current && v !== local) {
      setLocal(v);
      lastSent.current = v;
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = React.useCallback((val: string) => {
    if (val !== lastSent.current) {
      lastSent.current = val;
      onChange(val);
    }
  }, [onChange]);

  return (
    <Input
      ref={ref}
      {...props}
      value={local}
      onFocus={(e) => { focused.current = true; props.onFocus?.(e); }}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(v), delay);
      }}
      onBlur={(e) => {
        focused.current = false;
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        flush(local);
        onBlur?.(e);
      }}
    />
  );
});
DebouncedInput.displayName = 'DebouncedInput';

export const DebouncedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  CommonProps & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'>
>(({ value, onChange, delay = 400, onBlur, ...props }, ref) => {
  const [local, setLocal] = React.useState<string>(value == null ? '' : String(value));
  const focused = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = React.useRef<string>(value == null ? '' : String(value));

  React.useEffect(() => {
    const v = value == null ? '' : String(value);
    if (!focused.current && v !== local) {
      setLocal(v);
      lastSent.current = v;
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = React.useCallback((val: string) => {
    if (val !== lastSent.current) {
      lastSent.current = val;
      onChange(val);
    }
  }, [onChange]);

  return (
    <Textarea
      ref={ref}
      {...props}
      value={local}
      onFocus={(e) => { focused.current = true; props.onFocus?.(e); }}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(v), delay);
      }}
      onBlur={(e) => {
        focused.current = false;
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        flush(local);
        onBlur?.(e);
      }}
    />
  );
});
DebouncedTextarea.displayName = 'DebouncedTextarea';
