import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ settings: await getSettings() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const margins = Array.isArray(body.margins) ? body.margins.map(Number).filter((v: number) => v > 0 && v < 100) : [10, 15, 20, 25, 30];
    await prisma.appSetting.upsert({
      where: { key: "marginScenarios" },
      update: { value: margins.join(",") },
      create: { key: "marginScenarios", value: margins.join(",") }
    });
    await prisma.appSetting.upsert({
      where: { key: "defaultBankGuaranteePercent" },
      update: { value: String(Number(body.defaultBankGuaranteePercent || 5)) },
      create: { key: "defaultBankGuaranteePercent", value: String(Number(body.defaultBankGuaranteePercent || 5)) }
    });
    return NextResponse.json({ settings: await getSettings() });
  } catch (error) {
    return jsonError(error);
  }
}
