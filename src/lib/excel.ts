import ExcelJS from "exceljs";
import { CalculationFull, calculate } from "@/lib/calculations";
import { calculationStatusLabels, calculationTypeLabels } from "@/lib/format";

const rubFormat = '#,##0 "₽"';
const percentFormat = '0.00"%"';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24445C" } };
}

function section(ws: ExcelJS.Worksheet, title: string) {
  const row = ws.addRow([title]);
  row.font = { bold: true, size: 13, color: { argb: "FF172033" } };
  ws.mergeCells(row.number, 1, row.number, 8);
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2F8" } };
}

function tableHeader(ws: ExcelJS.Worksheet, values: string[]) {
  const row = ws.addRow(values);
  styleHeader(row);
}

export async function buildCalculationWorkbook(calculation: CalculationFull) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sales Calculation Service";
  workbook.created = new Date();
  const productBlockRanges: Array<{ start: number; end: number }> = [];
  const ws = workbook.addWorksheet("Расчёт", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  ws.columns = [
    { width: 26 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 }
  ];

  const totals = calculate(calculation);

  section(ws, calculation.title || "Расчёт");
  ws.addRows([
    ["Тип", calculationTypeLabels[calculation.type], "Статус", calculationStatusLabels[calculation.status]],
    ["Менеджер", calculation.owner?.login || "", "Дата выгрузки", new Date().toLocaleString("ru-RU")],
    ["Курс USD/RUB", Number(calculation.currencyRateUsdRub), calculation.isManualCurrencyRate ? "Используется ручной курс" : "", ""],
    ["Заказчик", calculation.customerName || "", "ИНН", calculation.customerInn || ""],
    ["Город", calculation.customerCity || "", "", ""]
  ]);
  ws.addRow([]);

  if (calculation.type === "AUCTION") {
    section(ws, "Тендер");
    ws.addRows([
      ["Номер закупки", calculation.purchaseNumber || "", "Ссылка", calculation.purchaseLink || ""],
      ["Площадка", calculation.platformName || "", "НМЦК", Number(calculation.nmckRub || 0)],
      ["Окончание заявок", calculation.applicationDeadline ? calculation.applicationDeadline.toLocaleDateString("ru-RU") : "", "Поставка", calculation.deliveryTerms || ""],
      ["Гарантия", calculation.warrantyTerms || "", "", ""]
    ]);
    ws.addRow([]);
  }

  section(ws, "Изделия");
  for (const [productIndex, row] of totals.productRows.entries()) {
    if (productIndex > 0) {
      const spacer = ws.addRow([]);
      spacer.height = 8;
    }

    const blockStart = ws.rowCount + 1;
    const productTitleRow = ws.addRow([
      `Изделие ${productIndex + 1}: ${row.product.name} — ${row.quantity} шт.`
    ]);
    ws.mergeCells(productTitleRow.number, 1, productTitleRow.number, 8);
    productTitleRow.height = 22;
    productTitleRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    productTitleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    productTitleRow.getCell(1).alignment = { vertical: "middle", wrapText: true };

    tableHeader(ws, ["Наименование", "Категория", "Кол-во", "Реестровый номер", "Закупка 1 шт", "Закупка всего", "Вход 1 шт", "Вход всего"]);
    const excelRow = ws.addRow([
      row.product.name,
      row.product.category || "",
      row.quantity,
      row.product.registryNumber || "",
      row.productUnitCostRub,
      row.productTotalCostRub,
      row.inputUnitCostRub,
      row.inputTotalCostRub
    ]);
    excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FBF9" } };
    excelRow.font = { bold: true, color: { argb: "FF172033" } };
    [5, 6, 7, 8].forEach((cell) => (excelRow.getCell(cell).numFmt = rubFormat));

    tableHeader(ws, ["Комплектующая", "Характеристики", "Кол-во на 1", "Цена RUB", "Цена USD", "Сумма за 1 изделие", "Учитывать"]);
    for (const component of row.product.components.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const componentRow = ws.addRow([
        component.name,
        component.characteristics || "",
        Number(component.quantityPerProduct),
        Number(component.priceRub || 0),
        Number(component.priceUsd || 0),
        Number(component.quantityPerProduct) * Number(component.priceRub || 0),
        component.isIncluded ? "Да" : "Нет"
      ]);
      [4, 5, 6].forEach((cell) => (componentRow.getCell(cell).numFmt = rubFormat));
      if (!component.isIncluded) {
        componentRow.font = { color: { argb: "FF64748B" }, italic: true };
      }
    }
    productBlockRanges.push({ start: blockStart, end: ws.rowCount });
  }

  section(ws, "Расходы и итоги");
  const summaryRows = [
    ["Чистая себестоимость товаров", totals.pureProductsCostRub],
    ["Доставка", totals.deliveryCostRub],
    ["Обеспечение заявки", totals.bidSecurityAmountRub],
    ["Обеспечение контракта", totals.contractSecurityAmountRub],
    ["Обеспечение гарантийных обязательств", totals.warrantySecurityAmountRub],
    ["Процент БГ", Number(calculation.bankGuaranteePercent)],
    ["Стоимость БГ", totals.bankGuaranteeCostRub],
    ["Итоговый вход", totals.inputCostRub]
  ];
  for (const values of summaryRows) {
    const row = ws.addRow(values);
    row.getCell(2).numFmt = values[0] === "Процент БГ" ? percentFormat : rubFormat;
  }
  ws.addRow([]);

  section(ws, "Сценарии маржи");
  tableHeader(ws, ["Маржа", "Вход", "Цена продажи", "Прибыль", "Фактическая маржа"]);
  for (const scenario of totals.marginScenarios) {
    const row = ws.addRow([scenario.marginPercent, scenario.inputCostRub, scenario.totalSalePriceRub, scenario.profitRub, scenario.actualMarginPercent]);
    row.getCell(1).numFmt = percentFormat;
    [2, 3, 4].forEach((cell) => (row.getCell(cell).numFmt = rubFormat));
    row.getCell(5).numFmt = percentFormat;
    if (scenario.profitRub < 0) row.font = { color: { argb: "FFB42318" } };
  }

  if (calculation.type === "AUCTION") {
    ws.addRow([]);
    section(ws, "Калькулятор торгов");
    tableHeader(ws, ["Ставка", "Цена после снижения", "Вход", "Прибыль", "Маржа", "Статус"]);
    for (const scenario of totals.auctionScenarios) {
      const row = ws.addRow([
        scenario.discountPercent,
        scenario.auctionPriceRub,
        scenario.inputCostRub,
        scenario.auctionProfitRub,
        scenario.auctionMarginPercent,
        scenario.isAboveInput ? "Выше входа" : "Ниже входа"
      ]);
      row.getCell(1).numFmt = percentFormat;
      [2, 3, 4].forEach((cell) => (row.getCell(cell).numFmt = rubFormat));
      row.getCell(5).numFmt = percentFormat;
      if (!scenario.isAboveInput) row.font = { color: { argb: "FFB42318" } };
    }
  }

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9E1EA" } },
        left: { style: "thin", color: { argb: "FFD9E1EA" } },
        bottom: { style: "thin", color: { argb: "FFD9E1EA" } },
        right: { style: "thin", color: { argb: "FFD9E1EA" } }
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  for (const range of productBlockRanges) {
    for (let rowNumber = range.start; rowNumber <= range.end; rowNumber++) {
      const row = ws.getRow(rowNumber);
      for (let cellNumber = 1; cellNumber <= 8; cellNumber++) {
        const cell = row.getCell(cellNumber);
        cell.border = {
          top: {
            style: rowNumber === range.start ? "medium" : "thin",
            color: { argb: rowNumber === range.start ? "FF0F766E" : "FFD9E1EA" }
          },
          left: {
            style: cellNumber === 1 ? "medium" : "thin",
            color: { argb: cellNumber === 1 ? "FF0F766E" : "FFD9E1EA" }
          },
          bottom: {
            style: rowNumber === range.end ? "medium" : "thin",
            color: { argb: rowNumber === range.end ? "FF0F766E" : "FFD9E1EA" }
          },
          right: {
            style: cellNumber === 8 ? "medium" : "thin",
            color: { argb: cellNumber === 8 ? "FF0F766E" : "FFD9E1EA" }
          }
        };
      }
    }
  }

  return workbook;
}
