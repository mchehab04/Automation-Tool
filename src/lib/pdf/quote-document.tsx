import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatQuoteNumber } from "@/lib/quote-number";

export { formatQuoteNumber };

// Flat 5% — matches the UAE FTA rate this business operates under (see
// docs/03-decisions/decision-log.md). Applied at render time only: the
// stored Quote.totalAmount stays the pre-VAT subtotal, unchanged, so
// existing quotes' recorded amounts don't silently shift meaning.
const VAT_RATE = 0.05;

export type QuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number; // cents
};

export type QuoteDocumentProps = {
  quoteNumber: number;
  businessName: string;
  businessAddress: string | null;
  lead: { name: string; email: string | null; company: string | null };
  lineItems: QuoteLineItem[];
  notes: string | null;
  totalAmount: number; // cents, pre-VAT subtotal
  currency: string;
  generatedAt: Date;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1a1a1a" },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  businessName: { fontSize: 16, fontWeight: 700, marginBottom: 3 },
  businessAddress: { fontSize: 9, color: "#666", maxWidth: 220 },
  metaBlock: { alignItems: "flex-end" },
  meta: { color: "#555", marginBottom: 2, fontSize: 10 },
  title: {
    fontSize: 28,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: 20,
  },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 5 },
  divider: { borderBottom: "1px solid #1a1a1a", marginBottom: 16 },
  table: { display: "flex", flexDirection: "column", borderTop: "1px solid #ddd" },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    paddingVertical: 6,
  },
  headerRow: { fontWeight: 700, backgroundColor: "#f5f5f5" },
  colDescription: { flex: 3 },
  colQuantity: { flex: 1, textAlign: "right" },
  colUnitPrice: { flex: 1, textAlign: "right" },
  colLineTotal: { flex: 1, textAlign: "right" },
  summaryBlock: { alignSelf: "flex-end", width: 220, marginTop: 14 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLabel: { color: "#555" },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  totalBoxLabel: { color: "#ffffff", fontWeight: 700, fontSize: 12 },
  totalBoxValue: { color: "#ffffff", fontWeight: 700, fontSize: 12 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, color: "#999", fontSize: 9 },
});

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function QuoteDocument({
  quoteNumber,
  businessName,
  businessAddress,
  lead,
  lineItems,
  notes,
  totalAmount,
  currency,
  generatedAt,
}: QuoteDocumentProps) {
  const vatAmount = Math.round(totalAmount * VAT_RATE);
  const grandTotal = totalAmount + vatAmount;

  return (
    <Document title={`Quote ${formatQuoteNumber(quoteNumber)}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.businessName}>{businessName}</Text>
            {businessAddress ? <Text style={styles.businessAddress}>{businessAddress}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.meta}>Quote #{formatQuoteNumber(quoteNumber)}</Text>
            <Text style={styles.meta}>Date: {generatedAt.toLocaleDateString("en-US")}</Text>
          </View>
        </View>

        <Text style={styles.title}>QUOTATION</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREPARED FOR</Text>
          <Text>{lead.name}</Text>
          {lead.company ? <Text>{lead.company}</Text> : null}
          {lead.email ? <Text>{lead.email}</Text> : null}
        </View>

        {notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <Text>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQuantity}>Qty</Text>
            <Text style={styles.colUnitPrice}>Unit Price</Text>
            <Text style={styles.colLineTotal}>Total</Text>
          </View>
          {lineItems.map((item, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQuantity}>{item.quantity}</Text>
              <Text style={styles.colUnitPrice}>{formatMoney(item.unitPrice, currency)}</Text>
              <Text style={styles.colLineTotal}>
                {formatMoney(item.unitPrice * item.quantity, currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text>{formatMoney(totalAmount, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT (5%)</Text>
            <Text>{formatMoney(vatAmount, currency)}</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalBoxLabel}>Total</Text>
            <Text style={styles.totalBoxValue}>{formatMoney(grandTotal, currency)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Generated by {businessName}&apos;s pipeline automation tool. This is a demo quote.
        </Text>
      </Page>
    </Document>
  );
}
