import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Boxes,
  IndianRupee,
  Layers3,
  ShoppingBag,
  FlaskConical,
  CalendarDays,
  Search,
  PackageOpen,
} from "lucide-react";
import {
  useData,
  money,
  date,
  message,
  type Totals,
  type Inventory,
  type Entry,
} from "./api";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";

export function Heading({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children?: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {children}
    </div>
  );
}
export function Feedback({
  loading,
  error,
}: {
  loading: boolean;
  error: unknown;
}) {
  if (error) return <p role="alert">{message(error)}</p>;
  return loading ? <p role="status">Loading workspace data…</p> : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <PackageOpen size={25} />
      {children}
    </div>
  );
}
function Movement({ type }: { type: string }) {
  return (
    <span className={"badge " + (type === "SALE" ? "sale" : "purchase")}>
      {type === "SALE" ? (
        <ArrowUpRight size={13} />
      ) : (
        <ArrowDownLeft size={13} />
      )}
      {type === "SALE" ? "Sale" : "Purchase"}
    </span>
  );
}
function Entries({ rows }: { rows: Entry[] }) {
  if (!rows.length) return <Empty>No transactions to display.</Empty>;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Movement</th>
            <th>Timestamp</th>
            <th>Quantity</th>
            <th>Amount</th>
            <th>FIFO COGS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type + r.id}>
              <td>
                <b>{r.product.name}</b>
                <small>{r.product.sku}</small>
              </td>
              <td>
                <Movement type={r.type} />
              </td>
              <td>{date(r.at)}</td>
              <td>{r.quantity}</td>
              <td>{money(r.amount)}</td>
              <td>
                {r.type === "SALE" ? (
                  <details>
                    <summary>{money(r.cogs)}</summary>
                    {r.allocations.map((a) => (
                      <small key={a.batchId}>
                        Batch #{a.batchId} · {a.quantity} × {money(a.unitCost)}
                      </small>
                    ))}
                  </details>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Dashboard() {
  const totals = useData<Totals>("/dashboard"),
    stock = useData<Inventory[]>("/inventory"),
    entries = useData<Entry[]>("/transactions");
  const [days, setDays] = useState(7);
  const stats = totals.data;
  const points = Array.from({ length: days }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - days + 1 + i);
    const rows = (entries.data || []).filter(
      (r) => new Date(r.at).toDateString() === day.toDateString(),
    );
    const units = (type: string) =>
      rows.filter((r) => r.type === type).reduce((a, r) => a + r.quantity, 0);
    return {
      day: day.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      Purchases: units("PURCHASE"),
      Sales: units("SALE"),
    };
  });
  const holdings = [...(stock.data || [])]
    .filter((p) => p.remainingQuantity > 0)
    .sort((a, b) => b.remainingQuantity - a.remainingQuantity)
    .slice(0, 5);
  return (
    <>
      <Heading
        title="Inventory overview"
        summary="Stock levels, valuation and FIFO performance across your catalog."
      >
        <Button asChild>
          <Link to="/simulator">
            <FlaskConical size={16} />
            Open simulator
          </Link>
        </Button>
      </Heading>
      <Feedback
        loading={totals.isLoading}
        error={totals.error || stock.error || entries.error}
      />
      <div className="kpis">
        {[
          {
            name: "Inventory value",
            value: stats && money(stats.value),
            icon: IndianRupee,
            color: "violet",
            caption: "At remaining batch cost",
          },
          {
            name: "Stock on hand",
            value: stats?.stock.toLocaleString(),
            icon: Boxes,
            color: "blue",
            caption: "Units across all products",
          },
          {
            name: "Total purchases",
            value: stats && money(stats.purchaseCost),
            icon: ShoppingBag,
            color: "green",
            caption: "Lifetime purchase cost",
          },
          {
            name: "FIFO COGS",
            value: stats && money(stats.cogs),
            icon: Layers3,
            color: "amber",
            caption: "Cost of units sold",
          },
        ].map((s) => (
          <Card key={s.name} className="kpi">
            <div>
              <span>{s.name}</span>
              <i className={s.color}>
                <s.icon size={18} />
              </i>
            </div>
            <strong>{s.value ?? "—"}</strong>
            <small>{s.caption}</small>
          </Card>
        ))}
      </div>
      <div className="chart-grid">
        <Card>
          <div className="panel-head">
            <div>
              <h2>Stock movement</h2>
              <p>Daily purchase and sale volume</p>
            </div>
            <label className="range">
              <CalendarDays size={14} />
              <select
                aria-label="Chart range"
                value={days}
                onChange={(e) => setDays(+e.target.value)}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
              </select>
            </label>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points}
                margin={{ left: -22, right: 8, top: 12 }}
              >
                <defs>
                  <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#e8ecf2"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Area
                  dataKey="Purchases"
                  stroke="#4f46e5"
                  fill="url(#volume)"
                  strokeWidth={2.5}
                />
                <Area
                  dataKey="Sales"
                  stroke="#10b981"
                  fill="transparent"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span>Purchases</span>
            <span>Sales</span>
          </div>
        </Card>
        <Card>
          <div className="panel-head">
            <div>
              <h2>Stock distribution</h2>
              <p>Top products by units on hand</p>
            </div>
            <Boxes size={20} />
          </div>
          {holdings.length ? (
            <div className="holdings">
              {holdings.map((p) => (
                <div key={p.id}>
                  <div>
                    <b>{p.name}</b>
                    <span>{p.remainingQuantity} units</span>
                  </div>
                  <progress
                    value={p.remainingQuantity}
                    max={holdings[0].remainingQuantity}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Empty>Receive a purchase to see stock distribution.</Empty>
          )}
          <div className="avg">
            <span>Average unit cost</span>
            <b>{stats ? money(stats.averageCost) : "—"}</b>
          </div>
        </Card>
      </div>
      <Card>
        <div className="panel-head">
          <div>
            <h2>Recent transactions</h2>
            <p>Latest inventory movements</p>
          </div>
          <Link className="text-link" to="/transactions">
            View ledger <ArrowRight size={14} />
          </Link>
        </div>
        <Entries rows={(entries.data || []).slice(0, 5)} />
      </Card>
    </>
  );
}
export function Ledger() {
  const q = useData<Entry[]>("/transactions"),
    [filter, setFilter] = useState("ALL");
  return (
    <>
      <Heading
        title="Transaction ledger"
        summary="Trace each purchase and inspect the FIFO allocations behind every sale."
      />
      <Card>
        <div className="panel-head">
          <h2>Transaction history</h2>
          <select
            aria-label="Movement filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All movements</option>
            <option value="PURCHASE">Purchases</option>
            <option value="SALE">Sales</option>
          </select>
        </div>
        <Feedback loading={q.isLoading} error={q.error} />
        {q.data && (
          <Entries
            rows={q.data.filter((r) => filter === "ALL" || r.type === filter)}
          />
        )}
      </Card>
    </>
  );
}
export function InventoryPage() {
  const q = useData<Inventory[]>("/inventory"),
    [search, setSearch] = useState("");
  const rows = q.data?.filter((p) =>
    (p.name + p.sku).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Inventory"
        summary="Inspect available units, historical receipt costs and batch balances."
      />
      <Card>
        <div className="panel-head">
          <h2>Product balances</h2>
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Search inventory"
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <Feedback loading={q.isLoading} error={q.error} />
        {rows?.length === 0 && <Empty>No matching products.</Empty>}
        {rows?.map((p) => (
          <details className="batch" key={p.id}>
            <summary>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.sku} · {p.batches.length} batches
                </small>
              </span>
              <span>{p.remainingQuantity} units</span>
              <b>{money(p.value)}</b>
            </summary>
            <div className="batch-body">
              <p>Average unit cost {money(p.averageCost)}</p>
              {p.batches.length ? (
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Received</th>
                        <th>Original units</th>
                        <th>Remaining</th>
                        <th>Unit cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.batches.map((b) => (
                        <tr key={b.id}>
                          <td>#{b.id}</td>
                          <td>{date(b.receivedAt)}</td>
                          <td>{b.receivedQuantity}</td>
                          <td>{b.remainingQuantity}</td>
                          <td>{money(b.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No purchases yet.</Empty>
              )}
            </div>
          </details>
        ))}
      </Card>
    </>
  );
}
