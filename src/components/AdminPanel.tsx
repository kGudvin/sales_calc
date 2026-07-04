"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [userForm, setUserForm] = useState({ email: "", password: "", role: "USER" });
  const [categoryName, setCategoryName] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateComponents, setTemplateComponents] = useState("Корпус\nПроцессор\nОперативная память");
  const [priceDistributor, setPriceDistributor] = useState("");
  const [priceFile, setPriceFile] = useState<File | null>(null);
  const [settings, setSettings] = useState({ margins: [10, 15, 20, 25, 30], defaultBankGuaranteePercent: 5 });

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    const [usersRes, categoriesRes, settingsRes, pricesRes, templatesRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/categories"),
      fetch("/api/admin/settings"),
      fetch("/api/admin/prices"),
      fetch("/api/templates")
    ]);
    if (usersRes.status === 403 || usersRes.status === 401) {
      window.location.href = "/";
      return;
    }
    setUsers((await usersRes.json()).users || []);
    setCategories((await categoriesRes.json()).categories || []);
    setSettings((await settingsRes.json()).settings || settings);
    setPrices((await pricesRes.json()).distributors || []);
    setTemplates((await templatesRes.json()).templates || []);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm)
    });
    setMessage(res.ok ? "Пользователь создан" : (await res.json()).error);
    setUserForm({ email: "", password: "", role: "USER" });
    loadAll();
  }

  async function updateUser(user: any, patch: Record<string, unknown>) {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, ...patch })
    });
    loadAll();
  }

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName })
    });
    setCategoryName("");
    loadAll();
  }

  async function createTemplate(event: React.FormEvent) {
    event.preventDefault();
    const components = templateComponents.split("\n").map((name, index) => ({ name: name.trim(), quantityPerProduct: 1, sortOrder: index })).filter((item) => item.name);
    const res = await fetch(editingTemplateId ? `/api/templates/${editingTemplateId}` : "/api/templates", {
      method: editingTemplateId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: templateName,
        isGlobal: true,
        components
      })
    });
    setMessage(res.ok ? (editingTemplateId ? "Шаблон обновлён" : "Шаблон создан") : (await res.json()).error);
    resetTemplateForm();
    loadAll();
  }

  function editTemplate(template: any) {
    setEditingTemplateId(template.id);
    setTemplateName(template.name || "");
    setTemplateComponents((template.components || []).map((component: any) => component.name).join("\n"));
  }

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateComponents("Корпус\nПроцессор\nОперативная память");
  }

  async function deleteTemplate(template: any) {
    if (!confirm(`Удалить шаблон "${template.name}"?`)) return;
    const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    setMessage(res.ok ? "Шаблон удалён" : (await res.json()).error);
    if (editingTemplateId === template.id) resetTemplateForm();
    loadAll();
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setMessage("Настройки сохранены");
    loadAll();
  }

  async function uploadPrice(event: React.FormEvent) {
    event.preventDefault();
    if (!priceFile) return;
    const form = new FormData();
    form.append("distributorName", priceDistributor);
    form.append("file", priceFile);
    const res = await fetch("/api/admin/prices", { method: "POST", body: form });
    const data = await res.json();
    setMessage(res.ok ? `Импортировано позиций: ${data.imported}` : data.error);
    setPriceDistributor("");
    setPriceFile(null);
    loadAll();
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/" className="text-sm text-accent">← к расчётам</Link>
            <h1 className="mt-1 text-xl font-semibold">Администрирование</h1>
          </div>
          {message && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-accent">{message}</div>}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-6 py-6">
        <div className="panel p-4">
          <h2 className="mb-4 font-semibold">Пользователи</h2>
          <form onSubmit={createUser} className="mb-4 grid grid-cols-[1fr_1fr_140px_auto] gap-2">
            <input className="field" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <input className="field" placeholder="Пароль" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            <select className="field" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button className="btn btn-primary">Создать</button>
          </form>
          <table className="table">
            <thead><tr><th>Email</th><th>Роль</th><th>Доступ</th><th></th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email || user.login}</td>
                  <td>
                    <select className="field" value={user.role} onChange={(e) => updateUser(user, { role: e.target.value })}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td><input type="checkbox" checked={user.isActive} onChange={(e) => updateUser(user, { isActive: e.target.checked })} /></td>
                  <td><button className="btn" onClick={() => { const password = prompt("Новый пароль"); if (password) updateUser(user, { password }); }}>Пароль</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 font-semibold">Категории</h2>
          <form onSubmit={createCategory} className="mb-4 flex gap-2">
            <input className="field" placeholder="Название категории" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <button className="btn btn-primary">Добавить</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => <span key={category.id} className="rounded-md border border-line bg-panel px-3 py-2 text-sm">{category.name}</span>)}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 font-semibold">Общие шаблоны</h2>
          <form onSubmit={createTemplate} className="space-y-2">
            <input className="field" placeholder="Название шаблона" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <textarea className="field min-h-28" value={templateComponents} onChange={(e) => setTemplateComponents(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary">{editingTemplateId ? "Сохранить шаблон" : "Создать шаблон"}</button>
              {editingTemplateId && <button type="button" className="btn" onClick={resetTemplateForm}>Отмена</button>}
            </div>
          </form>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {templates.filter((template) => template.isGlobal).map((template) => (
              <div key={template.id} className="rounded-md border border-line p-2 text-sm">
                <b>{template.name}</b>
                <div className="text-muted">{template.components.length} комплектующих</div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn" onClick={() => editTemplate(template)}>Изменить</button>
                  <button type="button" className="btn btn-danger" onClick={() => deleteTemplate(template)}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 font-semibold">Настройки</h2>
          <form onSubmit={saveSettings} className="space-y-3">
            <label className="block">
              <span className="label">Сценарии маржи через запятую</span>
              <input className="field" value={settings.margins.join(",")} onChange={(e) => setSettings({ ...settings, margins: e.target.value.split(",").map(Number).filter(Boolean) })} />
            </label>
            <label className="block">
              <span className="label">БГ по умолчанию, %</span>
              <input className="field" type="number" value={settings.defaultBankGuaranteePercent} onChange={(e) => setSettings({ ...settings, defaultBankGuaranteePercent: Number(e.target.value) })} />
            </label>
            <button className="btn btn-primary">Сохранить</button>
          </form>
        </div>

        <div className="panel p-4 col-span-2">
          <h2 className="mb-4 font-semibold">Прайсы</h2>
          <form onSubmit={uploadPrice} className="mb-4 grid grid-cols-[260px_1fr_auto] gap-2">
            <input className="field" placeholder="Дистрибьютор" value={priceDistributor} onChange={(e) => setPriceDistributor(e.target.value)} />
            <input className="field" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setPriceFile(e.target.files?.[0] || null)} />
            <button className="btn btn-primary">Загрузить</button>
          </form>
          <table className="table">
            <thead><tr><th>Дистрибьютор</th><th>Позиций</th><th>Последняя загрузка</th></tr></thead>
            <tbody>
              {prices.map((row) => (
                <tr key={row.distributorName}>
                  <td>{row.distributorName}</td>
                  <td>{row._count?.id || 0}</td>
                  <td>{row._max?.uploadedAt ? new Date(row._max.uploadedAt).toLocaleString("ru-RU") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
