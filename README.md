# StockFlow

Real-Time Inventory & FIFO Management System.

## Overview

StockFlow is an event-driven inventory management
application for managing purchases, sales, FIFO
inventory costing and real-time inventory analytics.

## Architecture

Feature-based Modular Monolith Architecture.

The backend and frontend are independently deployable
applications maintained in a single Git repository.

## Technology Stack

### Backend

- Node.js 24
- Express.js 5
- TypeScript
- Prisma ORM 7
- PostgreSQL
- Apache Kafka
- Zod
- JWT
- Pino
- Socket.IO

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Shadcn UI

### Infrastructure

- Docker
- Neon PostgreSQL
- Managed Apache Kafka
- GitHub

## Prerequisites

- Node.js 24.x
- npm
- Git

## Local database and backend

From the repository root, start PostgreSQL 17 with Docker Compose. The container exposes port 5433 on loopback and stores its data in a named volume.

```sh
docker compose up -d --wait postgres
cd backend
cp .env.example .env
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

In PowerShell use `Copy-Item .env.example .env` for the copy step. If you already have a backend `.env`, merge the database and seed settings into it. The health endpoint is `GET /api/v1/health` on port 5000 by default.

The seed creates one user and six products. Set `SEED_USERNAME` and `SEED_PASSWORD` before the first run. Repeated runs with the same username preserve the password hash and any existing products with the sample SKUs.

## Schema and FIFO integrity

Each sale records a quantity and unit price for one product. Each allocation links that sale to a batch of the same product and records its quantity and historical unit cost. Monetary columns use PostgreSQL `numeric(18,4)`. Pass decimal strings to Prisma and use `Prisma.Decimal` operations for calculations.

The FIFO index orders batches by product, receipt time and batch ID. The ID breaks ties when receipt times match. SQL checks require positive received, sold and allocated quantities, constrain remaining units to the received quantity and reject invalid costs and prices.

When implementing sales, lock the product row first to serialize stock changes for that product. Select available batches in FIFO order and commit batch decrements, the sale and its allocations in one transaction. Future event consumers should insert the globally unique event ID into `ProcessedEvent` in the same transaction as the event's effects. A duplicate ID must leave those effects unapplied.

## Database commands

Run these commands from `backend`.

| Command | Purpose |
| --- | --- |
| `npm run db:generate` | Generate the ESM Prisma client after schema changes |
| `npm run db:migrate -- --name <change>` | Create and apply a development migration |
| `npm run db:deploy` | Apply committed migrations, including the SQL check constraints |
| `npm run db:seed` | Insert the sample data |
| `npm run db:studio` | Open Prisma Studio |

## Production and Neon

Set `DATABASE_URL` to the pooled Neon PostgreSQL URL and `DIRECT_URL` to the direct URL for the same branch and database. Preserve Neon's TLS connection parameters. Keep credentials in the deployment environment. The backend shares one Prisma client backed by the pg adapter. Startup verifies connectivity before accepting requests, and SIGTERM or SIGINT drains HTTP connections before disconnecting Prisma.

With development dependencies installed, run the following from `backend`. Apply the migration in the release step with the Prisma CLI available.

```sh
npm ci
npm run db:generate
npm run typecheck
npm run build
npm run db:deploy
npm start
```

The build generates the client and compiles the server to `dist/server.js`. Seeding is an explicit local setup step. [Prisma 7 configuration and driver adapters](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
