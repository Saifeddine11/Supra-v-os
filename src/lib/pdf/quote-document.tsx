import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Quote, QuoteItem } from '@/types/database';
import { QUOTE_PDF_COPY } from '@/lib/pdf/quote-pdf-copy';
import { agencyCurrencyDisplaySuffix, formatAgencyMoney, normalizeAgencyCurrency } from '@/lib/money/format-money';

const ORANGE = '#FF3D0A';
const ORANGE_ALT = '#FF450F';
const ORANGE_GLOW = '#FF6A2A';
const BLACK = '#080706';
const BROWN_BLACK = '#1A0703';
const CARD = '#11100F';
const SURFACE = '#181513';
const CREAM = '#F8F4EF';
const MUTED = '#A8A19A';
const LINE_SOFT = 'rgba(248, 244, 239, 0.09)';

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: CREAM,
    backgroundColor: BLACK,
  },
  coverTopBand: {
    marginTop: -48,
    marginHorizontal: -48,
    marginBottom: 28,
  },
  bandBrown: {
    height: 7,
    backgroundColor: BROWN_BLACK,
  },
  bandAccent: {
    height: 3,
    width: 72,
    backgroundColor: ORANGE,
  },
  bandAccentThin: {
    height: 1,
    width: 48,
    backgroundColor: ORANGE_ALT,
    marginLeft: 10,
    marginBottom: 2,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
  },
  brand: {
    fontSize: 23,
    fontFamily: 'Helvetica-Bold',
    color: CREAM,
    letterSpacing: 0.2,
  },
  brandSub: {
    marginTop: 6,
    fontSize: 7.5,
    color: ORANGE_GLOW,
    letterSpacing: 3.2,
    textTransform: 'uppercase' as const,
  },
  docTypeMuted: {
    textAlign: 'right' as const,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
  },
  docTypeMain: {
    marginTop: 8,
    textAlign: 'right' as const,
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE,
    letterSpacing: 0.2,
  },
  h1: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: CREAM,
    marginBottom: 8,
    lineHeight: 1.22,
  },
  packagePill: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE_SOFT,
  },
  packagePillText: {
    fontSize: 8.5,
    color: CREAM,
    letterSpacing: 0.4,
    fontFamily: 'Helvetica-Bold',
  },
  body: {
    fontSize: 9.5,
    color: MUTED,
    lineHeight: 1.58,
    marginBottom: 12,
  },
  bodyEmphasis: {
    fontSize: 9.5,
    color: CREAM,
    lineHeight: 1.55,
    marginBottom: 10,
  },
  metaGrid: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: LINE_SOFT,
    backgroundColor: CARD,
  },
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(248, 244, 239, 0.05)',
  },
  metaKey: {
    width: '30%',
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    borderRightWidth: 1,
    borderRightColor: 'rgba(248, 244, 239, 0.05)',
  },
  metaVal: {
    width: '70%',
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 9.5,
    color: CREAM,
    lineHeight: 1.5,
  },
  refBar: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LINE_SOFT,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  refMuted: {
    fontSize: 7.5,
    color: MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.1,
  },
  refStrong: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE_ALT,
    marginTop: 4,
  },
  pageHeaderBar: {
    marginHorizontal: -48,
    marginTop: -48,
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 48,
    backgroundColor: BROWN_BLACK,
    borderBottomWidth: 2,
    borderBottomColor: ORANGE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  pageHeaderBrand: {
    fontSize: 8,
    color: ORANGE_GLOW,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    fontFamily: 'Helvetica-Bold',
  },
  pageHeaderRef: {
    fontSize: 9,
    color: CREAM,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },
  pageHeaderRight: {
    alignItems: 'flex-end',
  },
  pageHeaderMuted: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
  },
  sectionRule: {
    width: 4,
    height: 22,
    backgroundColor: ORANGE,
    marginRight: 12,
  },
  h2: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: CREAM,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  sectionLead: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.52,
    marginBottom: 16,
    marginTop: -4,
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: ORANGE_ALT,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(248, 244, 239, 0.07)',
  },
  trHighlight: {
    backgroundColor: 'rgba(255, 69, 15, 0.07)',
  },
  tdService: { width: '27%', paddingRight: 6 },
  tdDetail: { width: '43%', paddingRight: 10 },
  tdPrice: { width: '30%', textAlign: 'right' as const },
  badge: {
    marginTop: 4,
    fontSize: 6.5,
    color: ORANGE_GLOW,
    letterSpacing: 0.6,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase' as const,
  },
  totalsWrap: {
    marginTop: 22,
    paddingLeft: 14,
    borderLeftWidth: 4,
    borderLeftColor: ORANGE_ALT,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE_SOFT,
    paddingVertical: 16,
    paddingRight: 16,
  },
  totalsTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: CREAM,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  totalsSub: {
    fontSize: 7.5,
    color: MUTED,
    marginBottom: 12,
    lineHeight: 1.4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  totalLabel: {
    width: 148,
    textAlign: 'right' as const,
    color: MUTED,
    fontSize: 8.5,
    paddingRight: 14,
  },
  totalValue: {
    width: 96,
    textAlign: 'right' as const,
    fontSize: 9.5,
    color: CREAM,
    fontFamily: 'Helvetica-Bold',
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: ORANGE,
  },
  promoBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: BROWN_BLACK,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
  },
  blockCard: {
    marginBottom: 14,
    padding: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE_SOFT,
  },
  blockTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE_ALT,
    marginBottom: 8,
  },
  assumptionPara: {
    marginBottom: 10,
    fontSize: 9.5,
    color: CREAM,
    lineHeight: 1.55,
  },
  signFrame: {
    marginTop: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 15, 0.35)',
    backgroundColor: BROWN_BLACK,
  },
  signTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  signBody: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.52,
    marginBottom: 14,
  },
  signLine: {
    marginTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: MUTED,
    width: '58%',
  },
  pageFoot: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 7,
    color: MUTED,
    textAlign: 'center' as const,
    borderTopWidth: 0.5,
    borderTopColor: LINE_SOFT,
    paddingTop: 8,
  },
});

