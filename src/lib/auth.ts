import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { User, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "sales_calc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type TokenPayload = {
  sub: string;
  login: string;
  role: UserRole;
  exp: number;
};

function secret() {
  return process.env.JWT_SECRET || "development-secret-change-me";
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createToken(user: Pick<User, "id" | "login" | "role">) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: TokenPayload = {
    sub: user.id,
    login: user.login,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  };
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (signature !== sign(`${header}.${body}`)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function currentUserFromRequest(request?: NextRequest) {
  const token = request?.cookies.get(COOKIE_NAME)?.value ?? cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;
  return user;
}

export async function requireUser(request?: NextRequest) {
  const user = await currentUserFromRequest(request);
  if (!user) {
    throw Object.assign(new Error("Требуется вход"), { status: 401 });
  }
  return user;
}

export async function requireAdmin(request?: NextRequest) {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") {
    throw Object.assign(new Error("Доступно только администратору"), { status: 403 });
  }
  return user;
}

export function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Ошибка сервера";
  return NextResponse.json({ error: message }, { status: status || 500 });
}
