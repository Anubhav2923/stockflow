# StockFlow

StockFlow tracks purchases, sales and FIFO inventory costs. A React workspace lets you submit transactions, inspect batch balances and trace each sale to its original purchase costs.

## Run locally

Install Node.js 24, npm and Docker Compose. From the repository root, start the services and prepare the backend.

```sh
docker compose up -d --wait
cd backend
cp .env.example .env
npm ci
npm run db:deploy
npm run db:generate
npx tsx src/scripts/create-admin.ts .env
npm run dev
```

In PowerShell use `Copy-Item .env.example .env`. Merge missing settings if a local environment file already exists. PostgreSQL listens on localhost:5433 and Kafka on localhost:9092. The API logs PostgreSQL and Kafka connectivity before listening on port 5000. Compose volumes retain both services' data.

In a second terminal, run these commands from the repository root.

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite address (normally http://localhost:5173). Set ADMIN_PASSWORD in backend/.env before running the account creation command. Use **Log in with credentials** to enter the connected workspace as admin. Anyone who can open the login page can use this shared account when ADMIN_PASSWORD is configured. Keep production credentials in the deployment environment.

## Try the simulator

Open **Event simulator** and submit a **FIFO transaction**: choose purchase or sale, a product, an integer quantity and a decimal purchase or selling price. The results table tracks each submitted event ID and shows the committed cost or rejection reason. A sale on empty stock produces a persisted rejection. Use **Transaction ledger** to expand FIFO costs and **Inventory** to inspect remaining batches.

A separate producer is available while the backend consumer and topic are running.

```sh
cd backend
npm run build
npm run simulate -- mixed 6
```

The other modes are `purchase` and `sale`. The producer uses the admin account by default. Set `SEED_USERNAME` to select an existing simulation account explicitly.

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

## Live demo

StockFlow is deployed on **Render Free** with a **Neon PostgreSQL** database and **Aiven Kafka**.

**Open the app:** [https://stockflow-1zit.onrender.com](https://stockflow-1zit.onrender.com)

Click **Log in with credentials** to enter the shared workspace.
### Create products

1. Open **Products** in the sidebar.
2. Click **Add product**.
3. Enter the product details:
   - **Product name** — 2–150 characters, for example `iPhone 15`.
   - **SKU** — unique, up to 50 characters, for example `IPH-001`. It cannot be changed after saving.
   - **Category** — 2–100 characters, for example `Electronics`.
   - **Description** — optional, up to 500 characters.
4. Click **Save product**.

The product appears in **Active catalog** with **Stock 0**. Stock only changes through transactions, so create at least one product before using the simulator. **Archive** hides a product and blocks new events for it while keeping its transaction history.

### Record a purchase

1. Open **Event simulator**.
2. In the **FIFO transaction** card, set **Movement** to `Purchase`.
3. Choose the product, enter an integer **Quantity**, and enter the **Purchase price (₹)** per unit, for example `120.00`.
4. Click **Submit event**.

Each submission is published to Kafka and applied by the consumer. The row appears in **Processing results** as `QUEUED` and turns `PROCESSED` within a few seconds with `Received ₹…`. A purchase creates a new inventory batch; buying the same product again at a different price creates a second batch with its own cost.

### Record a sale

1. Set **Movement** to `Sale`, choose the product, enter the **Quantity**, and enter the **Selling price (₹)** per unit.
2. Click **Submit event**.
3. A processed sale shows `FIFO cost ₹…`, the historical purchase cost of the units sold.

Sales consume the oldest batch first. For example, buy 20 units at ₹120, then 20 units at ₹150, then sell 30 units at ₹200. The sale takes 20 units from the ₹120 batch and 10 from the ₹150 batch, so FIFO COGS is ₹3,900 against ₹6,000 of revenue, and 10 units worth ₹1,500 remain. A sale larger than the available stock is rejected with `Insufficient inventory` and changes nothing. A product that has been archived is rejected with `Unknown or inactive product`.

### Inspect the results

- **Inventory** — expand a product to see each batch, its original and remaining units, and its unit cost.
- **Transaction ledger** — every purchase and sale, newest first. Expand **FIFO COGS** on a sale to see which batches were consumed.
- **Dashboard** — stock on hand, inventory value, lifetime purchase cost and FIFO COGS. It refreshes automatically through Socket.IO, or by polling when the socket is unavailable.
