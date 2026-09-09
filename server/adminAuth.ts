import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";

export const ADMIN_SESSION_COOKIE = "specathon_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function serializeAdminCookie(value: string, maxAge: number) {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${ENV.isProduction ? "; Secure" : ""}`;
}

function secret() { return ENV.cookieSecret || ENV.adminPasswordHash; }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
function encode(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }

export function verifyAdminPassword(email: string, password: string) {
  if (!ENV.adminEmail || !ENV.adminPasswordHash || email.trim().toLowerCase() !== ENV.adminEmail.trim().toLowerCase()) return false;
  const [salt, expectedHex] = ENV.adminPasswordHash.split(":");
  if (!salt || !expectedHex || !/^[0-9a-f]+$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, expectedHex.length / 2);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isRateLimited(ip: string) {
  const now = Date.now(); const current = failedAttempts.get(ip);
  if (!current || current.resetAt <= now) { failedAttempts.delete(ip); return false; }
  return current.count >= 8;
}
export function recordFailedAttempt(ip: string) { const now = Date.now(); const current = failedAttempts.get(ip); if (!current || current.resetAt <= now) failedAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); else current.count += 1; }
export function clearFailedAttempts(ip: string) { failedAttempts.delete(ip); }

export function setAdminSession(res: Response, openId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${encode(openId)}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;
  res.append("Set-Cookie", serializeAdminCookie(value, SESSION_TTL_SECONDS));
}
export function clearAdminSession(res: Response) { if (typeof res.append === "function") res.append("Set-Cookie", serializeAdminCookie("", 0)); }

export function getAdminSessionOpenId(req: Request) {
  const raw = parse(req.headers.cookie ?? "")[ADMIN_SESSION_COOKIE]; if (!raw) return null;
  const parts = raw.split("."); if (parts.length !== 3) return null;
  const [encodedOpenId, expiresAt, signature] = parts; const payload = `${encodedOpenId}.${expiresAt}`;
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;
  const expected = sign(payload); const a = Buffer.from(signature); const b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { return decode(encodedOpenId); } catch { return null; }
}
