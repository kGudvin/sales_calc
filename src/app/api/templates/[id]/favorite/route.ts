import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const existing = await prisma.favoriteTemplate.findUnique({
      where: { userId_templateId: { userId: user.id, templateId: params.id } }
    });
    if (existing) {
      await prisma.favoriteTemplate.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorite: false });
    }
    await prisma.favoriteTemplate.create({ data: { userId: user.id, templateId: params.id } });
    return NextResponse.json({ favorite: true });
  } catch (error) {
    return jsonError(error);
  }
}
