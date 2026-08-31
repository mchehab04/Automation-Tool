import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Node's built-in scrypt — no new dependency (bcrypt/bcryptjs), matches
// this project's bias toward a minimal footprint elsewhere (report 29
// reused `sharp` rather than adding a package; migrations, timezone, and
// scheduling logic are all hand-rolled).
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hashHex, "hex");
  // Constant-time compare — a plain `===`/Buffer.equals check would let an
  // attacker infer how many leading bytes matched from response timing.
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}
