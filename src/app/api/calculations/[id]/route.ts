import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditCalculation, canViewCalculation, serializeCalculation, upsertCalculation } from "@/lib/api";
import { calculationSchema } from "@/lib/validation";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const calculation = await canViewCalculation(user, params.id);
    return NextResponse.json({ calculation: serializeCalculation(calculation) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const input = calculationSchema.parse(await request.json());
    const calculation = await upsertCalculation(user, input, params.id);
    return NextResponse.json({ calculation: serializeCalculation(calculation) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    await canEditCalculation(user, params.id);
    await prisma.calculation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
