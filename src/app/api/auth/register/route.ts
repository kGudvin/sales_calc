import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");

  if (!isEmail(normalizedEmail)) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }
  if (rawPassword.length < 8) {
    return NextResponse.json({ error: "Пароль должен быть не короче 8 символов" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { login: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      login: normalizedEmail,
      passwordHash: await hashPassword(rawPassword),
      role: "USER",
      isActive: false
    },
    select: { id: true, login: true, role: true, isActive: true }
  });

  return NextResponse.json({ user: { ...user, email: user.login }, status: "pending" }, { status: 201 });
}
