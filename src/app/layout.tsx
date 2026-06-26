import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Расчёты отдела продаж",
  description: "Сервис расчётов товаров, КП и электронных аукционов"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
