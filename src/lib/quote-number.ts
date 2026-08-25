export function formatQuoteNumber(number: number): string {
  return String(number).padStart(6, "0");
}
