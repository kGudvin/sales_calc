import ExcelJS from "exceljs";
import { CalculationFull, calculate } from "@/lib/calculations";
import { calculationStatusLabels, calculationTypeLabels } from "@/lib/format";

const rubFormat = '#,##0 "₽"';
const usdFormat = '#,##0.00 "$"';
const percentFormat = '0.00"%"';

function cellAddress(row: number, col: number) {
  let column = "";
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    column = String.fromCharCode(65 + r) + column;
    n = Math.floor((n - 1) / 26);
  }
  return `${column}${row}`;
}

function setFormula(cell: ExcelJS.Cell, formula: string, result: number | string) {
  cell.value = { formula, result };
}

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
  workbook.calcProperties.fullCalcOnLoad = true;
  const productBlockRanges: Array<{ start: number; end: number }> = [];
  const productFormulaRows: Array<{
    productRow: number;
    componentStart?: number;
    componentEnd?: number;
    manualUnitCostRub: number;
    unitCostResult: number;
    totalCostResult: number;
    inputUnitResult: number;
    inputTotalResult: number;
  }> = [];
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
  const rateCell = cellAddress(4, 2);
  ws.addRow([]);

  let nmckCell = "";
  if (calculation.type === "AUCTION") {
    section(ws, "Тендер");
    ws.addRows([
      ["Номер закупки", calculation.purchaseNumber || "", "Ссылка", calculation.purchaseLink || ""],
      ["Площадка", calculation.platformName || "", "НМЦК", Number(calculation.nmckRub || 0)],
      ["Окончание заявок", calculation.applicationDeadline ? calculation.applicationDeadline.toLocaleDateString("ru-RU") : "", "Поставка", calculation.deliveryTerms || ""],
      ["Гарантия", calculation.warrantyTerms || "", "", ""]
    ]);
    nmckCell = cellAddress(ws.rowCount - 2, 4);
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
    const productRow = excelRow.number;
    excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FBF9" } };
    excelRow.font = { bold: true, color: { argb: "FF172033" } };
    [5, 6, 7, 8].forEach((cell) => (excelRow.getCell(cell).numFmt = rubFormat));

    tableHeader(ws, ["Комплектующая", "Характеристики", "Кол-во на 1", "Цена USD", "Цена RUB", "Сумма за 1 изделие", "Учитывать"]);
    const componentStart = row.product.components.length ? ws.rowCount + 1 : undefined;
    for (const component of row.product.components.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const componentRow = ws.addRow([
        component.name,
        component.characteristics || "",
        Number(component.quantityPerProduct),
        Number(component.priceUsd || 0),
        Number(component.priceRub || 0),
        Number(component.quantityPerProduct) * Number(component.priceRub || 0),
        component.isIncluded ? "Да" : "Нет"
      ]);
      const componentRowNumber = componentRow.number;
      const usdCell = componentRow.getCell(4);
      const rubCell = componentRow.getCell(5);
      const componentTotalCell = componentRow.getCell(6);

      if (component.inputCurrency === "USD") {
        setFormula(rubCell, `ROUND(${cellAddress(componentRowNumber, 4)}*${rateCell},2)`, Number(component.priceRub || 0));
      } else {
        setFormula(usdCell, `IF(${rateCell}>0,ROUND(${cellAddress(componentRowNumber, 5)}/${rateCell},2),0)`, Number(component.priceUsd || 0));
      }
      setFormula(
        componentTotalCell,
        `IF(${cellAddress(componentRowNumber, 7)}="Да",ROUND(${cellAddress(componentRowNumber, 3)}*${cellAddress(componentRowNumber, 5)},2),0)`,
        component.isIncluded ? Number(component.quantityPerProduct) * Number(component.priceRub || 0) : 0
      );
      componentRow.getCell(4).numFmt = usdFormat;
      [5, 6].forEach((cell) => (componentRow.getCell(cell).numFmt = rubFormat));
      if (!component.isIncluded) {
        componentRow.font = { color: { argb: "FF64748B" }, italic: true };
      }
    }
    const componentEnd = row.product.components.length ? ws.rowCount : undefined;
    const manualUnitCostRub = Number(row.product.manualPurchasePriceRub || 0) || Number(row.product.manualPurchasePriceUsd || 0) * totals.rate;
    productFormulaRows.push({
      productRow,
      componentStart,
      componentEnd,
      manualUnitCostRub,
      unitCostResult: row.productUnitCostRub,
      totalCostResult: row.productTotalCostRub,
      inputUnitResult: row.inputUnitCostRub,
      inputTotalResult: row.inputTotalCostRub
    });
    productBlockRanges.push({ start: blockStart, end: ws.rowCount });
  }

  section(ws, "Расходы и итоги");
  const productTotalRefs = productFormulaRows.map(({ productRow }) => cellAddress(productRow, 6));
  const productQuantityRefs = productFormulaRows.map(({ productRow }) => cellAddress(productRow, 3));
  const pureCostRow = ws.addRow(["Чистая себестоимость товаров", totals.pureProductsCostRub]);
  setFormula(pureCostRow.getCell(2), productTotalRefs.length ? `SUM(${productTotalRefs.join(",")})` : "0", totals.pureProductsCostRub);
  pureCostRow.getCell(2).numFmt = rubFormat;

  const deliveryRow = ws.addRow(["Доставка", totals.deliveryCostRub]);
  deliveryRow.getCell(2).numFmt = rubFormat;

  const bidSecurityRow = ws.addRow(["Обеспечение заявки", totals.bidSecurityAmountRub]);
  setFormula(bidSecurityRow.getCell(2), nmckCell ? `ROUND(${nmckCell}*${Number(calculation.bidSecurityPercent)}/100,2)` : `${totals.bidSecurityAmountRub}`, totals.bidSecurityAmountRub);
  bidSecurityRow.getCell(2).numFmt = rubFormat;

  const contractSecurityRow = ws.addRow(["Обеспечение контракта", totals.contractSecurityAmountRub]);
  setFormula(contractSecurityRow.getCell(2), nmckCell ? `ROUND(${nmckCell}*${Number(calculation.contractSecurityPercent)}/100,2)` : `${totals.contractSecurityAmountRub}`, totals.contractSecurityAmountRub);
  contractSecurityRow.getCell(2).numFmt = rubFormat;

  const warrantySecurityRow = ws.addRow(["Обеспечение гарантийных обязательств", totals.warrantySecurityAmountRub]);
  setFormula(warrantySecurityRow.getCell(2), nmckCell ? `ROUND(${nmckCell}*${Number(calculation.warrantySecurityPercent)}/100,2)` : `${totals.warrantySecurityAmountRub}`, totals.warrantySecurityAmountRub);
  warrantySecurityRow.getCell(2).numFmt = rubFormat;

  const bankGuaranteePercentRow = ws.addRow(["Процент БГ", Number(calculation.bankGuaranteePercent)]);
  bankGuaranteePercentRow.getCell(2).numFmt = percentFormat;

  const bankGuaranteeRow = ws.addRow(["Стоимость БГ", totals.bankGuaranteeCostRub]);
  setFormula(
    bankGuaranteeRow.getCell(2),
    `ROUND(SUM(${cellAddress(bidSecurityRow.number, 2)}:${cellAddress(warrantySecurityRow.number, 2)})*${cellAddress(bankGuaranteePercentRow.number, 2)}/100,2)`,
    totals.bankGuaranteeCostRub
  );
  bankGuaranteeRow.getCell(2).numFmt = rubFormat;

  const inputCostRow = ws.addRow(["Итоговый вход", totals.inputCostRub]);
  setFormula(inputCostRow.getCell(2), `ROUND(${cellAddress(pureCostRow.number, 2)}+${cellAddress(deliveryRow.number, 2)}+${cellAddress(bankGuaranteeRow.number, 2)},2)`, totals.inputCostRub);
  inputCostRow.getCell(2).numFmt = rubFormat;

  const sharedExtraCostRow = ws.addRow(["Доп. расходы на 1 шт", totals.sharedExtraCostPerUnit]);
  setFormula(
    sharedExtraCostRow.getCell(2),
    productQuantityRefs.length
      ? `IF(SUM(${productQuantityRefs.join(",")})>0,ROUND((${cellAddress(deliveryRow.number, 2)}+${cellAddress(bankGuaranteeRow.number, 2)})/SUM(${productQuantityRefs.join(",")}),2),0)`
      : "0",
    totals.sharedExtraCostPerUnit
  );
  sharedExtraCostRow.getCell(2).numFmt = rubFormat;

  for (const formulaRow of productFormulaRows) {
    const productRow = ws.getRow(formulaRow.productRow);
    const quantityCell = cellAddress(formulaRow.productRow, 3);
    const unitCostCell = cellAddress(formulaRow.productRow, 5);
    const inputUnitCell = cellAddress(formulaRow.productRow, 7);
    if (formulaRow.componentStart && formulaRow.componentEnd) {
      setFormula(
        productRow.getCell(5),
        `IF(COUNTIF(${cellAddress(formulaRow.componentStart, 7)}:${cellAddress(formulaRow.componentEnd, 7)},"Да")>0,ROUND(SUM(${cellAddress(formulaRow.componentStart, 6)}:${cellAddress(formulaRow.componentEnd, 6)}),2),${formulaRow.manualUnitCostRub})`,
        formulaRow.unitCostResult
      );
    }
    setFormula(productRow.getCell(6), `ROUND(${unitCostCell}*${quantityCell},2)`, formulaRow.totalCostResult);
    setFormula(productRow.getCell(7), `ROUND(${unitCostCell}+${cellAddress(sharedExtraCostRow.number, 2)},2)`, formulaRow.inputUnitResult);
    setFormula(productRow.getCell(8), `ROUND(${inputUnitCell}*${quantityCell},2)`, formulaRow.inputTotalResult);
  }
  ws.addRow([]);

  section(ws, "Сценарии маржи");
  tableHeader(ws, ["Маржа", "Вход", "Цена продажи", "Прибыль", "Фактическая маржа"]);
  for (const scenario of totals.marginScenarios) {
    const row = ws.addRow([scenario.marginPercent, scenario.inputCostRub, scenario.totalSalePriceRub, scenario.profitRub, scenario.actualMarginPercent]);
    setFormula(row.getCell(2), cellAddress(inputCostRow.number, 2), scenario.inputCostRub);
    setFormula(row.getCell(3), `ROUND(${cellAddress(row.number, 2)}/(1-${cellAddress(row.number, 1)}/100),2)`, scenario.totalSalePriceRub);
    setFormula(row.getCell(4), `ROUND(${cellAddress(row.number, 3)}-${cellAddress(row.number, 2)},2)`, scenario.profitRub);
    setFormula(row.getCell(5), `IF(${cellAddress(row.number, 3)}>0,ROUND(${cellAddress(row.number, 4)}/${cellAddress(row.number, 3)}*100,2),0)`, scenario.actualMarginPercent);
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
      setFormula(row.getCell(2), nmckCell ? `ROUND(${nmckCell}*(1-${cellAddress(row.number, 1)}/100),2)` : "0", scenario.auctionPriceRub);
      setFormula(row.getCell(3), cellAddress(inputCostRow.number, 2), scenario.inputCostRub);
      setFormula(row.getCell(4), `ROUND(${cellAddress(row.number, 2)}-${cellAddress(row.number, 3)},2)`, scenario.auctionProfitRub);
      setFormula(row.getCell(5), `IF(${cellAddress(row.number, 2)}>0,ROUND(${cellAddress(row.number, 4)}/${cellAddress(row.number, 2)}*100,2),0)`, scenario.auctionMarginPercent);
      setFormula(row.getCell(6), `IF(${cellAddress(row.number, 2)}>=${cellAddress(row.number, 3)},"Выше входа","Ниже входа")`, scenario.isAboveInput ? "Выше входа" : "Ниже входа");
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
