import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculationInclude, serializeCalculation, upsertCalculation } from "@/lib/api";
import { calculationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const query = params.get("q")?.trim();
    const type = params.get("type") || undefined;
    const status = params.get("status") || undefined;
    const ownerId = params.get("ownerId") || undefined;
    const where: Prisma.CalculationWhereInput = {};

    if (user.role !== "ADMIN") where.ownerId = user.id;
    if (user.role === "ADMIN" && ownerId) where.ownerId = ownerId;
    if (type) where.type = type as never;
    if (status) where.status = status as never;
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { purchaseNumber: { contains: query, mode: "insensitive" } },
        { customerInn: { contains: query, mode: "insensitive" } }
      ];
    }

    const calculations = await prisma.calculation.findMany({
      where,
      include: { owner: { select: { login: true } }, products: { select: { id: true } } },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ calculations: serializeCalculation(calculations) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = calculationSchema.parse(await request.json());
    const calculation = await upsertCalculation(user, input);
    return NextResponse.json({ calculation: serializeCalculation(calculation) });
  } catch (error) {
    return jsonError(error);
  }
}
