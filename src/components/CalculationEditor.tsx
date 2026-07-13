"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculate } from "@/lib/calculations";
import { calculationTypeLabels, money, percent } from "@/lib/format";

type AnyCalculation = Record<string, any>;

const emptyComponent = (name = "Комплектующая") => ({
  name,
  characteristics: "",
  comment: "",
  quantityPerProduct: 1,
  priceRub: 0,
  priceUsd: 0,
  inputCurrency: "RUB",
  isIncluded: true,
  sourceType: "manual",
  distributorName: "",
  sortOrder: 0
});

const emptyProduct = () => ({
  name: "Новое изделие",
  category: "",
  quantity: 1,
  registryNumber: "",
  comment: "",
  manualPurchasePriceRub: 0,
  manualPurchasePriceUsd: 0,
  useManualPurchasePrice: true,
  sortOrder: 0,
  components: []
});

export function CalculationEditor({ id }: { id: string }) {
  const [user, setUser] = useState<any>(null);
  const [calc, setCalc] = useState<AnyCalculation | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const [meRes, calcRes, templatesRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch(`/api/calculations/${id}`),
      fetch("/api/templates")
    ]);
    const me = await meRes.json();
    const calcData = await calcRes.json();
    const templateData = templatesRes.ok ? await templatesRes.json() : { templates: [] };
    setUser(me.user);
    setCalc(calcData.calculation);
    setTemplates(templateData.templates || []);
  }

  const readOnly = Boolean(user?.role === "ADMIN" && calc?.owner?.login && calc.owner.login !== user.login);
  const totals = useMemo(() => (calc ? calculate(calc as any) : null), [calc]);

  function update(field: string, value: any) {
    setCalc((current) => current ? { ...current, [field]: value } : current);
  }

  function updateProduct(index: number, field: string, value: any) {
    setCalc((current) => {
      if (!current) return current;
      const products = [...current.products];
      products[index] = { ...products[index], [field]: value };
      return { ...current, products };
    });
  }

  function updateComponent(productIndex: number, componentIndex: number, field: string, value: any) {
    setCalc((current) => {
      if (!current) return current;
      const products = [...current.products];
      const components = [...products[productIndex].components];
      const next = { ...components[componentIndex], [field]: value };
      const rate = Number(current.currencyRateUsdRub || 1);
      if (field === "priceRub") next.priceUsd = rate > 0 ? Number(value || 0) / rate : 0;
      if (field === "priceUsd") next.priceRub = Number(value || 0) * rate;
      components[componentIndex] = next;
      products[productIndex] = { ...products[productIndex], components };
      return { ...current, products };
    });
  }

  function addProduct() {
    setCalc((current) => current ? { ...current, products: [...current.products, { ...emptyProduct(), sortOrder: current.products.length }] } : current);
  }

  function removeProduct(index: number) {
    setCalc((current) => current ? { ...current, products: current.products.filter((_: any, i: number) => i !== index) } : current);
  }

  function addComponent(productIndex: number, component = emptyComponent()) {
    setCalc((current) => {
      if (!current) return current;
      const products = [...current.products];
      const components = [...products[productIndex].components, { ...component, sortOrder: products[productIndex].components.length }];
      products[productIndex] = { ...products[productIndex], components, useManualPurchasePrice: false };
      return { ...current, products };
    });
  }

  function removeComponent(productIndex: number, componentIndex: number) {
    setCalc((current) => {
      if (!current) return current;
      const products = [...current.products];
      products[productIndex] = { ...products[productIndex], components: products[productIndex].components.filter((_: any, i: number) => i !== componentIndex) };
      return { ...current, products };
    });
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const product = {
      ...emptyProduct(),
      name: template.name,
      category: template.category || "",
      useManualPurchasePrice: false,
      components: template.components.map((component: any, index: number) => ({
        ...emptyComponent(component.name),
        characteristics: component.characteristics || "",
        quantityPerProduct: Number(component.quantityPerProduct || 1),
        priceRub: Number(component.priceRub || 0),
        priceUsd: Number(component.priceUsd || 0),
        inputCurrency: component.inputCurrency || "RUB",
        sourceType: "template",
        sortOrder: index
      }))
    };
    setCalc((current) => current ? { ...current, products: [...current.products, product] } : current);
  }

  async function save() {
    if (!calc || readOnly) return;
    setError("");
    setMessage("");
    const res = await fetch(`/api/calculations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calc)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось сохранить");
      return;
    }
    setCalc(data.calculation);
    setMessage("Сохранено");
  }

  async function remove() {
    if (!confirm("Удалить расчёт?")) return;
    const res = await fetch(`/api/calculations/${id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/";
    else setError("Не удалось удалить расчёт");
  }

  if (!calc || !totals) return <main className="p-8">Загрузка...</main>;

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <Link href="/" className="text-sm text-accent">← к списку</Link>
            <h1 className="mt-1 text-xl font-semibold">{calc.title || "Расчёт"}</h1>
            <p className="text-sm text-muted">{calc.owner?.login || user?.login} · {readOnly ? "только просмотр" : "редактирование"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn" href={`/api/calculations/${id}/export`}>Excel</a>
            {!readOnly && <button className="btn btn-primary" onClick={save}>Сохранить</button>}
            {!readOnly && <button className="btn btn-danger" onClick={remove}>Удалить</button>}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {(message || error || calc.isManualCurrencyRate) && (
            <div className={`rounded-md px-3 py-2 text-sm ${error || calc.isManualCurrencyRate ? "bg-amber-50 text-warning" : "bg-emerald-50 text-accent"}`}>
              {error || message || "Используется ручной курс"}
            </div>
          )}

          <div className="panel p-4">
            <h2 className="mb-4 font-semibold">Карточка</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Название (необязательно)"><input disabled={readOnly} className="field" placeholder="Сформируется автоматически" value={calc.title || ""} onChange={(e) => update("title", e.target.value)} /></Field>
              <Field label="Тип">
                <select disabled={readOnly} className="field" value={calc.type} onChange={(e) => update("type", e.target.value)}>
                  {Object.entries(calculationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Курс USD/RUB">
                <NumericField disabled={readOnly} value={calc.currencyRateUsdRub || ""} onValueChange={(value) => { update("currencyRateUsdRub", value); update("isManualCurrencyRate", true); }} />
              </Field>
              <Field label="Заказчик"><input disabled={readOnly} className="field" value={calc.customerName || ""} onChange={(e) => update("customerName", e.target.value)} /></Field>
              <Field label="ИНН"><input disabled={readOnly} className="field" value={calc.customerInn || ""} onChange={(e) => update("customerInn", e.target.value)} /></Field>
              <Field label="Город"><input disabled={readOnly} className="field" value={calc.customerCity || ""} onChange={(e) => update("customerCity", e.target.value)} /></Field>
              <Field label="Доставка, ₽"><NumericField disabled={readOnly} value={calc.deliveryCostRub || 0} onValueChange={(value) => update("deliveryCostRub", value)} /></Field>
            </div>
          </div>

          {calc.type === "AUCTION" && (
            <div className="panel p-4">
              <h2 className="mb-4 font-semibold">Аукцион</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Номер закупки"><input disabled={readOnly} className="field" value={calc.purchaseNumber || ""} onChange={(e) => update("purchaseNumber", e.target.value)} /></Field>
                <Field label="Ссылка"><input disabled={readOnly} className="field" value={calc.purchaseLink || ""} onChange={(e) => update("purchaseLink", e.target.value)} /></Field>
                <Field label="Площадка"><input disabled={readOnly} className="field" value={calc.platformName || ""} onChange={(e) => update("platformName", e.target.value)} /></Field>
                <Field label="НМЦК, ₽"><NumericField disabled={readOnly} value={calc.nmckRub || 0} onValueChange={(value) => update("nmckRub", value)} /></Field>
                <Field label="Заявки до"><input disabled={readOnly} className="field" type="date" value={calc.applicationDeadline ? String(calc.applicationDeadline).slice(0, 10) : ""} onChange={(e) => update("applicationDeadline", e.target.value)} /></Field>
                <Field label="Поставка"><input disabled={readOnly} className="field" value={calc.deliveryTerms || ""} onChange={(e) => update("deliveryTerms", e.target.value)} /></Field>
                <Field label="Гарантия"><input disabled={readOnly} className="field" value={calc.warrantyTerms || ""} onChange={(e) => update("warrantyTerms", e.target.value)} /></Field>
                <Field label="Своя ставка, %"><NumericField disabled={readOnly} value={calc.customAuctionDiscount ?? ""} nullable onValueChange={(value) => update("customAuctionDiscount", value)} /></Field>
              </div>
            </div>
          )}

          <div className="panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Изделия и комплектация</h2>
            </div>
            <div className="space-y-4">
              {calc.products.map((product: any, productIndex: number) => {
                const productTotal = totals.productRows[productIndex];
                return (
                  <div key={product.id || productIndex} className="rounded-md border border-line p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(160px,0.7fr)_90px_minmax(180px,0.8fr)_auto]">
                      <input disabled={readOnly} className="field" placeholder="Наименование изделия" value={product.name || ""} onChange={(e) => updateProduct(productIndex, "name", e.target.value)} />
                      <input disabled={readOnly} className="field" placeholder="Категория" value={product.category || ""} onChange={(e) => updateProduct(productIndex, "category", e.target.value)} />
                      <NumericField disabled={readOnly} className="field text-center" aria-label="Количество" placeholder="Кол-во" value={product.quantity || 0} onValueChange={(value) => updateProduct(productIndex, "quantity", value)} />
                      <input disabled={readOnly} className="field" placeholder="Реестровый номер" value={product.registryNumber || ""} onChange={(e) => updateProduct(productIndex, "registryNumber", e.target.value)} />
                      {!readOnly && <button className="btn btn-danger sm:justify-self-start xl:justify-self-auto" onClick={() => removeProduct(productIndex)}>Удалить</button>}
                    </div>
                    <div className="mt-2 text-sm text-muted">
                      Закупка 1 шт: <b>{money(productTotal?.productUnitCostRub || 0)}</b> · вход 1 шт: <b>{money(productTotal?.inputUnitCostRub || 0)}</b> · всего вход: <b>{money(productTotal?.inputTotalCostRub || 0)}</b>
                    </div>
                    <div className="component-table-wrap mt-3">
                    <table className="table component-table">
                      <colgroup>
                        <col className="component-include-col" />
                        <col className="component-name-col" />
                        <col className="component-characteristics-col" />
                        <col className="component-quantity-col" />
                        <col className="component-price-col" />
                        <col className="component-price-col" />
                        <col className="component-delete-col" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Учитывать</th>
                          <th>Комплектующая</th>
                          <th>Характеристики</th>
                          <th>Кол-во</th>
                          <th>USD</th>
                          <th>RUB</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.components.map((component: any, componentIndex: number) => (
                          <tr key={component.id || componentIndex}>
                            <td><input disabled={readOnly} type="checkbox" checked={component.isIncluded} onChange={(e) => updateComponent(productIndex, componentIndex, "isIncluded", e.target.checked)} /></td>
                            <td><AutoTextarea disabled={readOnly} value={component.name || ""} onChange={(value) => updateComponent(productIndex, componentIndex, "name", value)} /></td>
                            <td><AutoTextarea disabled={readOnly} value={component.characteristics || ""} onChange={(value) => updateComponent(productIndex, componentIndex, "characteristics", value)} /></td>
                            <td><NumericField disabled={readOnly} className="field text-center" value={component.quantityPerProduct || 0} onValueChange={(value) => updateComponent(productIndex, componentIndex, "quantityPerProduct", value)} /></td>
                            <td><NumericField disabled={readOnly} value={component.priceUsd || 0} onValueChange={(value) => updateComponent(productIndex, componentIndex, "priceUsd", value)} /></td>
                            <td><NumericField disabled={readOnly} value={component.priceRub || 0} onValueChange={(value) => updateComponent(productIndex, componentIndex, "priceRub", value)} /></td>
                            <td>{!readOnly && <button className="btn btn-danger" onClick={() => removeComponent(productIndex, componentIndex)}>×</button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {!readOnly && <button className="btn mt-3" onClick={() => addComponent(productIndex)}>+ Комплектующая</button>}
                  </div>
                );
              })}
            </div>
            {!readOnly && (
              <div className="product-add-bar mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <select className="field sm:max-w-sm" aria-label="Добавить изделие из шаблона" onChange={(e) => { applyTemplate(e.target.value); e.currentTarget.value = ""; }}>
                  <option value="">Добавить из шаблона</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isGlobal ? " · общий" : ""}</option>)}
                </select>
                <button className="btn btn-primary sm:min-w-[176px]" onClick={addProduct}>+ Добавить изделие</button>
              </div>
            )}
          </div>
        </div>

        <aside className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:block xl:space-y-3">
          <div className="panel summary-panel p-3">
            <h2 className="mb-3 text-sm font-semibold">Обеспечения</h2>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Заявка, %"><NumericField disabled={readOnly} value={calc.bidSecurityPercent || 0} onValueChange={(value) => update("bidSecurityPercent", value)} /></Field>
              <Field label="Контракт, %"><NumericField disabled={readOnly} value={calc.contractSecurityPercent || 0} onValueChange={(value) => update("contractSecurityPercent", value)} /></Field>
              <Field label="Гарантия, %"><NumericField disabled={readOnly} value={calc.warrantySecurityPercent || 0} onValueChange={(value) => update("warrantySecurityPercent", value)} /></Field>
              <Field label="БГ, %"><NumericField disabled={readOnly} value={calc.bankGuaranteePercent || 0} onValueChange={(value) => update("bankGuaranteePercent", value)} /></Field>
            </div>
          </div>

          <div className="panel summary-panel p-3">
            <h2 className="mb-2 text-sm font-semibold">Итоги</h2>
            <Metric label="Чистая себестоимость" value={money(totals.pureProductsCostRub)} />
            <Metric label="Доставка" value={money(totals.deliveryCostRub)} />
            <Metric label="Стоимость БГ" value={money(totals.bankGuaranteeCostRub)} />
            <Metric label="Итоговый вход" value={money(totals.inputCostRub)} strong />
          </div>

          <div className="panel summary-panel p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Маржа</h2>
              <NumericField disabled={readOnly} className="field w-20 px-2 py-1.5" aria-label="Своя маржа" placeholder="Своя" value={calc.customMarginPercent ?? ""} nullable onValueChange={(value) => update("customMarginPercent", value)} />
            </div>
            {totals.marginScenarios.map((scenario) => (
              <div key={scenario.marginPercent} className="border-b border-line py-1.5 text-sm last:border-0">
                <div className="flex justify-between"><b>{percent(scenario.marginPercent)}</b><span>{money(scenario.totalSalePriceRub)}</span></div>
                <div className={`text-xs ${scenario.profitRub < 0 ? "text-danger" : "text-muted"}`}>Прибыль {money(scenario.profitRub)} · факт {percent(scenario.actualMarginPercent)}</div>
              </div>
            ))}
          </div>

          {calc.type === "AUCTION" && (
            <div className="panel summary-panel p-3">
              <h2 className="mb-2 text-sm font-semibold">Торги</h2>
              {totals.auctionScenarios.map((scenario) => (
                <div key={scenario.discountPercent} className="border-b border-line py-1.5 text-sm last:border-0">
                  <div className="flex justify-between"><b>{percent(scenario.discountPercent)}</b><span>{money(scenario.auctionPriceRub)}</span></div>
                  <div className={scenario.isAboveInput ? "text-accent" : "text-danger"}>{scenario.isAboveInput ? "Выше входа" : "Ниже входа"} · {money(scenario.auctionProfitRub)} · {percent(scenario.auctionMarginPercent)}</div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

function NumericField({
  value,
  onValueChange,
  nullable = false,
  className = "field",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number | string | null | undefined;
  onValueChange: (value: number | null) => void;
  nullable?: boolean;
}) {
  return (
    <input
      {...props}
      className={className}
      inputMode="decimal"
      value={value ?? ""}
      onChange={(event) => {
        const normalized = normalizeNumberInput(event.target.value);
        onValueChange(normalized === "" && nullable ? null : Number(normalized || 0));
      }}
    />
  );
}

function AutoTextarea({
  value,
  onChange,
  className = "field component-textarea",
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      {...props}
      rows={1}
      className={className}
      value={value}
      ref={resizeTextarea}
      onChange={(event) => {
        onChange(event.target.value);
        resizeTextarea(event.currentTarget);
      }}
    />
  );
}

function normalizeNumberInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = cleaned.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  if (decimalParts.length) return `${integer || "0"}.${decimalParts.join("")}`;
  return integer;
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-line py-2 text-sm last:border-0 ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
