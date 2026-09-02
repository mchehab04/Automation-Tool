// Deterministic — same reasoning as defaultBookingMessage (report 31):
// nothing here needs AI synthesis, everything referenced is already known.
export function defaultInvoiceMessage(name: string): string {
  return `Hi ${name}, thank you for your business. Please find your invoice attached — let us know if you have any questions.`;
}
