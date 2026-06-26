import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error("CBR unavailable");
    const data = await response.json();
    return NextResponse.json({ rate: Number(data.Valute.USD.Value), source: "CBR" });
  } catch {
    return NextResponse.json({ rate: 90, source: "fallback" });
  }
}
