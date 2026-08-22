import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { ENV } from "./_core/env";

export const ADMIN_SESSION_COOKIE = "altixdev_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

function getAdminEmail() {
  return (process.env.ALTIXDEV_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

function getAdminPassword() {
  return process.env.ALTIXDEV_ADMIN_PASSWORD ?? "";
}

function getSigningKey() {
  if (!ENV.cookieSecret) throw new Error("Segredo de sessão não configurado.");
  return createHash("sha256").update(`${ENV.cookieSecret}:altixdev-admin`).digest();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminCredentials(email: string, password: string) {
  const expectedEmail = getAdminEmail();
  const expectedPassword = getAdminPassword();
  if (!expectedEmail || !expectedPassword) return false;
  return safeEqual(email.trim().toLowerCase(), expectedEmail) && safeEqual(password, expectedPassword);
}

export async function createAdminSession() {
  return new SignJWT({ scope: "altixdev-admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_DURATION_MS) / 1000))
    .sign(getSigningKey());
}

export async function hasAdminSession(req: Request) {
  const headerValue = req.headers["x-altixdev-admin-session"];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const cookieHeader = req.headers.cookie ?? "";
  const cookieToken = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1);
  const token = headerToken || cookieToken;

  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), { algorithms: ["HS256"] });
    return payload.scope === "altixdev-admin";
  } catch {
    return false;
  }
}

export function getConfiguredAdminEmail() {
  return getAdminEmail();
}

export function getAdminSessionDuration() {
  return SESSION_DURATION_MS;
}
