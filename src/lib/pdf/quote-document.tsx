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

export type VehicleInfo = {
  make: string | null;
  model: string | null;
  year: string | null;
};

export type QuoteDocumentProps = {
  quoteNumber: number;
  businessName: string;
  businessAddress: string | null;
  lead: {
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    vehicle?: VehicleInfo | null;
  };
  lineItems: QuoteLineItem[];
  notes: string | null;
  totalAmount: number; // cents, pre-VAT subtotal
  currency: string;
  generatedAt: Date;
  validUntil?: Date;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#0f172a", // slate-900
    backgroundColor: "#ffffff",
  },
  // Top Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0", // slate-200
    borderBottomStyle: "solid",
  },
  companyBlock: {
    maxWidth: 240,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 8.5,
    color: "#64748b", // slate-500
    lineHeight: 1.35,
    marginBottom: 3,
  },
  quoteMetaBlock: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 2,
    color: "#0f172a",
    marginBottom: 6,
  },
  metaGrid: {
    alignItems: "flex-end",
  },
  metaItem: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 8.5,
    color: "#64748b",
    marginRight: 6,
  },
  metaValue: {
    fontSize: 8.5,
    fontWeight: 700,
    color: "#0f172a",
  },

  // Customer & Vehicle Info Cards
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 16,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f8fafc", // slate-50
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderStyle: "solid",
  },
  cardHeader: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  cardPrimaryText: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 2,
  },
  cardSecondaryText: {
    fontSize: 8.5,
    color: "#475569",
    lineHeight: 1.3,
  },

  // Line Items Table
  table: {
    marginTop: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableHeaderCol: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#475569",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    borderBottomStyle: "solid",
    paddingVertical: 6.5,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  colDesc: { flex: 3.5 },
  colQty: { flex: 0.8, textAlign: "center" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },

  itemDescription: {
    fontSize: 9,
    fontWeight: 500,
    color: "#1e293b",
  },
  itemQty: {
    fontSize: 9,
    color: "#475569",
    textAlign: "center",
  },
  itemPrice: {
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
  },
  itemTotal: {
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "right",
  },

  // Bottom Area: Notes & Totals Breakdown
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
    marginBottom: 20,
    gap: 16,
  },
  bottomSectionNoNotes: {
    justifyContent: "flex-end",
  },
  notesBox: {
    flex: 1.2,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    padding: 9,
  },
  notesLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8.5,
    color: "#334155",
    lineHeight: 1.35,
  },
  summaryBlock: {
    flex: 1,
    alignSelf: "flex-end",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 4,
    padding: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 8.5,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 600,
    color: "#0f172a",
  },
  totalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    borderBottomStyle: "solid",
    marginVertical: 4,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 3,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
  },

  // Footer & Terms
  footerWrapper: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
    paddingTop: 10,
  },
  systemNotice: {
    fontSize: 7,
    color: "#cbd5e1",
    textAlign: "right",
    marginTop: 4,
  },
});

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatVehicleString(v?: VehicleInfo | null): string {
  if (!v || (!v.make && !v.model && !v.year)) {
    return "Not specified";
  }
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.join(" ") || "Not specified";
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
  validUntil,
}: QuoteDocumentProps) {
  const vatAmount = Math.round(totalAmount * VAT_RATE);
  const grandTotal = totalAmount + vatAmount;
  const expiryDate =
    validUntil || new Date(generatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

  return (
    <Document title={`Quotation #${formatQuoteNumber(quoteNumber)} - ${lead.name}`}>
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{businessName}</Text>
            {businessAddress ? (
              <Text style={styles.companyAddress}>{businessAddress}</Text>
            ) : null}
          </View>

          <View style={styles.quoteMetaBlock}>
            <Text style={styles.docTitle}>QUOTATION</Text>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Quote Ref:</Text>
                <Text style={styles.metaValue}>#{formatQuoteNumber(quoteNumber)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Date Issued:</Text>
                <Text style={styles.metaValue}>{formatDate(generatedAt)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Valid Until:</Text>
                <Text style={styles.metaValue}>{formatDate(expiryDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer & Vehicle Info Grid */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.cardHeader}>Customer Details</Text>
            <Text style={styles.cardPrimaryText}>{lead.name}</Text>
            {lead.company ? (
              <Text style={styles.cardSecondaryText}>{lead.company}</Text>
            ) : null}
            {lead.email ? (
              <Text style={styles.cardSecondaryText}>{lead.email}</Text>
            ) : null}
            {lead.phone ? (
              <Text style={styles.cardSecondaryText}>{lead.phone}</Text>
            ) : null}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardHeader}>Vehicle</Text>
            <Text style={styles.cardPrimaryText}>
              {formatVehicleString(lead.vehicle)}
            </Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCol, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCol, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCol, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCol, styles.colTotal]}>Total</Text>
          </View>

          {lineItems.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <View style={styles.colDesc}>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
              <Text style={[styles.itemQty, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.itemPrice, styles.colPrice]}>
                {formatMoney(item.unitPrice, currency)}
              </Text>
              <Text style={[styles.itemTotal, styles.colTotal]}>
                {formatMoney(item.unitPrice * item.quantity, currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Bottom Section: Notes & Summary */}
        <View style={[styles.bottomSection, notes ? undefined : styles.bottomSectionNoNotes]}>
          {notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          ) : null}

          <View style={styles.summaryBlock}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatMoney(totalAmount, currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VAT (5%)</Text>
              <Text style={styles.summaryValue}>{formatMoney(vatAmount, currency)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total (Inc. VAT)</Text>
              <Text style={styles.grandTotalValue}>{formatMoney(grandTotal, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerWrapper}>
          <Text style={styles.systemNotice}>
            Generated by {businessName} Pipeline Automation • Quotation #{formatQuoteNumber(quoteNumber)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
