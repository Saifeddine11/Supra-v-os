import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ReportPdfContent } from '@/lib/pdf/report-pdf-types';

const ORANGE = '#FF3D0A';
const ORANGE_SOFT = '#FF6A2A';
const BLACK = '#080706';
const BROWN = '#1A0703';
const CREAM = '#F8F4EF';
const MUTED = '#A8A19A';

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: CREAM,
    backgroundColor: BLACK,
  },
  topBand: {
    marginTop: -44,
    marginHorizontal: -44,
    marginBottom: 24,
  },
  bandBrown: { height: 6, backgroundColor: BROWN },
  bandOrange: { height: 3, width: 64, backgroundColor: ORANGE },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  brand: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: CREAM,
    letterSpacing: 0.3,
  },
  brandSub: {
    marginTop: 4,
    fontSize: 7.5,
    color: ORANGE_SOFT,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
  },
  docLabel: {
    textAlign: 'right' as const,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  docTitle: {
    marginTop: 6,
    textAlign: 'right' as const,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE,
  },
  meta: {
    marginTop: 6,
    textAlign: 'right' as const,
    fontSize: 8,
    color: MUTED,
  },
  clientBox: {
    borderWidth: 1,
    borderColor: 'rgba(248, 244, 239, 0.12)',
    padding: 12,
    marginBottom: 18,
    backgroundColor: '#11100F',
  },
  clientLabel: { fontSize: 7, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  clientName: { marginTop: 4, fontSize: 11, fontFamily: 'Helvetica-Bold', color: CREAM },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: ORANGE,
    marginBottom: 6,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  body: {
    lineHeight: 1.45,
    color: CREAM,
    marginBottom: 14,
  },
  bullet: { marginBottom: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: ORANGE },
  bulletTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 44,
    right: 44,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(248, 244, 239, 0.12)',
    paddingTop: 8,
    fontSize: 7.5,
    color: MUTED,
  },
});

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function ReportPdfDocument({
  report,
  clientName,
  agencyName,
}: {
  report: ReportPdfContent;
  clientName: string;
  agencyName: string;
}) {
  const period =
    report.period_start || report.period_end
      ? `${fmtDate(report.period_start)} — ${fmtDate(report.period_end)}`
      : '—';

  const highlights = Array.isArray(report.highlights) ? report.highlights : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBand}>
          <View style={styles.bandBrown} />
          <View style={styles.bandOrange} />
        </View>

        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>{agencyName}</Text>
            <Text style={styles.brandSub}>Rapport</Text>
          </View>
          <View>
            <Text style={styles.docLabel}>Synthèse client</Text>
            <Text style={styles.docTitle}>{report.title}</Text>
            <Text style={styles.meta}>Période : {period}</Text>
            <Text style={styles.meta}>
              Portail client : {report.visible_to_client ? 'visible' : 'interne uniquement'}
            </Text>
          </View>
        </View>

        <View style={styles.clientBox}>
          <Text style={styles.clientLabel}>Client</Text>
          <Text style={styles.clientName}>{clientName}</Text>
        </View>

        {report.summary ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Résumé</Text>
            <Text style={styles.body}>{report.summary}</Text>
          </View>
        ) : null}

        {highlights.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Travail réalisé</Text>
            {highlights.map((h, i) => (
              <View key={i} style={styles.bullet} wrap={false}>
                {h.title ? <Text style={styles.bulletTitle}>{h.title}</Text> : null}
                <Text style={styles.body}>{h.description}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {report.next_actions ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Prochaines actions</Text>
            <Text style={styles.body}>{report.next_actions}</Text>
          </View>
        ) : null}

        {report.recommendations ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Recommandations</Text>
            <Text style={styles.body}>{report.recommendations}</Text>
          </View>
        ) : null}

        <Text
          style={styles.footer}
          fixed
        >{`Généré le ${new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} · ${agencyName}`}</Text>
      </Page>
    </Document>
  );
}
