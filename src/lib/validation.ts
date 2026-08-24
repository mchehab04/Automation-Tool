// Shared by client-side form validation and server actions, so both sides
// agree on the same rules instead of duplicating (and drifting).

export const MAX_LENGTHS = {
  name: 100,
  email: 150,
  phone: 30,
  company: 100,
  note: 500,
  quoteDescription: 200,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Empty is valid here — email is an optional field, required-ness is checked separately.
export function isValidEmail(raw: string): boolean {
  const value = normalizeEmail(raw);
  return value.length === 0 || EMAIL_RE.test(value);
}

// Forgiving: users paste phone numbers with spaces, dashes, parens, dots —
// none of that should block submission. Only digit count is actually checked.
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return digits.length ? `${hasLeadingPlus ? "+" : ""}${digits}` : "";
}

export function isValidPhone(raw: string): boolean {
  if (!raw.trim()) return true; // optional
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

// Forgiving number/currency parsing: strips "$", ",", spaces so "$1,200.50"
// and "1200.50" both parse the same way instead of one being rejected.
export function parseForgivingNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
