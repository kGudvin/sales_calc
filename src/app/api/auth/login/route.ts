import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const { login, password } = await request.json();
  const user = await prisma.user.findUnique({ where: { login: String(login || "").trim() } });
  if (!user || !user.isActive || !(await verifyPassword(String(password || ""), user.passwordHash))) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }
  const response = NextResponse.json({ user: { id: user.id, login: user.login, role: user.role } });
  setSessionCookie(response, createToken(user));
  return response;
}
