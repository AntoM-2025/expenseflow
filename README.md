# ExpenseFlow

A full-stack expense tracking application built with React,
TypeScript, Node.js, Express, and PostgreSQL.

## Features

- Add and manage daily expenses
- Organize expenses by payer
- Track individual and total spending
- Delete expense records
- Store expenses in a PostgreSQL database

## Tech Stack

### Frontend
- React
- TypeScript
- Vite

### Backend
- Node.js
- Express
- TypeScript

### Database
- PostgreSQL
- Docker

## Project Structure

```text
expenseflow/
├── client/      # React application
├── server/      # Express REST API
├── database/    # Database migrations
└── compose.yaml # Docker services
```

## Requirements

- Node.js
- npm
- Docker Desktop
- Git

## Development

Start the PostgreSQL database:

```bash
docker compose up -d db
```

Install the frontend dependencies:

```bash
cd client
npm install
```

Install the backend dependencies:

```bash
cd server
npm install
```

See each package's scripts for the available development commands.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Check API and database |
| GET | /api/expenses | Retrieve expenses |
| POST | /api/expenses | Create an expense |
| DELETE | /api/expenses/:id | Delete an expense |

## Roadmap

- [x] React dashboard
- [x] REST API with Express
- [x] PostgreSQL integration
- [x] Expense management
- [ ] User authentication
- [ ] Private user dashboards
- [ ] Automated tests
- [ ] Production deployment

## Status

Under active development.

## Income, payer deletion and monthly overview

Each payer supports expenses and income. The dashboard displays income minus
expenses as the balance, and the monthly chart can be filtered by payer and year.
Deleting a payer requires confirmation in the UI and permanently removes all
associated expenses and income in one database transaction.

Apply migration `011_create_incomes.sql` before running the updated app. The
migration runner requires `DATABASE_URL` and records applied migration checksums:

```bash
cd server
npm run build
npm run migrate
```

Additional authenticated endpoints: `GET/POST /api/incomes`,
`DELETE /api/incomes/:id`, and `DELETE /api/payers/:id`.

Run checks (Node.js 24+):

```bash
node --test client/tests/monthlyTotals.test.mjs
cd server
node --env-file=../.env tests/movements.integration.mjs
```

The integration test requires a local PostgreSQL account with database creation
permission. It creates and removes a uniquely named test database, applies all
migrations there, and checks validation, account isolation and deletion behavior.
It does not modify the configured application database.
