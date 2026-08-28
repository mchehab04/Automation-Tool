// Shared fallback so the simulator's defensive fallback and the lead-detail
// page's fallback (for leads with no pendingQuoteMessage at all — e.g.
// manually created leads) can't drift apart.
export function defaultQuoteMessage(name: string): string {
  return `Hi ${name}, thank you for reaching out. Please find your quote attached — let us know if you have any questions.`;
}
