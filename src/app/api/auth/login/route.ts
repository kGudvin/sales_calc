import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, login, password } = await request.json();
  const normalizedEmail = String(email || login || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { login: normalizedEmail } });
  if (!user || !(await verifyPassword(String(password || ""), user.passwordHash))) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }
  if (!user.isActive) {
    return NextResponse.json({ error: "Аккаунт ожидает одобрения администратора" }, { status: 403 });
  }
  const response = NextResponse.json({ user: { id: user.id, login: user.login, email: user.login, role: user.role } });
  setSessionCookie(response, createToken(user));
  return response;
}
