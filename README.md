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

## Backend Development

```bash
cd backend
npm ci
npm run dev
```

## Type Checking

```bash
npm run typecheck
```

## Production Build

```bash
npm run clean
npm run build
npm start
```

## Development Status

Phase 1: Project initialization.

Additional documentation will be added as each
development phase is completed.