import { NextRequest, NextResponse } from "next/server";
import { hashPassword, jsonError, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { oldPassword, newPassword } = await request.json();
    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json({ error: "Новый пароль должен быть не короче 6 символов" }, { status: 400 });
    }
    if (!(await verifyPassword(String(oldPassword || ""), user.passwordHash))) {
      return NextResponse.json({ error: "Старый пароль указан неверно" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(String(newPassword)) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
