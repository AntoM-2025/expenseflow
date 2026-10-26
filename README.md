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