function lineLabel(item: QuoteItem) {
  const name = (item.service_name || item.description).trim();
  return name || 'Prestation';
}

function lineDetail(item: QuoteItem) {
  const d = (item.detail_text ?? '').trim();
  return d || '—';
}

function PageHeader({ agencyName, quoteRef }: { agencyName: string; quoteRef: string }) {
  return (
    <View style={styles.pageHeaderBar}>
      <View>
        <Text style={styles.pageHeaderBrand}>{agencyName}</Text>
        <Text style={styles.pageHeaderRef}>{quoteRef}</Text>
      </View>
      <View style={styles.pageHeaderRight}>
        <Text style={styles.pageHeaderMuted}>{QUOTE_PDF_COPY.docType}</Text>
      </View>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionRule} />
      <Text style={styles.h2}>{title}</Text>
    </View>
  );
}

export function QuotePdfDocument({
  quote,
  items,
  client,
  agencyName = 'Supra v.',
  /** Devise d’affichage globale (Paramètres agence) — sans conversion de montants. */
  displayCurrency,
}: {
  quote: Quote;
  items: QuoteItem[];
  client: { name: string };
  agencyName?: string;
  displayCurrency?: string | null;
}) {
  const cur = normalizeAgencyCurrency(displayCurrency ?? quote.currency);
  const fmtPdf = (n: number) => formatAgencyMoney(n, cur);
  const subtitleCurrency = agencyCurrencyDisplaySuffix(cur);

  const title = (quote.proposal_title ?? '').trim() || QUOTE_PDF_COPY.docType;
  const packageName = (quote.package_name ?? '').trim();
  const positioning = (quote.strategic_positioning ?? '').trim();
  const objectText = (quote.project_object ?? '').trim();
  const conditions = (quote.conditions ?? '').trim();

  const blocks = quote.strategic_value_blocks ?? [];
  const itemExplanations = items
    .map((i) => ({
      title: lineLabel(i),
      body: (i.strategic_explanation ?? '').trim(),
    }))
    .filter((x) => x.body.length > 0);

  const mergedStrategic =
    blocks.length > 0
      ? blocks
      : itemExplanations.length > 0
        ? itemExplanations.map((x) => ({ title: x.title, body: x.body }))
        : [];

  const hasStrategicPage = mergedStrategic.length > 0;

  const executionCore = (quote.execution_assumptions ?? '').trim();
  const ads = (quote.ads_budget_note ?? '').trim();
  const maint = (quote.maintenance_note ?? '').trim();
  const rev = (quote.revision_policy_note ?? '').trim();
  const pay = (quote.payment_terms ?? '').trim();

  const executionParagraphs: string[] = [];
  if (executionCore) executionParagraphs.push(...executionCore.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
  if (ads) executionParagraphs.push(ads);
  if (maint) executionParagraphs.push(maint);
  if (rev) executionParagraphs.push(rev);

  const recommendation = (quote.commercial_recommendation ?? '').trim();

  const promoLabel = (quote.promotional_label ?? '').trim();
  const promoTerms = (quote.promotional_terms ?? '').trim();
  const firstMonth = quote.first_month_total != null ? Number(quote.first_month_total) : null;
  const recurring = quote.recurring_monthly_total != null ? Number(quote.recurring_monthly_total) : null;
  const commitment = quote.commitment_months != null ? Number(quote.commitment_months) : null;

  const subtotal = Number(quote.subtotal);
  const tax = Number(quote.tax_amount);
  const discount = Number(quote.discount);
  const total = Number(quote.total);
  const totalBeforeDiscount = Math.round((subtotal + tax) * 100) / 100;

  const coverIntro = positioning || QUOTE_PDF_COPY.coverIntroFallback;

  const footerText = (pageNumber: number, totalPages: number) =>
    `${agencyName} · ${quote.ref} · ${pageNumber} / ${totalPages}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.coverTopBand}>
          <View style={styles.bandBrown} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 28 }}>
          <View style={styles.bandAccent} />
          <View style={styles.bandAccentThin} />
        </View>

        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>{agencyName}</Text>
            <Text style={styles.brandSub}>{QUOTE_PDF_COPY.agencyTagline}</Text>
          </View>
          <View>
            <Text style={styles.docTypeMuted}>{QUOTE_PDF_COPY.docLabel}</Text>
            <Text style={styles.docTypeMain}>{QUOTE_PDF_COPY.docType}</Text>
          </View>
        </View>

        <Text style={styles.h1}>{title}</Text>
        {packageName ? (
          <View style={styles.packagePill}>
            <Text style={styles.packagePillText}>{packageName}</Text>
          </View>
        ) : null}

        <Text style={styles.body}>{coverIntro}</Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>{QUOTE_PDF_COPY.metaClient}</Text>
            <Text style={styles.metaVal}>{client.name}</Text>
          </View>
          {objectText ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>{QUOTE_PDF_COPY.metaObject}</Text>
              <Text style={styles.metaVal}>{objectText}</Text>
            </View>
          ) : null}
          {conditions ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>{QUOTE_PDF_COPY.metaConditions}</Text>
              <Text style={styles.metaVal}>{conditions}</Text>
            </View>
          ) : null}
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.metaKey}>{QUOTE_PDF_COPY.metaValidity}</Text>
            <Text style={styles.metaVal}>
              Cette proposition peut être acceptée jusqu&apos;au{' '}
              {new Date(quote.valid_until).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              . Passé ce terme, les montants et disponibilités pourront être révisés.
            </Text>
          </View>
        </View>

        <View style={styles.refBar}>
          <View>
            <Text style={styles.refMuted}>{QUOTE_PDF_COPY.refLabel}</Text>
            <Text style={styles.refStrong}>{quote.ref}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.refMuted}>{QUOTE_PDF_COPY.issueLabel}</Text>
            <Text style={styles.refStrong}>
              {new Date(quote.issue_date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        <Text
          style={styles.pageFoot}
          fixed
          render={({ pageNumber, totalPages }) => `${QUOTE_PDF_COPY.footerConfidential(agencyName, client.name)} · ${footerText(pageNumber, totalPages)}`}
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageHeader agencyName={agencyName} quoteRef={quote.ref} />
        <SectionTitle title={QUOTE_PDF_COPY.sectionServices} />
        <Text style={styles.sectionLead}>{QUOTE_PDF_COPY.sectionServicesLead}</Text>

        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.tdService]}>{QUOTE_PDF_COPY.colService}</Text>
          <Text style={[styles.th, styles.tdDetail]}>{QUOTE_PDF_COPY.colDetail}</Text>
          <Text style={[styles.th, styles.tdPrice]}>{QUOTE_PDF_COPY.colPrice}</Text>
        </View>
        {items.map((item) => (
          <View
            key={item.id}
            wrap={false}
            style={
              item.is_recommended || item.is_optional ? [styles.tr, styles.trHighlight] : styles.tr
            }
          >
            <View style={styles.tdService}>
              <Text style={{ color: CREAM, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>{lineLabel(item)}</Text>
              {item.is_recommended ? <Text style={styles.badge}>{QUOTE_PDF_COPY.badgeRecommended}</Text> : null}
              {item.is_optional ? <Text style={styles.badge}>{QUOTE_PDF_COPY.badgeOptional}</Text> : null}
            </View>
            <View style={styles.tdDetail}>
              <Text style={{ color: MUTED, fontSize: 8.5, lineHeight: 1.48 }}>{lineDetail(item)}</Text>
            </View>
            <View style={styles.tdPrice}>
              <Text style={{ color: CREAM, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>
                {fmtPdf(Number(item.total))}
              </Text>
              <Text style={{ color: MUTED, fontSize: 7.5, marginTop: 3 }}>
                {Number(item.quantity)} × {fmtPdf(Number(item.unit_price))}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.totalsWrap}>
          <Text style={styles.totalsTitle}>{QUOTE_PDF_COPY.totalsTitle}</Text>
          <Text style={styles.totalsSub}>{QUOTE_PDF_COPY.totalsSubtitle(subtitleCurrency)}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.subtotalHt}</Text>
            <Text style={styles.totalValue}>{fmtPdf(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.vat(Number(quote.tax_rate))}</Text>
            <Text style={styles.totalValue}>{fmtPdf(tax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.beforeDiscount}</Text>
            <Text style={styles.totalValue}>{fmtPdf(totalBeforeDiscount)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {QUOTE_PDF_COPY.discount}
                {quote.discount_mode === 'percent' && quote.discount_percent
                  ? ` (${quote.discount_percent} %)`
                  : ''}
              </Text>
              <Text style={styles.totalValue}>− {fmtPdf(discount)}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.totalTtc}</Text>
            <Text style={[styles.totalValue, { fontSize: 12, color: ORANGE }]}>{fmtPdf(total)}</Text>
          </View>
          {firstMonth != null && !Number.isNaN(firstMonth) ? (
            <View style={[styles.totalRow, { marginTop: 12 }]}>
              <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.firstMonth}</Text>
              <Text style={styles.totalValue}>{fmtPdf(firstMonth)}</Text>
            </View>
          ) : null}
          {recurring != null && !Number.isNaN(recurring) ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.recurring}</Text>
              <Text style={styles.totalValue}>{fmtPdf(recurring)}</Text>
            </View>
          ) : null}
          {commitment != null && !Number.isNaN(commitment) ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.commitment}</Text>
              <Text style={styles.totalValue}>{`${commitment} mois`}</Text>
            </View>
          ) : null}
        </View>

        {(promoLabel || promoTerms) && (
          <View style={styles.promoBox}>
            {promoLabel ? (
              <Text style={{ fontFamily: 'Helvetica-Bold', color: CREAM, fontSize: 9.5, marginBottom: 6 }}>
                {promoLabel}
              </Text>
            ) : null}
            {promoTerms ? <Text style={{ color: MUTED, fontSize: 9, lineHeight: 1.52 }}>{promoTerms}</Text> : null}
          </View>
        )}

        <Text style={styles.pageFoot} fixed render={({ pageNumber, totalPages }) => footerText(pageNumber, totalPages)} />
      </Page>

      {hasStrategicPage ? (
        <Page size="A4" style={styles.page}>
          <PageHeader agencyName={agencyName} quoteRef={quote.ref} />
          <SectionTitle title={QUOTE_PDF_COPY.sectionValue} />
          <Text style={styles.sectionLead}>{QUOTE_PDF_COPY.sectionValueLead}</Text>
          {mergedStrategic.map((b, idx) => (
            <View key={`${b.title}-${idx}`} style={styles.blockCard} wrap={false}>
              <Text style={styles.blockTitle}>{b.title}</Text>
              <Text style={{ color: MUTED, fontSize: 9.5, lineHeight: 1.55 }}>{b.body}</Text>
            </View>
          ))}
          <Text style={styles.pageFoot} fixed render={({ pageNumber, totalPages }) => footerText(pageNumber, totalPages)} />
        </Page>
      ) : null}

      <Page size="A4" style={styles.page}>
        <PageHeader agencyName={agencyName} quoteRef={quote.ref} />
        <SectionTitle title={QUOTE_PDF_COPY.sectionExecution} />
        {executionParagraphs.length > 0 ? (
          executionParagraphs.map((para, i) => (
            <Text key={i} style={styles.assumptionPara}>
              {para}
            </Text>
          ))
        ) : (
          QUOTE_PDF_COPY.executionFallback.split('\n\n').map((para, i) => (
            <Text key={i} style={styles.assumptionPara}>
              {para}
            </Text>
          ))
        )}
        {pay ? (
          <>
            <View style={{ marginTop: 14, marginBottom: 8 }}>
              <Text style={[styles.blockTitle, { color: CREAM }]}>Règlement</Text>
            </View>
            <Text style={styles.assumptionPara}>{pay}</Text>
          </>
        ) : null}
        <Text style={styles.pageFoot} fixed render={({ pageNumber, totalPages }) => footerText(pageNumber, totalPages)} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageHeader agencyName={agencyName} quoteRef={quote.ref} />
        <SectionTitle title={QUOTE_PDF_COPY.sectionClosing} />
        {recommendation ? (
          <Text style={styles.bodyEmphasis}>{recommendation}</Text>
        ) : (
          <Text style={styles.bodyEmphasis}>{QUOTE_PDF_COPY.closingFallback}</Text>
        )}

        <View style={styles.totalsWrap}>
          <Text style={styles.totalsTitle}>{QUOTE_PDF_COPY.summaryClosing}</Text>
          <Text style={styles.totalsSub}>{QUOTE_PDF_COPY.totalsSubtitle(subtitleCurrency)}</Text>
          <View style={styles.grandRow}>
            <Text style={styles.totalLabel}>{QUOTE_PDF_COPY.totalTtc}</Text>
            <Text style={[styles.totalValue, { fontSize: 13, color: ORANGE }]}>{fmtPdf(total)}</Text>
          </View>
        </View>

        {quote.include_signature_block !== false ? (
          <View style={styles.signFrame}>
            <Text style={styles.signTitle}>{QUOTE_PDF_COPY.bonPourAccord}</Text>
            <Text style={styles.signBody}>{QUOTE_PDF_COPY.bonPourAccordBody}</Text>
            <Text style={{ color: MUTED, fontSize: 8 }}>{QUOTE_PDF_COPY.signHint}</Text>
            <View style={styles.signLine} />
            <Text style={{ marginTop: 10, color: MUTED, fontSize: 8.5 }}>{QUOTE_PDF_COPY.signForClient(client.name)}</Text>
          </View>
        ) : null}

        <Text
          style={styles.pageFoot}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${QUOTE_PDF_COPY.footerConfidential(agencyName, client.name)} · ${footerText(pageNumber, totalPages)}`
          }
        />
      </Page>
    </Document>
  );
}
