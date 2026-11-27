# StockFlow

StockFlow tracks purchases, sales and FIFO inventory costs. A React workspace lets you submit manual transactions, simulate activity, inspect batch balances and trace each sale to its original purchase costs.

## Run locally

Install Node.js 24, npm and Docker Compose. From the repository root, start the services and prepare the backend.

```sh
docker compose up -d --wait
cd backend
cp .env.example .env
npm ci
npm run db:deploy
npm run db:generate
npm run db:seed
npm run dev
```

In PowerShell use `Copy-Item .env.example .env`. Merge missing settings if a local environment file already exists. PostgreSQL listens on localhost:5433 and Kafka on localhost:9092. The API logs PostgreSQL and Kafka connectivity before listening on port 5000. Compose volumes retain both services' data.

In a second terminal, run these commands from the repository root.

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite address (normally http://localhost:5173). The fresh example seed account is **stockflow** with password **stockflow_local_demo**. An existing database retains its originally seeded password. Keep production credentials in the deployment environment.

## Try the simulator

Open **Event simulator**, choose mixed, purchase-only or sale-only, select 5–10 events and run the simulation. The results table tracks each submitted event ID and shows the committed cost or rejection reason. Manual submissions accept a product, integer quantity and decimal unit price. A sale on empty stock produces a persisted rejection. Use **Transaction ledger** to expand FIFO costs and **Inventory** to inspect remaining batches.

A separate producer is available while the backend consumer and topic are running.

```sh
cd backend
npm run build
npm run simulate -- mixed 6
```

The other modes are `purchase` and `sale`. Generated events use the seeded username's database ID. Keep the seed username configured when using the producer.

## Architecture and FIFO

The Express modular monolith hosts authentication, products, inventory reports, purchase receipt and sale allocation. The API publishes to Kafka with the product ID as the key and returns HTTP 202 after broker acknowledgement. KafkaJS consumes the topic in a consumer group. The standalone producer uses the same event contract.

Each consumer transaction reserves the globally unique event ID and locks the product row. Duplicate delivery returns the previous outcome. Purchases add a costed batch. Sales consume available batches ordered by receipt time and batch ID, persisting the unit cost and quantity of each allocation. Stock mutations, allocations and the receipt commit together. Inactive products, insufficient balances and backdated events are rejected. Database failures leave the offset pending for retry. Invalid Kafka envelopes are recorded by topic, partition and offset. Offsets advance after persistence.

PostgreSQL stores money as numeric(18,4). The backend uses decimal arithmetic for valuations and COGS, and the API sends monetary values as strings. Stock totals include archived products. A purchase of 50 at ₹100 followed by 50 at ₹120 and a sale of 70 uses 50 units from the first batch and 20 from the second. COGS is ₹7,400. The remaining 30 units are worth ₹3,600, averaging ₹120 each.

The frontend uses authenticated Socket.IO notifications to refresh TanStack Query data and polls for recovery. Use one API instance for the demo. With multiple instances, clients on other instances reconcile through polling.

## API

All paths use `/api/v1`. Health and login are public. Supply `Authorization: Bearer <accessToken>` for the other routes. Import [StockFlow.postman_collection.json](docs/StockFlow.postman_collection.json) and run Login first.

| Method | Path | Result |
| --- | --- | --- |
| GET | /health | API liveness |
| POST | /auth/login | JWT for username and password |
| GET / POST | /auth/me / /auth/logout | Current user / client logout acknowledgement |
| GET / POST | /products | List active products / create |
| GET / PATCH / DELETE | /products/:id | Read / update / archive |
| POST | /purchases or /sales | Publish one event, HTTP 202 |
| POST | /simulate | Publish 5–10 events, HTTP 202 |
| GET | /events/:id | Committed receipt or UNCONFIRMED |
| GET | /events?ids=id1,id2 | Batch of committed receipts |
| GET | /inventory | Per-product balances, average costs and batches |
| GET | /dashboard | Stock, valuation, purchase cost, average cost and FIFO COGS |
| GET | /transactions | Chronological ledger, newest first, with sale allocations |

Manual event example: `{"productId":1,"quantity":50,"unitPrice":"100.00"}`. Optional fields are a UUID `eventId` and UTC ISO `timestamp`. Supply a stable event ID when retrying a submission. A queued or unconfirmed event has no confirmed financial effect. Socket clients authenticate with `auth.token` and listen for `inventory:updated`.

## Verification

Start Compose first. From `backend` run the following.

```sh
npm run typecheck
npm test
npm run test:integration
```

The FIFO test creates and cleans up one fixture product in the configured database. The integration suite creates a temporary database on local PostgreSQL and a dedicated Kafka topic on localhost:9092. It exercises login, Kafka redelivery, malformed messages, business rejections, simulation and dashboard reconciliation. The local PostgreSQL account needs database creation privileges.

From `frontend`, run `npm run typecheck` and `npm run build`. To include headless browser checks, install dependencies in both projects, set `TEST_BROWSER` to an installed Chromium or Edge executable, then rerun the backend integration suite. The browser test uses port 15173.

## Deploy the combined app on Render Free

### Neon database setup from the repository root

The Neon configuration in `neon.ts` uses Postgres. In the linked checkout, `neon deploy` refreshes the ignored `.env.local`. The root start command loads Neon’s pooled `DATABASE_URL` for Prisma's PostgreSQL driver adapter. The root migration command uses `DATABASE_URL_UNPOOLED` for a direct connection.

```sh
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm run db:deploy
npm run build
npm start
```

Set `JWT_SECRET` and the Kafka settings for the intended environment before starting. For a local run, the root start command reads `backend/.env` first and then the root environment files. Use a Kafka topic and group dedicated to the target database. On Render, enter the two Neon URLs as `DATABASE_URL` and `DIRECT_URL` respectively.

### Render service setup

Use the repository-root `Dockerfile` and `render.yaml`. The Docker build copies the Vite output into `backend/dist/public` inside the image. Express serves React routes, static assets, the API and Socket.IO on the same origin.

1. Prepare a Neon database and a managed Kafka cluster. Create the `inventory-events` topic and allow the Kafka user to produce, consume and join the `stockflow-inventory-v1` group.
2. Push the deployment files to the connected repository's `develop` branch. In Render choose **New → Blueprint**, select the repository and apply the `stockflow` free web service. Use the repository root as the Docker context.
3. Enter the pooled Neon URL in `DATABASE_URL`, the direct Neon URL in `DIRECT_URL`, and a private `SEED_PASSWORD` for the `stockflow` account. Enter the provider's `KAFKA_BROKERS`, `KAFKA_SASL_MECHANISM`, `KAFKA_USERNAME` and `KAFKA_PASSWORD`. The Blueprint generates the JWT secret. The local ignored `backend/.env.prod` is a worksheet for entering these settings.
4. Deploy and open the URL Render assigns. The container applies migrations and runs the idempotent seed before starting Express. Render checks `/healthz` once the server is listening. Existing seed users retain their passwords.

Render supplies the port and public origin. Refreshing a React route works at the same URL. Free instances sleep after 15 minutes without inbound traffic. The Kafka consumer pauses during sleep and resumes from its committed offsets when the service wakes. [Render Free service limits](https://render.com/docs/free)

## Independent deployments

Build the backend with `npm ci && npm run build` and start it with `npm start`. Use a persistent Node host with WebSocket support and network access to Kafka. Run `npm run db:deploy` as the release command. On a fresh deployment, configure the predefined account and explicitly run `npm run db:seed`. The Prisma CLI, PostgreSQL adapter and client are pinned to 7.10.1. [Prisma 7 documentation](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)

Use the pooled Neon connection for `DATABASE_URL` and the direct connection to the same Neon database for `DIRECT_URL`. Preserve the provider's TLS parameters. Set a private random `JWT_SECRET`, the frontend HTTPS origin in `CORS_ORIGIN`, and the host's assigned `PORT`. Use `TRUST_PROXY=1` only behind one trusted reverse proxy.

For managed Kafka set `KAFKA_BROKERS` to comma-separated addresses, `KAFKA_SSL=true`, and the provider's SASL mechanism, username and password. Supported SASL mechanisms are plain, scram-sha-256 and scram-sha-512. For a pre-created topic, set `KAFKA_CREATE_TOPIC=false` and grant producer, consumer and group access. Otherwise grant topic creation rights and set an appropriate replication factor. Local Compose uses one replica.

Build the frontend with `VITE_API_ORIGIN` set to the backend's HTTPS origin and run `npm ci && npm run build`. Serve `frontend/dist` from a static host with all client routes rewritten to index.html. Docker alternatives from the repository root:

```sh
docker build -t stockflow-api ./backend
docker build --build-arg VITE_API_ORIGIN=https://your-api-host.example -t stockflow-web ./frontend
```

Supply backend environment variables at runtime. The frontend image serves the built files on port 80 with SPA routing. The API image includes Prisma migration tooling. For schema changes use `npm run db:migrate -- --name <change>` locally and commit the migration.
