"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculate } from "@/lib/calculations";
import { calculationStatusLabels, calculationTypeLabels, money, percent, usd } from "@/lib/format";

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
  const [priceQuery, setPriceQuery] = useState("");
  const [priceItems, setPriceItems] = useState<any[]>([]);

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

  async function searchPrices() {
    const res = await fetch(`/api/prices/search?q=${encodeURIComponent(priceQuery)}`);
    if (res.ok) setPriceItems((await res.json()).items);
  }

  if (!calc || !totals) return <main className="p-8">Загрузка...</main>;

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/" className="text-sm text-accent">← к списку</Link>
            <h1 className="mt-1 text-xl font-semibold">{calc.title || "Расчёт"}</h1>
            <p className="text-sm text-muted">{calc.owner?.login || user?.login} · {readOnly ? "только просмотр" : "редактирование"}</p>
          </div>
          <div className="flex gap-2">
            <a className="btn" href={`/api/calculations/${id}/export`}>Excel</a>
            {!readOnly && <button className="btn btn-primary" onClick={save}>Сохранить</button>}
            {!readOnly && <button className="btn btn-danger" onClick={remove}>Удалить</button>}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-[1fr_340px] gap-5 px-6 py-6">
        <div className="space-y-5">
          {(message || error || calc.isManualCurrencyRate) && (
            <div className={`rounded-md px-3 py-2 text-sm ${error || calc.isManualCurrencyRate ? "bg-amber-50 text-warning" : "bg-emerald-50 text-accent"}`}>
              {error || message || "Используется ручной курс"}
            </div>
          )}

          <div className="panel p-4">
            <h2 className="mb-4 font-semibold">Карточка</h2>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Название"><input disabled={readOnly} className="field" value={calc.title || ""} onChange={(e) => update("title", e.target.value)} /></Field>
              <Field label="Тип">
                <select disabled={readOnly} className="field" value={calc.type} onChange={(e) => update("type", e.target.value)}>
                  {Object.entries(calculationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Статус">
                <select disabled={readOnly} className="field" value={calc.status} onChange={(e) => update("status", e.target.value)}>
                  {Object.entries(calculationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Курс USD/RUB">
                <input disabled={readOnly} className="field" type="number" step="0.0001" value={calc.currencyRateUsdRub || ""} onChange={(e) => { update("currencyRateUsdRub", Number(e.target.value)); update("isManualCurrencyRate", true); }} />
              </Field>
              <Field label="Заказчик"><input disabled={readOnly} className="field" value={calc.customerName || ""} onChange={(e) => update("customerName", e.target.value)} /></Field>
              <Field label="ИНН"><input disabled={readOnly} className="field" value={calc.customerInn || ""} onChange={(e) => update("customerInn", e.target.value)} /></Field>
              <Field label="Город"><input disabled={readOnly} className="field" value={calc.customerCity || ""} onChange={(e) => update("customerCity", e.target.value)} /></Field>
              <Field label="Доставка, ₽"><input disabled={readOnly} className="field" type="number" value={calc.deliveryCostRub || 0} onChange={(e) => update("deliveryCostRub", Number(e.target.value))} /></Field>
            </div>
          </div>

          {calc.type === "AUCTION" && (
            <div className="panel p-4">
              <h2 className="mb-4 font-semibold">Аукцион</h2>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Номер закупки"><input disabled={readOnly} className="field" value={calc.purchaseNumber || ""} onChange={(e) => update("purchaseNumber", e.target.value)} /></Field>
                <Field label="Ссылка"><input disabled={readOnly} className="field" value={calc.purchaseLink || ""} onChange={(e) => update("purchaseLink", e.target.value)} /></Field>
                <Field label="Площадка"><input disabled={readOnly} className="field" value={calc.platformName || ""} onChange={(e) => update("platformName", e.target.value)} /></Field>
                <Field label="НМЦК, ₽"><input disabled={readOnly} className="field" type="number" value={calc.nmckRub || 0} onChange={(e) => update("nmckRub", Number(e.target.value))} /></Field>
                <Field label="Заявки до"><input disabled={readOnly} className="field" type="date" value={calc.applicationDeadline ? String(calc.applicationDeadline).slice(0, 10) : ""} onChange={(e) => update("applicationDeadline", e.target.value)} /></Field>
                <Field label="Поставка"><input disabled={readOnly} className="field" value={calc.deliveryTerms || ""} onChange={(e) => update("deliveryTerms", e.target.value)} /></Field>
                <Field label="Гарантия"><input disabled={readOnly} className="field" value={calc.warrantyTerms || ""} onChange={(e) => update("warrantyTerms", e.target.value)} /></Field>
                <Field label="Своя ставка, %"><input disabled={readOnly} className="field" type="number" value={calc.customAuctionDiscount || ""} onChange={(e) => update("customAuctionDiscount", e.target.value ? Number(e.target.value) : null)} /></Field>
              </div>
            </div>
          )}

          <div className="panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Изделия и комплектация</h2>
              {!readOnly && <button className="btn" onClick={addProduct}>+ Изделие</button>}
            </div>
            <div className="mb-4 flex gap-2">
              <select disabled={readOnly} className="field max-w-sm" onChange={(e) => { applyTemplate(e.target.value); e.currentTarget.value = ""; }}>
                <option value="">Добавить из шаблона</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isGlobal ? " · общий" : ""}</option>)}
              </select>
              <input className="field max-w-sm" placeholder="Поиск по прайсам" value={priceQuery} onChange={(e) => setPriceQuery(e.target.value)} />
              <button className="btn" onClick={searchPrices}>Найти</button>
            </div>
            {priceItems.length > 0 && (
              <div className="mb-4 rounded-md border border-line bg-panel p-3 text-sm">
                {priceItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex justify-between border-b border-line py-1 last:border-0">
                    <span>{item.name} · {item.distributorName}</span>
                    <span>{item.priceRub ? money(Number(item.priceRub)) : usd(Number(item.priceUsd || 0))}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-4">
              {calc.products.map((product: any, productIndex: number) => {
                const productTotal = totals.productRows[productIndex];
                return (
                  <div key={product.id || productIndex} className="rounded-md border border-line p-3">
                    <div className="grid grid-cols-[1.2fr_1fr_100px_1.2fr_auto] gap-2">
                      <input disabled={readOnly} className="field" value={product.name || ""} onChange={(e) => updateProduct(productIndex, "name", e.target.value)} />
                      <input disabled={readOnly} className="field" placeholder="Категория" value={product.category || ""} onChange={(e) => updateProduct(productIndex, "category", e.target.value)} />
                      <input disabled={readOnly} className="field" type="number" min="0" value={product.quantity || 0} onChange={(e) => updateProduct(productIndex, "quantity", Number(e.target.value))} />
                      <input disabled={readOnly} className="field" placeholder="Реестровый номер" value={product.registryNumber || ""} onChange={(e) => updateProduct(productIndex, "registryNumber", e.target.value)} />
                      {!readOnly && <button className="btn btn-danger" onClick={() => removeProduct(productIndex)}>Удалить</button>}
                    </div>
                    <div className="mt-2 text-sm text-muted">
                      Закупка 1 шт: <b>{money(productTotal?.productUnitCostRub || 0)}</b> · вход 1 шт: <b>{money(productTotal?.inputUnitCostRub || 0)}</b> · всего вход: <b>{money(productTotal?.inputTotalCostRub || 0)}</b>
                    </div>
                    <table className="table mt-3">
                      <thead>
                        <tr>
                          <th>Учитывать</th>
                          <th>Комплектующая</th>
                          <th>Характеристики</th>
                          <th>Кол-во</th>
                          <th>RUB</th>
                          <th>USD</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.components.map((component: any, componentIndex: number) => (
                          <tr key={component.id || componentIndex}>
                            <td><input disabled={readOnly} type="checkbox" checked={component.isIncluded} onChange={(e) => updateComponent(productIndex, componentIndex, "isIncluded", e.target.checked)} /></td>
                            <td><input disabled={readOnly} className="field" value={component.name || ""} onChange={(e) => updateComponent(productIndex, componentIndex, "name", e.target.value)} /></td>
                            <td><input disabled={readOnly} className="field" value={component.characteristics || ""} onChange={(e) => updateComponent(productIndex, componentIndex, "characteristics", e.target.value)} /></td>
                            <td><input disabled={readOnly} className="field" type="number" value={component.quantityPerProduct || 0} onChange={(e) => updateComponent(productIndex, componentIndex, "quantityPerProduct", Number(e.target.value))} /></td>
                            <td><input disabled={readOnly} className="field" type="number" value={component.priceRub || 0} onChange={(e) => updateComponent(productIndex, componentIndex, "priceRub", Number(e.target.value))} /></td>
                            <td><input disabled={readOnly} className="field" type="number" value={component.priceUsd || 0} onChange={(e) => updateComponent(productIndex, componentIndex, "priceUsd", Number(e.target.value))} /></td>
                            <td>{!readOnly && <button className="btn btn-danger" onClick={() => removeComponent(productIndex, componentIndex)}>×</button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!readOnly && <button className="btn mt-3" onClick={() => addComponent(productIndex)}>+ Комплектующая</button>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">Обеспечения</h2>
            <Field label="Заявка, %"><input disabled={readOnly} className="field" type="number" value={calc.bidSecurityPercent || 0} onChange={(e) => update("bidSecurityPercent", Number(e.target.value))} /></Field>
            <Field label="Контракт, %"><input disabled={readOnly} className="field" type="number" value={calc.contractSecurityPercent || 0} onChange={(e) => update("contractSecurityPercent", Number(e.target.value))} /></Field>
            <Field label="Гарантия, %"><input disabled={readOnly} className="field" type="number" value={calc.warrantySecurityPercent || 0} onChange={(e) => update("warrantySecurityPercent", Number(e.target.value))} /></Field>
            <Field label="БГ, %"><input disabled={readOnly} className="field" type="number" value={calc.bankGuaranteePercent || 0} onChange={(e) => update("bankGuaranteePercent", Number(e.target.value))} /></Field>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">Итоги</h2>
            <Metric label="Чистая себестоимость" value={money(totals.pureProductsCostRub)} />
            <Metric label="Доставка" value={money(totals.deliveryCostRub)} />
            <Metric label="Стоимость БГ" value={money(totals.bankGuaranteeCostRub)} />
            <Metric label="Итоговый вход" value={money(totals.inputCostRub)} strong />
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Маржа</h2>
              <input disabled={readOnly} className="field w-24" type="number" placeholder="Своя" value={calc.customMarginPercent || ""} onChange={(e) => update("customMarginPercent", e.target.value ? Number(e.target.value) : null)} />
            </div>
            {totals.marginScenarios.map((scenario) => (
              <div key={scenario.marginPercent} className="mb-2 rounded-md border border-line p-2 text-sm">
                <div className="flex justify-between"><b>{percent(scenario.marginPercent)}</b><span>{money(scenario.totalSalePriceRub)}</span></div>
                <div className={scenario.profitRub < 0 ? "text-danger" : "text-accent"}>Прибыль {money(scenario.profitRub)} · факт {percent(scenario.actualMarginPercent)}</div>
              </div>
            ))}
          </div>

          {calc.type === "AUCTION" && (
            <div className="panel p-4">
              <h2 className="mb-3 font-semibold">Торги</h2>
              {totals.auctionScenarios.map((scenario) => (
                <div key={scenario.discountPercent} className="mb-2 rounded-md border border-line p-2 text-sm">
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

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-line py-2 text-sm last:border-0 ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
