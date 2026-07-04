"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculationStatusLabels, calculationTypeLabels, money } from "@/lib/format";

type User = { id: string; login: string; email?: string; role: "USER" | "ADMIN" };
type CalculationListItem = {
  id: string;
  title: string | null;
  type: keyof typeof calculationTypeLabels;
  status: keyof typeof calculationStatusLabels;
  customerName: string | null;
  customerInn: string | null;
  purchaseNumber: string | null;
  updatedAt: string;
  owner?: { login: string };
  products: Array<{ id: string }>;
};

export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<CalculationListItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
  }

  async function loadCalculations() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    const res = await fetch(`/api/calculations?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.calculations);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) loadCalculations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, q, type, status]);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось войти");
      return;
    }
    setUser(data.user);
  }

  async function submitRegister(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось отправить заявку");
      return;
    }
    setAuthMode("login");
    setPassword("");
    setError("Заявка создана. Войти можно после одобрения администратором.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function createCalculation(kind: "AUCTION" | "COMMERCIAL_OFFER" | "DRAFT") {
    const rateRes = await fetch("/api/currency");
    const { rate } = await rateRes.json();
    const res = await fetch("/api/calculations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: kind,
        status: "DRAFT",
        title: "",
        currencyRateUsdRub: rate,
        isManualCurrencyRate: false,
        deliveryCostRub: 0,
        bidSecurityPercent: 0,
        contractSecurityPercent: 0,
        warrantySecurityPercent: 0,
        bankGuaranteePercent: 5,
        products: []
      })
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/calculations/${data.calculation.id}`;
    else setError(data.error || "Не удалось создать расчёт");
  }

  async function copyCalculation(id: string) {
    const res = await fetch(`/api/calculations/${id}/copy`, { method: "POST" });
    const data = await res.json();
    if (res.ok) window.location.href = `/calculations/${data.calculation.id}`;
    else setError(data.error || "Не удалось скопировать");
  }

  const typeOptions = useMemo(() => Object.entries(calculationTypeLabels), []);
  const statusOptions = useMemo(() => Object.entries(calculationStatusLabels), []);

  if (loading) return <main className="p-8">Загрузка...</main>;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <form onSubmit={authMode === "login" ? submitLogin : submitRegister} className="panel w-full max-w-sm p-6 shadow-sm">
          <h1 className="mb-5 text-xl font-semibold">Вход в расчёты</h1>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" className={`btn ${authMode === "login" ? "btn-primary" : ""}`} onClick={() => setAuthMode("login")}>Вход</button>
            <button type="button" className={`btn ${authMode === "register" ? "btn-primary" : ""}`} onClick={() => setAuthMode("register")}>Регистрация</button>
          </div>
          <label className="label">Email</label>
          <input className="field mb-3" type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">Пароль</label>
          <input className="field mb-4" type="password" minLength={authMode === "register" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>}
          <button className="btn btn-primary w-full">{authMode === "login" ? "Войти" : "Отправить заявку"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Расчёты отдела продаж</h1>
            <p className="text-sm text-muted">{user.email || user.login} · {user.role === "ADMIN" ? "Администратор" : "Менеджер"}</p>
          </div>
          <div className="flex gap-2">
            {user.role === "ADMIN" && <Link className="btn" href="/admin">Админка</Link>}
            <button className="btn" onClick={logout}>Выйти</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => createCalculation("AUCTION")}>+ Аукцион</button>
            <button className="btn" onClick={() => createCalculation("COMMERCIAL_OFFER")}>+ КП</button>
            <button className="btn" onClick={() => createCalculation("DRAFT")}>+ Черновик</button>
          </div>
          {error && <div className="text-sm text-danger">{error}</div>}
        </div>

        <div className="panel mb-4 grid grid-cols-[minmax(260px,1fr)_180px_180px] gap-3 p-4">
          <input className="field" placeholder="Поиск: название, номер закупки, ИНН" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Все типы</option>
            {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="panel overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Заказчик</th>
                <th>Менеджер</th>
                <th>Обновлено</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="font-medium text-accent" href={`/calculations/${item.id}`}>{item.title || "Без названия"}</Link>
                    <div className="text-xs text-muted">{item.purchaseNumber || "без номера закупки"} · {item.products.length} изд.</div>
                  </td>
                  <td>{calculationTypeLabels[item.type]}</td>
                  <td>{calculationStatusLabels[item.status]}</td>
                  <td>{item.customerName || "—"}<div className="text-xs text-muted">{item.customerInn || ""}</div></td>
                  <td>{item.owner?.login || "—"}</td>
                  <td>{new Date(item.updatedAt).toLocaleString("ru-RU")}</td>
                  <td className="text-right">
                    <button className="btn" onClick={() => copyCalculation(item.id)}>Копировать</button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">Расчётов пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
