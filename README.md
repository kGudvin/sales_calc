# Сервис расчётов отдела продаж

Веб-приложение для ежедневных расчётов товаров, электронных аукционов, коммерческих предложений и быстрых черновиков. Менеджер создаёт расчёт, добавляет изделия и комплектующие, видит себестоимость, вход, маржу, цену продажи и выгружает аккуратный Excel-файл.

## Стек

- Next.js, React, TypeScript
- PostgreSQL
- Prisma ORM
- Docker Compose
- ExcelJS для экспорта `.xlsx`
- SheetJS для импорта прайсов `.xlsx`, `.xls`, `.csv`
- bcryptjs для паролей
- Cookie JWT-сессии
- Tailwind CSS

## Требования

- Docker и Docker Compose
- Свободный порт `8090` или другой порт через `APP_PORT`

## Настройка `.env`

Скопируйте пример:

```bash
cp .env.example .env
```

Минимальные переменные:

```env
APP_PORT=8090
DATABASE_URL=postgresql://sales_calc_user:strong_password@postgres:5432/sales_calc
POSTGRES_USER=sales_calc_user
POSTGRES_PASSWORD=strong_password
POSTGRES_DB=sales_calc
ADMIN_LOGIN=admin
ADMIN_PASSWORD=change_me
JWT_SECRET=change_me_to_a_long_random_string
```

Перед запуском на VPS обязательно поменяйте `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` и `JWT_SECRET`.

## Запуск через Docker Compose

```bash
docker compose up -d --build
```

При старте контейнер приложения:

1. применяет Prisma-схему к PostgreSQL;
2. создаёт seed-данные;
3. создаёт первого администратора из `.env`, если его ещё нет;
4. запускает Next.js на порту `8090`.

Открыть приложение:

```text
http://SERVER_IP:8090
```

Локально:

```text
http://localhost:8090
```

## Первый администратор

Первый админ создаётся автоматически из:

```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD=change_me
```

Если пользователь с таким логином уже существует, приложение не перезаписывает пароль, но оставляет ему роль `ADMIN` и активный статус.

## Что реализовано

- вход по логину и паролю;
- роли `USER` и `ADMIN`;
- менеджер видит и редактирует только свои расчёты;
- администратор видит все расчёты, но чужие открывает только для просмотра;
- создание, редактирование, удаление и копирование расчётов;
- типы: аукцион, КП, черновик;
- статусы расчёта;
- поиск по названию, номеру закупки и ИНН;
- фильтры по типу и статусу;
- несколько изделий в одном расчёте;
- отдельная комплектация у каждого изделия;
- ручная цена закупки изделия без комплектующих;
- ввод цен комплектующих в RUB/USD с пересчётом по курсу;
- фиксация курса внутри расчёта и предупреждение о ручном курсе;
- доставка, обеспечения, банковская гарантия;
- расчёт чистой себестоимости, входа, цены продажи, прибыли и маржи;
- сценарии маржи 10/15/20/25/30 и пользовательская маржа;
- калькулятор торгов для аукциона;
- экспорт одного аккуратного Excel-листа;
- общие и личные шаблоны изделий;
- избранные шаблоны на уровне API;
- админское управление пользователями, категориями, настройками и прайсами;
- импорт прайсов `.xlsx`, `.xls`, `.csv`;
- поиск позиций по загруженным прайсам;
- ежедневный backup PostgreSQL;
- restore-скрипт.

## Backup

В `docker-compose.yml` есть отдельный контейнер `backup`. Он запускает:

```bash
/scripts/backup.sh
```

Backup сохраняется локально в папку:

```text
./backups
```

Формат файла:

```text
sales_calc_YYYY-MM-DD_HH-MM-SS.dump
```

Хранятся последние 14 дней. Более старые файлы удаляются автоматически.

Сделать backup вручную:

```bash
docker compose run --rm backup /scripts/backup.sh
```

## Restore

Восстановление из backup:

```bash
docker compose exec postgres sh
```

Внутри контейнера можно использовать `pg_restore`, либо запустить скрипт из backup-контейнера:

```bash
docker compose run --rm backup /scripts/restore.sh /backups/sales_calc_YYYY-MM-DD_HH-MM-SS.dump
```

Скрипт очищает существующие объекты и восстанавливает базу из указанного `.dump`.

## Обновление приложения

1. Обновите файлы проекта на сервере.
2. Проверьте `.env`.
3. Пересоберите контейнеры:

```bash
docker compose up -d --build
```

4. Проверьте логи:

```bash
docker compose logs -f app
```

## Загрузка прайсов

1. Войдите под администратором.
2. Откройте `Админка`.
3. В блоке `Прайсы` укажите название дистрибьютора.
4. Загрузите `.xlsx`, `.xls` или `.csv`.

Поддерживаются колонки:

- `name`, `Наименование`, `название`
- `sku`, `артикул`, `Артикул`
- `characteristics`, `Характеристики`
- `priceRub`, `Цена RUB`, `Цена`
- `priceUsd`, `Цена USD`
- `currency`, `Валюта`
- `stock`, `Остаток`

После загрузки позиции доступны в поиске по прайсам внутри карточки расчёта.

## Структура проекта

```text
src/app                 страницы и API Next.js
src/components          клиентские экраны
src/lib                 база, авторизация, формулы, Excel, валидация
prisma/schema.prisma    модель базы данных
prisma/seed.ts          начальные данные
scripts/backup.sh      backup PostgreSQL
scripts/restore.sh     восстановление PostgreSQL
backups                локальные backup-файлы
docker-compose.yml     app + postgres + backup
Dockerfile             сборка приложения
```

## Локальная разработка без Docker

Нужна PostgreSQL-база и корректный `DATABASE_URL`.

```bash
npm install
npx prisma db push
npm run seed
npm run dev
```

Приложение откроется на:

```text
http://localhost:8090
```
