'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Report, ReportType } from '@/types/database';
import { REPORT_TYPE_LABELS } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateReportAction } from './actions';

const REPORT_TYPES = Object.keys(REPORT_TYPE_LABELS) as ReportType[];

export function ReportEditForm({ report, clientOptions }: { report: Report; clientOptions: { id: string; name: string }[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(report.client_id);
  const [title, setTitle] = useState(report.title);
  const [type, setType] = useState<ReportType>(report.type);
  const [periodStart, setPeriodStart] = useState(report.period_start ?? '');
  const [periodEnd, setPeriodEnd] = useState(report.period_end ?? '');
  const [summary, setSummary] = useState(report.summary ?? '');
  const [workCompleted, setWorkCompleted] = useState(
    () => report.highlights?.map((h) => h.description || h.title).join('\n') ?? ''
  );
  const [nextActions, setNextActions] = useState(report.next_actions ?? '');
  const [recommendations, setRecommendations] = useState(report.recommendations ?? '');
  const [whatsappText, setWhatsappText] = useState(report.whatsapp_text ?? '');
  const [pdfUrl, setPdfUrl] = useState(report.pdf_url ?? '');
  const [visible, setVisible] = useState(report.visible_to_client);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const formKey = useMemo(() => report.id + report.updated_at, [report.id, report.updated_at]);

  return (
    <form
      key={formKey}
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setPending(true);
        try {
          const fd = new FormData();
          fd.set('client_id', clientId);
          fd.set('title', title);
          fd.set('type', type);
          fd.set('period_start', periodStart);
          fd.set('period_end', periodEnd);
          fd.set('summary', summary);
          fd.set('work_completed', workCompleted);
          fd.set('next_actions', nextActions);
          fd.set('recommendations', recommendations);
          fd.set('whatsapp_text', whatsappText);
          fd.set('pdf_url', pdfUrl);
          fd.append('visible_to_client', visible ? 'true' : 'false');
          const res = await updateReportAction(report.id, fd);
          if (!res.ok) {
            setErr(res.error);
            return;
          }
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label>Client</Label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
        >
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label>Titre</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label>Type</Label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
        >
          {REPORT_TYPES.map((t) => (
            <option key={t} value={t}>
              {REPORT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Début</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Fin</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Synthèse</Label>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="resize-none" />
      </div>
      <div className="grid gap-2">
        <Label>Travail réalisé (une ligne = un point)</Label>
        <Textarea value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} rows={4} className="resize-none" />
      </div>
      <div className="grid gap-2">
        <Label>Prochaines actions</Label>
        <Textarea value={nextActions} onChange={(e) => setNextActions(e.target.value)} rows={2} className="resize-none" />
      </div>
      <div className="grid gap-2">
        <Label>Recommandations</Label>
        <Textarea
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>
      <div className="grid gap-2">
        <Label>Texte WhatsApp</Label>
        <Textarea value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} rows={2} className="resize-none" />
      </div>
      <div className="grid gap-2">
        <Label>URL PDF</Label>
        <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        Visible sur le portail client
      </label>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
