import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const baseCategories = [
  "Компьютеры",
  "Мониторы",
  "Моноблоки",
  "Ноутбуки",
  "Периферия",
  "Серверное оборудование"
];

const legacyGlobalTemplates = ["Компьютер", "Монитор", "Моноблок", "Ноутбук"];

const systemUnitComponents = [
  { name: "Корпус" },
  { name: "Материнская плата" },
  { name: "Процессор" },
  { name: "Кулер" },
  { name: "SSD" },
  { name: "Оперативная память" },
  { name: "Реестровый набор", priceUsd: 30 },
  { name: "Завод", priceUsd: 50 }
];

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

  for (const name of baseCategories) {
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

  await prisma.productTemplate.deleteMany({
    where: {
      isGlobal: true,
      name: { in: legacyGlobalTemplates }
    }
  });

  const existingSystemUnitTemplates = await prisma.productTemplate.findMany({
    where: { isGlobal: true, name: "Системный блок" },
    orderBy: { createdAt: "asc" }
  });
  const [systemUnitTemplate, ...duplicateSystemUnitTemplates] = existingSystemUnitTemplates;

  if (duplicateSystemUnitTemplates.length > 0) {
    await prisma.productTemplate.deleteMany({
      where: { id: { in: duplicateSystemUnitTemplates.map((template) => template.id) } }
    });
  }

  const components = systemUnitComponents.map((component, sortOrder) => ({
    name: component.name,
    quantityPerProduct: 1,
    priceUsd: component.priceUsd ?? null,
    inputCurrency: "USD" as const,
    sortOrder
  }));

  if (systemUnitTemplate) {
    await prisma.productTemplate.update({
      where: { id: systemUnitTemplate.id },
      data: {
        category: "Компьютеры",
        components: {
          deleteMany: {},
          create: components
        }
      }
    });
  } else {
    await prisma.productTemplate.create({
      data: {
        name: "Системный блок",
        category: "Компьютеры",
        isGlobal: true,
        components: { create: components }
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
