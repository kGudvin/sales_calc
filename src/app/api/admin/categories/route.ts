import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const categories = await prisma.productCategory.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ categories });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { name } = await request.json();
    const category = await prisma.productCategory.create({ data: { name: String(name || "").trim() } });
    return NextResponse.json({ category });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { id, name } = await request.json();
    const category = await prisma.productCategory.update({ where: { id }, data: { name: String(name || "").trim() } });
    return NextResponse.json({ category });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    const id = request.nextUrl.searchParams.get("id") || "";
    await prisma.productCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
