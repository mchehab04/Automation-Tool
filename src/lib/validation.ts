// Shared by client-side form validation and server actions, so both sides
// agree on the same rules instead of duplicating (and drifting).

export const MAX_LENGTHS = {
  name: 100,
  email: 150,
  phone: 30,
  company: 100,
  note: 500,
  quoteDescription: 200,
  quoteNotes: 500,
  vehicleField: 60,
  vehicleYear: 4,
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

// Common role-account local-parts that aren't a person's name — guessing a
// name from these would be actively wrong, so leave the name blank instead.
const GENERIC_EMAIL_LOCAL_PARTS = new Set([
  "info", "sales", "support", "contact", "admin", "office", "hello",
  "noreply", "no-reply", "service", "help", "enquiries", "inquiries", "team",
]);

// Best-effort fallback for when a customer gives an email but not their name
// (e.g. "sarah.kim97@gmail.com" -> "Sarah Kim"). Returns "" when the local
// part looks like a role account or doesn't contain anything name-like.
export function guessNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (GENERIC_EMAIL_LOCAL_PARTS.has(local)) return "";

  const parts = local
    .split(/[._+-]+/)
    .map((part) => part.replace(/\d+$/, ""))
    .filter((part) => part.length > 1);

  if (parts.length === 0) return "";
  return parts.map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

// Models sometimes return a placeholder string instead of following the "empty
// string if unknown" instruction (e.g. "<UNKNOWN>", "N/A", "None"). Treat these
// the same as an actually-empty value rather than letting them through as real
// data — this is what let a lead get created named "<UNKNOWN>".
const PLACEHOLDER_TEXT_RE =
  /^[<[]?\s*(unknown|n\/?a|none|null|not[\s-](?:provided|given|specified|available)|no (?:name|info(?:rmation)?) (?:given|provided))\s*[>\]]?$/i;

export function isPlaceholderText(value: string): boolean {
  return PLACEHOLDER_TEXT_RE.test(value.trim());
}

// Forgiving number/currency parsing: strips "$", ",", spaces so "$1,200.50"
// and "1200.50" both parse the same way instead of one being rejected.
export function parseForgivingNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
