'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote, QuoteItem, QuoteStrategicBlock } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateQuoteWithItemsAction } from './actions';

function BuilderSection({
  id,
  step,
  title,
  hint,
  children,
}: {
  id: string;
  step: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-xl border border-border/80 bg-card/50 p-5"
    >
      <header className="mb-4 border-b border-border/60 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{step}</p>
        <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

type Line = {
  service_name: string;
  detail_text: string;
  quantity: number;
  unit: string;
  unit_price: number;
  is_optional: boolean;
  is_recommended: boolean;
  strategic_explanation: string;
};

function itemToLine(i: QuoteItem): Line {
  return {
    service_name: (i.service_name || i.description).trim() || 'Prestation',
    detail_text: i.detail_text ?? '',
    quantity: Number(i.quantity),
    unit: i.unit ?? '',
    unit_price: Number(i.unit_price),
    is_optional: i.is_optional === true,
    is_recommended: i.is_recommended === true,
    strategic_explanation: i.strategic_explanation ?? '',
  };
}

export function QuoteEditForm({
  quote,
  items,
  canEdit,
}: {
  quote: Quote;
  items: QuoteItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() =>
    items.length
      ? items.map(itemToLine)
      : [
          {
            service_name: 'Prestation',
            detail_text: '',
            quantity: 1,
            unit: '',
            unit_price: 0,
            is_optional: false,
            is_recommended: false,
            strategic_explanation: '',
          },
        ]
  );
  const [strategicBlocks, setStrategicBlocks] = useState<QuoteStrategicBlock[]>(() =>
    quote.strategic_value_blocks?.length ? quote.strategic_value_blocks : []
  );

  const [proposalTitle, setProposalTitle] = useState(quote.proposal_title ?? '');
  const [packageName, setPackageName] = useState(quote.package_name ?? '');
  const [projectObject, setProjectObject] = useState(quote.project_object ?? '');
  const [strategicPositioning, setStrategicPositioning] = useState(quote.strategic_positioning ?? '');
  const [conditions, setConditions] = useState(quote.conditions ?? '');
  const [executionAssumptions, setExecutionAssumptions] = useState(quote.execution_assumptions ?? '');
  const [commercialRecommendation, setCommercialRecommendation] = useState(
    quote.commercial_recommendation ?? ''
  );
  const [promotionalLabel, setPromotionalLabel] = useState(quote.promotional_label ?? '');
  const [promotionalTerms, setPromotionalTerms] = useState(quote.promotional_terms ?? '');
  const [adsBudgetNote, setAdsBudgetNote] = useState(quote.ads_budget_note ?? '');
  const [maintenanceNote, setMaintenanceNote] = useState(quote.maintenance_note ?? '');
  const [revisionPolicyNote, setRevisionPolicyNote] = useState(quote.revision_policy_note ?? '');
  const [paymentTerms, setPaymentTerms] = useState(quote.payment_terms ?? '');
  const [firstMonthTotal, setFirstMonthTotal] = useState(
    quote.first_month_total != null ? String(quote.first_month_total) : ''
  );
  const [recurringMonthly, setRecurringMonthly] = useState(
    quote.recurring_monthly_total != null ? String(quote.recurring_monthly_total) : ''
  );
  const [commitmentMonths, setCommitmentMonths] = useState(
    quote.commitment_months != null ? String(quote.commitment_months) : ''
  );

  const [taxRate, setTaxRate] = useState(String(quote.tax_rate));
  const [discountMode, setDiscountMode] = useState(quote.discount_mode === 'percent' ? 'percent' : 'fixed');
  const [discount, setDiscount] = useState(String(quote.discount));
  const [discountPercent, setDiscountPercent] = useState(
    quote.discount_percent != null ? String(quote.discount_percent) : ''
  );
  const [validUntil, setValidUntil] = useState(quote.valid_until);
  const [currency, setCurrency] = useState(quote.currency);
  const [template, setTemplate] = useState(quote.template || 'supra_premium_black_orange');
  const [notes, setNotes] = useState(quote.notes ?? '');
  const [visible, setVisible] = useState(quote.visible_to_client);
  const [includeSignature, setIncludeSignature] = useState(quote.include_signature_block !== false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const tr = Number(taxRate) || 0;
    const tax = Math.round(subtotal * (tr / 100) * 100) / 100;
    const mode = discountMode === 'percent' ? 'percent' : 'fixed';
    const fixedDisc = Number(discount) || 0;
    const pct = Number(discountPercent) || 0;
    const disc =
      mode === 'percent' && pct > 0 ? Math.round((subtotal + tax) * (pct / 100) * 100) / 100 : fixedDisc;
    const total = Math.round((subtotal + tax - disc) * 100) / 100;
    return { subtotal, tax, discount: disc, total };
  }, [lines, taxRate, discount, discountPercent, discountMode]);

  if (!canEdit) {
    if (quote.status === 'converted') {
      return (
        <p className="text-sm text-muted-foreground">
          Ce devis est converti — les montants et lignes ne sont plus modifiables ici.
        </p>
      );
    }
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">Lecture seule — votre rôle ne permet pas la modification des devis.</p>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 px-4 py-2">
              <span className="text-foreground">
                {i.service_name || i.description}
                {i.is_recommended ? (
                  <span className="ml-2 text-xs text-primary">Recommandé</span>
                ) : null}
                {i.is_optional ? <span className="ml-2 text-xs text-muted-foreground">Option</span> : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {i.quantity} × {i.unit_price.toLocaleString('fr-FR')} = {i.total.toLocaleString('fr-FR')}{' '}
                {quote.currency}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      className="grid gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setPending(true);
        try {
          const fd = new FormData();
          fd.set('proposal_title', proposalTitle);
          fd.set('package_name', packageName);
          fd.set('project_object', projectObject);
          fd.set('strategic_positioning', strategicPositioning);
          fd.set('conditions', conditions);
          fd.set('execution_assumptions', executionAssumptions);
          fd.set('commercial_recommendation', commercialRecommendation);
          fd.set('promotional_label', promotionalLabel);
          fd.set('promotional_terms', promotionalTerms);
          fd.set('ads_budget_note', adsBudgetNote);
          fd.set('maintenance_note', maintenanceNote);
          fd.set('revision_policy_note', revisionPolicyNote);
          fd.set('payment_terms', paymentTerms);
          fd.set('first_month_total', firstMonthTotal);
          fd.set('recurring_monthly_total', recurringMonthly);
          fd.set('commitment_months', commitmentMonths);
          fd.set('tax_rate', taxRate);
          fd.set('discount_mode', discountMode);
          fd.set('discount', discount);
          fd.set('discount_percent', discountPercent);
          fd.set('valid_until', validUntil);
          fd.set('currency', currency);
          fd.set('template', template);
          fd.set('notes', notes);
          fd.set('strategic_blocks_json', JSON.stringify(strategicBlocks));
          fd.append('visible_to_client', visible ? 'true' : 'false');
          fd.append('include_signature_block', includeSignature ? 'true' : 'false');
          const payload = lines.map((l) => ({
            service_name: l.service_name,
            description: l.service_name,
            detail_text: l.detail_text.trim() || null,
            quantity: l.quantity,
            unit: l.unit || null,
            unit_price: l.unit_price,
            is_optional: l.is_optional,
            is_recommended: l.is_recommended,
            strategic_explanation: l.strategic_explanation.trim() || null,
          }));
          fd.set('lines_json', JSON.stringify(payload));
          const res = await updateQuoteWithItemsAction(quote.id, fd);
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
      <nav
        aria-label="Sections du constructeur"
        className="sticky top-2 z-10 rounded-xl border border-primary/25 bg-surface-secondary/95 px-4 py-3 backdrop-blur-sm"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary">Accès rapide</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <li>
            <a href="#qb-header" className="hover:text-foreground">
              En-tête
            </a>
          </li>
          <li>
            <a href="#qb-framing" className="hover:text-foreground">
              Cadrage
            </a>
          </li>
          <li>
            <a href="#qb-lines" className="hover:text-foreground">
              Prestations
            </a>
          </li>
          <li>
            <a href="#qb-pricing" className="hover:text-foreground">
              Offre & remise
            </a>
          </li>
          <li>
            <a href="#qb-strategic" className="hover:text-foreground">
              Apports
            </a>
          </li>
          <li>
            <a href="#qb-close" className="hover:text-foreground">
              Clôture PDF
            </a>
          </li>
          <li>
            <a href="#qb-internal" className="font-medium text-primary hover:underline">
              Notes internes
            </a>
          </li>
        </ul>
      </nav>

      <BuilderSection
        id="qb-header"
        step="A — En-tête"
        title="Identité de la proposition"
        hint="Ce qui apparaît sur la couverture du PDF : titre, offre, objet, positionnement, dates et modèle graphique."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Titre de la proposition</Label>
            <Input
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              placeholder="Proposition commerciale"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Nom du forfait / offre</Label>
            <Input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="Ex. Acquisition & visibilité"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Objet</Label>
            <Textarea
              value={projectObject}
              onChange={(e) => setProjectObject(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="Contexte et périmètre du projet"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Positionnement stratégique</Label>
            <Textarea
              value={strategicPositioning}
              onChange={(e) => setStrategicPositioning(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Valide jusqu&apos;au</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Devise</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Modèle PDF</Label>
            <select
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="supra_premium_black_orange">Supra Premium Noir & Orange</option>
            </select>
            <p className="text-xs text-muted-foreground">
              D’autres styles (minimal clair, luxe, campagne…) pourront être branchés sur cette clé.
            </p>
          </div>
        </div>
      </BuilderSection>

      <BuilderSection
        id="qb-framing"
        step="B — Cadrage commercial"
        title="Modalités, hypothèses et limites"
        hint="Alimente les pages « cadre d’exécution » et « règlement » du PDF. Rédigez des phrases nettes : budget média hors prestation, hors-scope, délais de validation."
      >
        <div className="grid gap-2">
          <Label>Conditions générales / modalités</Label>
          <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} className="resize-none" />
        </div>
        <div className="grid gap-2">
          <Label>Hypothèses & périmètre d&apos;exécution</Label>
          <Textarea
            value={executionAssumptions}
            onChange={(e) => setExecutionAssumptions(e.target.value)}
            rows={4}
            className="resize-none"
            placeholder="Budget média, SEO optionnel, hors-scope, etc."
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Note budget publicitaire</Label>
            <Textarea
              value={adsBudgetNote}
              onChange={(e) => setAdsBudgetNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Note maintenance</Label>
            <Textarea
              value={maintenanceNote}
              onChange={(e) => setMaintenanceNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Révisions / allers-retours</Label>
          <Textarea
            value={revisionPolicyNote}
            onChange={(e) => setRevisionPolicyNote(e.target.value)}
            rows={2}
            className="resize-none"
          />
        </div>
        <div className="grid gap-2">
          <Label>Modalités de paiement (PDF)</Label>
          <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2} className="resize-none" />
        </div>
      </BuilderSection>

      <BuilderSection
        id="qb-lines"
        step="C — Prestations"
        title="Tableau d’investissement"
        hint="Chaque ligne = une ligne du PDF. Cochez option ou recommandé pour le distinguer visuellement. Renseignez l’apport concret pour la page « valeur ajoutée » si vous n’utilisez pas les blocs globaux."
      >
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="grid gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0"
          >
            <div className="grid gap-2 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <Label>Prestation</Label>
                <Input
                  value={line.service_name}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], service_name: e.target.value };
                    setLines(next);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Qté</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                    setLines(next);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Unité</Label>
                <Input
                  value={line.unit}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], unit: e.target.value };
                    setLines(next);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Prix unit.</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.unit_price}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], unit_price: Number(e.target.value) || 0 };
                    setLines(next);
                  }}
                />
              </div>
              <div className="flex flex-col justify-end gap-2 sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={lines.length <= 1}
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Détails (PDF)</Label>
              <Textarea
                value={line.detail_text}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], detail_text: e.target.value };
                  setLines(next);
                }}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid gap-2">
              <Label>Valeur stratégique (PDF — apport concret)</Label>
              <Textarea
                value={line.strategic_explanation}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], strategic_explanation: e.target.value };
                  setLines(next);
                }}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={line.is_optional}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], is_optional: e.target.checked };
                    setLines(next);
                  }}
                />
                Option / hors forfait de base
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={line.is_recommended}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], is_recommended: e.target.checked };
                    setLines(next);
                  }}
                />
                Ligne recommandée (ex. SEO)
              </label>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit rounded-full"
          onClick={() =>
            setLines([
              ...lines,
              {
                service_name: 'Prestation',
                detail_text: '',
                quantity: 1,
                unit: '',
                unit_price: 0,
                is_optional: false,
                is_recommended: false,
                strategic_explanation: '',
              },
            ])
          }
        >
          + Prestation
        </Button>
      </BuilderSection>

      <BuilderSection
        id="qb-pricing"
        step="D — Offre & montants"
        title="Fiscalité, remise et mise en avant"
        hint="La remise en pourcentage s’applique sur la base HT + TVA. Les champs « premier mois » et « récurrent » sont indicatifs sur le PDF (offres packagées, lancement)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>TVA %</Label>
            <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} type="number" step={0.01} min={0} />
          </div>
          <div className="grid gap-2">
            <Label>Type de remise</Label>
            <select
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
              value={discountMode}
              onChange={(e) => setDiscountMode(e.target.value as 'fixed' | 'percent')}
            >
              <option value="fixed">Montant fixe (après TVA dans le calcul affiché)</option>
              <option value="percent">Pourcentage sur (HT + TVA)</option>
            </select>
          </div>
          {discountMode === 'percent' ? (
            <div className="grid gap-2">
              <Label>Remise %</Label>
              <Input
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                type="number"
                step={0.01}
                min={0}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Remise (montant)</Label>
              <Input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" step={0.01} min={0} />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Libellé promotionnel (PDF)</Label>
            <Input
              value={promotionalLabel}
              onChange={(e) => setPromotionalLabel(e.target.value)}
              placeholder="Ex. Offre de lancement"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Conditions promotionnelles</Label>
            <Textarea
              value={promotionalTerms}
              onChange={(e) => setPromotionalTerms(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Premier mois (indicatif TTC)</Label>
            <Input value={firstMonthTotal} onChange={(e) => setFirstMonthTotal(e.target.value)} type="number" step={0.01} min={0} />
          </div>
          <div className="grid gap-2">
            <Label>Récurrent mensuel (indicatif)</Label>
            <Input value={recurringMonthly} onChange={(e) => setRecurringMonthly(e.target.value)} type="number" step={0.01} min={0} />
          </div>
          <div className="grid gap-2">
            <Label>Engagement (mois)</Label>
            <Input value={commitmentMonths} onChange={(e) => setCommitmentMonths(e.target.value)} type="number" step={1} min={0} />
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
          <p className="text-muted-foreground">
            Sous-total HT :{' '}
            <span className="font-semibold text-foreground">
              {preview.subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
            </span>
          </p>
          <p className="text-muted-foreground">
            TVA :{' '}
            <span className="font-semibold text-foreground">
              {preview.tax.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
            </span>
          </p>
          <p className="text-muted-foreground">
            Remise :{' '}
            <span className="font-semibold text-foreground">
              {preview.discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
            </span>
          </p>
          <p className="mt-1 text-foreground">
            Total TTC :{' '}
            <span className="text-lg font-semibold text-primary">
              {preview.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
            </span>
          </p>
        </div>
      </BuilderSection>

      <BuilderSection
        id="qb-strategic"
        step="E — Apports stratégiques"
        title="Blocs « valeur ajoutée » (PDF)"
        hint="Optionnel si chaque prestation a déjà son texte d’apport. Sinon, ces blocs structurent la page dédiée avec un ton plus macro."
      >
        {strategicBlocks.map((b, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-border/60 p-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setStrategicBlocks(strategicBlocks.filter((_, i) => i !== idx))}
              >
                Retirer
              </Button>
            </div>
            <Label>Titre</Label>
            <Input
              value={b.title}
              onChange={(e) => {
                const next = [...strategicBlocks];
                next[idx] = { ...next[idx], title: e.target.value };
                setStrategicBlocks(next);
              }}
            />
            <Label>Texte</Label>
            <Textarea
              value={b.body}
              onChange={(e) => {
                const next = [...strategicBlocks];
                next[idx] = { ...next[idx], body: e.target.value };
                setStrategicBlocks(next);
              }}
              rows={3}
              className="resize-none"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit rounded-full"
          onClick={() => setStrategicBlocks([...strategicBlocks, { title: '', body: '' }])}
        >
          + Bloc stratégique
        </Button>
      </BuilderSection>

      <BuilderSection
        id="qb-close"
        step="F — Clôture commerciale"
        title="Recommandation et bon pour accord"
        hint="Texte affiché avant la signature sur le PDF. Le bloc légal « bon pour accord » peut être masqué pour les brouillons internes."
      >
        <div className="grid gap-2">
          <Label>Recommandation commerciale (PDF)</Label>
          <Textarea
            value={commercialRecommendation}
            onChange={(e) => setCommercialRecommendation(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={includeSignature} onChange={(e) => setIncludeSignature(e.target.checked)} />
          Afficher le cadre « Bon pour accord » et les lignes de signature sur le PDF
        </label>
      </BuilderSection>

      <section
        id="qb-internal"
        className="scroll-mt-28 rounded-xl border-2 border-primary/35 bg-secondary/55 p-5"
      >
        <header className="mb-4 border-b border-[rgba(255,61,10,0.2)] pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Réservé équipe</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">Notes internes & diffusion portail</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Ce qui suit n&apos;apparaît ni sur le PDF client ni dans les réponses API portail. Utilisez-le pour marges,
            historique de négociation ou consignes internes.
          </p>
        </header>
        <div className="grid gap-2">
          <Label>Notes internes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="resize-none border-primary/20 bg-background/70"
            placeholder="Visible uniquement dans l’app (équipe connectée)."
          />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Publier sur le portail client (liste + PDF sécurisé ; jamais les notes ci-dessus)
        </label>
      </section>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer la proposition'}
      </Button>
    </form>
  );
}
