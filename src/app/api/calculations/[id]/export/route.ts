import { NextRequest } from "next/server";
import { jsonError, requireUser } from "@/lib/auth";
import { canViewCalculation } from "@/lib/api";
import { buildCalculationWorkbook } from "@/lib/excel";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const calculation = await canViewCalculation(user, params.id);
    const workbook = await buildCalculationWorkbook(calculation);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = encodeURIComponent(`${calculation.title || "calculation"}.xlsx`);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
