'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReportWhatsappButton({ text }: { text: string | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  if (!text?.trim()) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-full"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setMsg('Copié');
          setTimeout(() => setMsg(null), 2000);
        }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </Button>
      {msg ? <span className="text-[10px] text-primary">{msg}</span> : null}
    </div>
  );
}
