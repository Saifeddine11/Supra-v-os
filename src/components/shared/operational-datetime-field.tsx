'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import {
  getMinOperationalDatetimeLocal,
  validateOperationalFutureDate,
} from '@/lib/dates/validate-future-date';

type OperationalDatetimeFieldProps = {
  id: string;
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  allowEmpty?: boolean;
  hint?: string;
  /** Stored value on edit — unchanged past dates stay valid for other field updates. */
  unchangedBaseline?: string;
};

export function OperationalDatetimeField({
  id,
  name,
  label,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  className,
  inputClassName,
  required,
  allowEmpty = true,
  hint,
  unchangedBaseline,
}: OperationalDatetimeFieldProps) {
  const controlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const value = controlled ? valueProp : internal;
  const min = getMinOperationalDatetimeLocal();

  useEffect(() => {
    if (!controlled) setInternal(defaultValue);
  }, [controlled, defaultValue]);

  const validate = useCallback(
    (next: string) => {
      const result = validateOperationalFutureDate(next, {
        allowEmpty,
        mode: 'datetime',
        unchangedFrom: unchangedBaseline,
      });
      setError(result.ok ? null : result.message);
      return result.ok;
    },
    [allowEmpty, unchangedBaseline],
  );

  function handleChange(next: string) {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
    if (next.trim()) validate(next);
    else setError(null);
  }

  return (
    <div className={cn('grid gap-2', className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Input
        id={id}
        name={name}
        type="datetime-local"
        min={min}
        required={required}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : defaultValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => {
          if (e.target.value.trim()) validate(e.target.value);
        }}
        className={cn(inputClassName, error && 'border-destructive')}
        aria-invalid={error ? true : undefined}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Client-side guard before server action — returns error message or null. */
export function getOperationalDatetimeSubmitError(
  value: string | null | undefined,
  options?: { allowEmpty?: boolean; unchangedFrom?: string | null },
): string | null {
  const result = validateOperationalFutureDate(value, {
    allowEmpty: options?.allowEmpty ?? true,
    mode: 'datetime',
    unchangedFrom: options?.unchangedFrom,
  });
  return result.ok ? null : result.message;
}
