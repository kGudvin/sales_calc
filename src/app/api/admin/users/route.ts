import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { hashPassword, jsonError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function userPayload<T extends { login: string }>(user: T) {
  return { ...user, email: user.login };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, login: true, role: true, isActive: true, createdAt: true, updatedAt: true }
    });
    return NextResponse.json({ users: users.map(userPayload) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const login = String(body.email || body.login || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!isEmail(login) || password.length < 8) {
      return NextResponse.json({ error: "Укажите email и пароль от 8 символов" }, { status: 400 });
    }
    const user = await prisma.user.create({
      data: {
        login,
        passwordHash: await hashPassword(password),
        role: body.role === "ADMIN" ? "ADMIN" : "USER",
        isActive: body.isActive ?? true
      },
      select: { id: true, login: true, role: true, isActive: true }
    });
    return NextResponse.json({ user: userPayload(user) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const data: { role?: UserRole; isActive?: boolean; passwordHash?: string } = {};
    if (body.role) data.role = body.role === "ADMIN" ? "ADMIN" : "USER";
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.password) data.passwordHash = await hashPassword(String(body.password));
    const user = await prisma.user.update({
      where: { id: String(body.id) },
      data,
      select: { id: true, login: true, role: true, isActive: true }
    });
    return NextResponse.json({ user: userPayload(user) });
  } catch (error) {
    return jsonError(error);
  }
}
