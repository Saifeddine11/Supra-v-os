import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Client, Invoice, InvoiceItem } from '@/types/database';
import { INVOICE_STATUS_MAP } from '@/types/domain';
import { formatAgencyMoney, normalizeAgencyCurrency } from '@/lib/money/format-money';

const ORANGE = '#FF450F';
const CREAM = '#F8F4EF';
const CHARCOAL = '#11100f';
const MUTED = '#9a948c';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: CHARCOAL,
    backgroundColor: '#faf8f5',
  },
  headerBand: {
    backgroundColor: CHARCOAL,
    margin: -48,
    marginBottom: 28,
    padding: 28,
    paddingBottom: 22,
  },
  brand: {
    color: CREAM,
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: ORANGE,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  refBlock: {
    alignItems: 'flex-end',
  },
  refLabel: { color: MUTED, fontSize: 8, textTransform: 'uppercase' as const },
  refValue: { color: ORANGE, fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  meta: { color: CREAM, fontSize: 9, marginTop: 4 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  clientBox: {
    borderWidth: 1,
    borderColor: '#e8e4dc',
    padding: 12,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  clientName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  muted: { color: MUTED, fontSize: 9 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ORANGE,
    paddingBottom: 6,
    marginBottom: 6,
  },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase' as const },
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#ece8e0' },
  tdDesc: { width: '42%' },
  tdQty: { width: '12%', textAlign: 'right' as const },
  tdUnit: { width: '12%', textAlign: 'right' as const },
  tdPrice: { width: '17%', textAlign: 'right' as const },
  tdTotal: { width: '17%', textAlign: 'right' as const },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4, width: 220 },
  totalLabel: { width: 120, textAlign: 'right' as const, color: MUTED, fontSize: 9 },
  totalValue: { width: 100, textAlign: 'right' as const, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grand: { marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: CHARCOAL },
  notes: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e4dc',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd8cf',
    paddingTop: 10,
    fontSize: 8,
    color: MUTED,
    textAlign: 'center' as const,
  },
});

export function InvoicePdfDocument({
  invoice,
  items,
  client,
  agencyName = 'Supra v.',
  displayCurrency,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Client;
  agencyName?: string;
  displayCurrency?: string | null;
}) {
  const cur = normalizeAgencyCurrency(displayCurrency ?? invoice.currency);
  const fmtPdf = (n: number) => formatAgencyMoney(n, cur);
  const statusLabel = INVOICE_STATUS_MAP[invoice.status].label;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <Text style={styles.brand}>{agencyName}</Text>
          <Text style={styles.brandAccent}>Facture</Text>
          <View style={styles.rowTop}>
            <View>
              <Text style={styles.meta}>Agency OS — Document confidentiel</Text>
            </View>
            <View style={styles.refBlock}>
              <Text style={styles.refLabel}>Référence</Text>
              <Text style={styles.refValue}>{invoice.ref}</Text>
              <Text style={styles.meta}>Statut : {statusLabel}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Client</Text>
        <View style={styles.clientBox}>
          <Text style={styles.clientName}>{client.name}</Text>
          {client.legal_name ? <Text style={styles.muted}>{client.legal_name}</Text> : null}
          {client.address ? <Text style={styles.muted}>{client.address}</Text> : null}
          <Text style={styles.muted}>
            {[client.city, client.country].filter(Boolean).join(', ')}
          </Text>
          {client.email ? <Text style={styles.muted}>{client.email}</Text> : null}
          {client.phone ? <Text style={styles.muted}>{client.phone}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          <View style={{ marginRight: 32 }}>
            <Text style={styles.refLabel}>Date d&apos;émission</Text>
            <Text style={{ fontSize: 10, marginTop: 2 }}>{invoice.issue_date}</Text>
          </View>
          <View>
            <Text style={styles.refLabel}>Échéance</Text>
            <Text style={{ fontSize: 10, marginTop: 2 }}>{invoice.due_date}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Détail</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.tdDesc]}>Description</Text>
          <Text style={[styles.th, styles.tdQty]}>Qté</Text>
          <Text style={[styles.th, styles.tdUnit]}>Unité</Text>
          <Text style={[styles.th, styles.tdPrice]}>P.U.</Text>
          <Text style={[styles.th, styles.tdTotal]}>Total</Text>
        </View>
        {items.map((line) => (
          <View key={line.id} style={styles.tr} wrap={false}>
            <Text style={styles.tdDesc}>{line.description}</Text>
            <Text style={styles.tdQty}>{String(line.quantity)}</Text>
            <Text style={styles.tdUnit}>{line.unit ?? '—'}</Text>
            <Text style={styles.tdPrice}>{fmtPdf(line.unit_price)}</Text>
            <Text style={styles.tdTotal}>{fmtPdf(line.total)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total HT</Text>
            <Text style={styles.totalValue}>{fmtPdf(invoice.subtotal)}</Text>
          </View>
          {invoice.discount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remise</Text>
              <Text style={styles.totalValue}>- {fmtPdf(invoice.discount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({invoice.tax_rate}%)</Text>
            <Text style={styles.totalValue}>{fmtPdf(invoice.tax_amount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grand]}>
            <Text style={[styles.totalLabel, { fontFamily: 'Helvetica-Bold', color: CHARCOAL }]}>
              Total TTC
            </Text>
            <Text style={[styles.totalValue, { fontSize: 14, color: ORANGE }]}>{fmtPdf(invoice.total)}</Text>
          </View>
        </View>

        {invoice.payment_terms ? (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Conditions de paiement</Text>
            <Text style={{ fontSize: 9, marginTop: 4, lineHeight: 1.4 }}>{invoice.payment_terms}</Text>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={[styles.notes, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 9, marginTop: 4, lineHeight: 1.4 }}>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {agencyName} — Merci de votre confiance. Pour toute question : contactez votre chargé de compte.
        </Text>
      </Page>
    </Document>
  );
}
