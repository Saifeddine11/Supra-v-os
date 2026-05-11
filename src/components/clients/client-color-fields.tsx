'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { CLIENT_FALLBACK_PALETTE, getClientColor, getClientColorFromName, normalizeHexColor } from '@/lib/ui/client-colors';
import { cn } from '@/lib/utils/cn';

export function ClientColorFields({
  previewName,
  defaultHex,
  defaultLabel,
}: {
  /** Nom client pour aperçu / fallback quand le hex est vide. */
  previewName: string;
  defaultHex?: string | null;
  defaultLabel?: string | null;
}) {
  const initialHex = normalizeHexColor(defaultHex ?? null) ?? '';
  const [hexInput, setHexInput] = useState(initialHex ? defaultHex!.trim() : '');
  const [label, setLabel] = useState(defaultLabel?.trim() ?? '');

  useEffect(() => {
    setHexInput(initialHex ? (defaultHex ?? '').trim() : '');
    setLabel(defaultLabel?.trim() ?? '');
  }, [defaultHex, defaultLabel, initialHex]);

  const normalized = useMemo(() => normalizeHexColor(hexInput), [hexInput]);
  const previewHex = useMemo(() => {
    if (normalized) return normalized;
    return getClientColorFromName(previewName.trim() || 'Client');
  }, [normalized, previewName]);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 border-l-2 border-l-primary/40 bg-muted/15 p-4 dark:bg-muted/10">
      <div>
        <Label className="text-foreground">Couleur client</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Cette couleur sera utilisée dans les tâches, vidéos, calendriers et documents liés à ce client. Elle complète
          les pastilles de statut (retard, urgence) sans les remplacer.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ClientColorDot hex={previewHex} size="md" className="h-8 w-8 ring-2" title="Aperçu" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Nuancier</span>
            <input
              type="color"
              className="h-10 w-full max-w-[120px] cursor-pointer rounded-lg border border-border bg-background"
              value={normalized ?? '#6366F1'}
              onChange={(e) => setHexInput(e.target.value)}
              aria-label="Choisir une couleur"
            />
          </div>
          <div className="grid min-w-0 flex-1 gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hex</span>
            <Input
              placeholder="#8B5CF6"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              className="font-mono text-sm"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Raccourcis</span>
        <div className="flex flex-wrap gap-2">
          {CLIENT_FALLBACK_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                'rounded-full p-0.5 ring-2 ring-offset-2 ring-offset-background transition',
                normalized === c ? 'ring-primary' : 'ring-transparent hover:ring-border',
              )}
              onClick={() => setHexInput(c)}
              aria-label={`Couleur ${c}`}
            >
              <span className="block h-6 w-6 rounded-full border border-border/50" style={{ backgroundColor: c }} />
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={() => setHexInput('')}>
            Auto (nom)
          </Button>
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="color_label" className="text-xs text-muted-foreground">
          Libellé interne (optionnel)
        </Label>
        <Input
          id="color_label"
          name="color_label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex. Violet marque, Bleu immobilier"
          maxLength={80}
        />
      </div>
      <input type="hidden" name="color_hex" value={normalized ?? ''} />
      <p className="text-[11px] text-muted-foreground">
        Teinte effective (sauvegarde) :{' '}
        <span className="font-mono font-medium text-foreground">
          {getClientColor({ name: previewName, color_hex: normalized })}
        </span>
      </p>
    </div>
  );
}
