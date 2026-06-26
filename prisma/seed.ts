import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminLogin = process.env.ADMIN_LOGIN || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "change_me";

  await prisma.user.upsert({
    where: { login: adminLogin },
    update: { role: "ADMIN", isActive: true },
    create: {
      login: adminLogin,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
      isActive: true
    }
  });

  for (const name of ["Компьютеры", "Мониторы", "Моноблоки", "Ноутбуки", "Периферия", "Серверное оборудование"]) {
    await prisma.productCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "marginScenarios" },
    update: {},
    create: { key: "marginScenarios", value: "10,15,20,25,30" }
  });
  await prisma.appSetting.upsert({
    where: { key: "defaultBankGuaranteePercent" },
    update: {},
    create: { key: "defaultBankGuaranteePercent", value: "5" }
  });

  await template("Компьютер", "Компьютеры", [
    "Корпус",
    "Материнская плата",
    "Процессор",
    "Оперативная память",
    "SSD",
    "Блок питания",
    "ОС",
    "Клавиатура",
    "Мышь"
  ]);
  await template("Монитор", "Мониторы", ["Монитор", "Кабель питания", "Кабель HDMI/DP"]);
  await template("Моноблок", "Моноблоки", ["Моноблок", "ОС", "Клавиатура", "Мышь"]);
  await template("Ноутбук", "Ноутбуки", ["Ноутбук", "ОС", "Сумка", "Мышь"]);
}

async function template(name: string, category: string, components: string[]) {
  const existing = await prisma.productTemplate.findFirst({ where: { name, isGlobal: true } });
  if (existing) return;
  await prisma.productTemplate.create({
    data: {
      name,
      category,
      isGlobal: true,
      components: {
        create: components.map((componentName, index) => ({
          name: componentName,
          quantityPerProduct: 1,
          inputCurrency: "RUB",
          sortOrder: index
        }))
      }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
