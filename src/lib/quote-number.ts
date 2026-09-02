export function formatQuoteNumber(number: number): string {
  return String(number).padStart(6, "0");
}

// Same formatting, kept as a separate export — invoices and quotes are
// independent numbering sequences even though the format is identical.
export function formatInvoiceNumber(number: number): string {
  return String(number).padStart(6, "0");
}
