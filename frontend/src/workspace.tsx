import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Archive,
  Send,
  ArrowRight,
  Search,
  Package,
} from "lucide-react";
import {
  api,
  queries,
  read,
  useData,
  toast,
  message,
  money,
  type Product,
  type Receipt,
  type Entry,
} from "./api";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Empty, Feedback, Heading } from "./reports";

export function Products() {
  const q = useData<Product[]>("/products");
  const [editor, setEditor] = useState<Product | "new" | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const current = typeof editor === "object" ? editor : null;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (current) await api.patch("/products/" + current.id, body);
      else await api.post("/products", body);
      setEditor(null);
      toast("Product saved");
      await queries.invalidateQueries();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(p: Product) {
    if (
      !window.confirm(
        "Archive " +
          p.name +
          "? Its transaction history will remain available.",
      )
    )
      return;
    try {
      await api.delete("/products/" + p.id);
      toast("Product archived");
      await queries.invalidateQueries();
    } catch (e) {
      toast(message(e));
    }
  }
  const rows = q.data?.filter((p) =>
    (p.name + p.sku).toLowerCase().includes(search.toLowerCase()),
  );
  function edit(p: Product | "new") {
    setEditor(p);
    setError("");
  }
  return (
    <>
      <Heading
        title="Products"
        summary="Manage the catalog used for purchases, sales and inventory reporting."
      >
        <Button onClick={() => edit("new")}>
          <Plus size={16} />
          Add product
        </Button>
      </Heading>
      {editor && (
        <Card className="form-card">
          <h2>{current ? "Edit product" : "New product"}</h2>
          <form key={current?.id || "new"} onSubmit={save}>
            <div className="form-grid">
              <label>
                Product name
                <input
                  name="name"
                  minLength={2}
                  maxLength={150}
                  defaultValue={current?.name}
                  required
                />
              </label>
              <label>
                SKU
                <input
                  name="sku"
                  maxLength={50}
                  disabled={!!current}
                  defaultValue={current?.sku}
                  required
                />
              </label>
              <label>
                Category
                <input
                  name="category"
                  minLength={2}
                  maxLength={100}
                  defaultValue={current?.category || ""}
                  required
                />
              </label>
              <label>
                Description
                <input
                  name="description"
                  maxLength={500}
                  defaultValue={current?.description || ""}
                />
              </label>
            </div>
            {error && <p role="alert">{error}</p>}
            <div className="actions">
              <Button disabled={busy}>Save product</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <div className="panel-head">
          <h2>Active catalog</h2>
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Search catalog"
              aria-label="Search catalog"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <Feedback loading={q.isLoading} error={q.error} />
        {rows?.length === 0 ? (
          <Empty>No matching products.</Empty>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="product-name">
                        <i>
                          <Package size={17} />
                        </i>
                        <b>{p.name}</b>
                      </div>
                    </td>
                    <td>{p.sku}</td>
                    <td>{p.category || "—"}</td>
                    <td>{p.remainingQuantity}</td>
                    <td>
                      <button
                        aria-label={"Edit " + p.name}
                        onClick={() => edit(p)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label={"Archive " + p.name}
                        onClick={() => archive(p)}
                      >
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
export function Simulator() {
  const products = useData<Product[]>("/products"),
    ledger = useData<Entry[]>("/transactions");
  const [kind, setKind] = useState("PURCHASE"),
    [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Receipt[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("stockflow.events") || "[]");
    } catch {
      return [];
    }
  });
  const [manualId, setManualId] = useState(() => crypto.randomUUID());
  const receipts = useQuery({
    queryKey: ["receipts", sent.map((s) => s.eventId)],
    enabled: sent.length > 0,
    queryFn: () =>
      read<Receipt[]>("/events?ids=" + sent.map((s) => s.eventId).join(",")),
    refetchInterval: (query) =>
      (query.state.data?.length || 0) < sent.length ? 2000 : 15000,
  });
  function remember(rows: Receipt[]) {
    setSent((prev) => {
      const ids = new Set(rows.map((r) => r.eventId));
      const next = [...rows, ...prev.filter((r) => !ids.has(r.eventId))].slice(
        0,
        100,
      );
      sessionStorage.setItem("stockflow.events", JSON.stringify(next));
      return next;
    });
  }
  async function manual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      eventId: manualId,
      productId: Number(data.get("product")),
      quantity: Number(data.get("quantity")),
      unitPrice: String(data.get("price")),
    };
    setBusy(true);
    try {
      const result = await api.post(
        kind === "SALE" ? "/sales" : "/purchases",
        payload,
      );
      remember([{ ...payload, ...result.data.data, eventType: kind }]);
      setManualId(crypto.randomUUID());
      toast("Event accepted by Kafka");
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Event simulator"
        summary="Submit a purchase or sale and follow it from Kafka to the transaction ledger."
      />
      <Card className="form-card">
        <h2>FIFO transaction</h2>
        <p>Submit one purchase or sale. Sales consume the oldest batch first.</p>
        <form
          onSubmit={manual}
          onChange={() => setManualId(crypto.randomUUID())}
        >
          <div className="form-grid">
            <label>
              Movement
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="PURCHASE">Purchase</option>
                <option value="SALE">Sale</option>
              </select>
            </label>
            <label>
              Product
              <select name="product" required>
                {products.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                name="quantity"
                type="number"
                min="1"
                max="2147483647"
                step="1"
                defaultValue="1"
                required
              />
            </label>
            <label>
              {kind === "SALE" ? "Selling price (₹)" : "Purchase price (₹)"}
              <input
                name="price"
                type="text"
                inputMode="decimal"
                pattern="[0-9]{1,14}([.][0-9]{1,4})?"
                placeholder={kind === "SALE" ? "200.00" : "100.00"}
                required
              />
            </label>
          </div>
          <Button disabled={busy || !products.data?.length}>
            <Send size={15} />
            Submit event
          </Button>
        </form>
      </Card>
      <Feedback
        loading={products.isLoading}
        error={products.error || receipts.error || ledger.error}
      />
      <Card>
        <div className="panel-head">
          <div>
            <h2>Processing results</h2>
            <p>Last 100 submissions in this session</p>
          </div>
          <Link className="text-link" to="/transactions">
            View ledger <ArrowRight size={14} />
          </Link>
        </div>
        {!sent.length ? (
          <Empty>Submit a transaction to see its result.</Empty>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((s) => {
                  const receipt = receipts.data?.find(
                    (x) => x.eventId === s.eventId,
                  );
                  const entry = ledger.data?.find(
                    (e) => e.type === s.eventType && e.id === receipt?.resultId,
                  );
                  return (
                    <tr key={s.eventId}>
                      <td>
                        <b>{s.eventType === "SALE" ? "Sale" : "Purchase"}</b>
                        <small title={s.eventId}>{s.eventId.slice(0, 8)}</small>
                      </td>
                      <td>
                        {products.data?.find((p) => p.id === s.productId)
                          ?.name || "#" + s.productId}
                      </td>
                      <td>{s.quantity}</td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (receipt?.status === "REJECTED"
                              ? "red"
                              : receipt
                                ? "purchase"
                                : "pending")
                          }
                        >
                          {receipt?.status || "QUEUED"}
                        </span>
                      </td>
                      <td>
                        {receipt?.reason ||
                          (entry
                            ? entry.type === "SALE"
                              ? "FIFO cost " + money(entry.cogs)
                              : "Received " + money(entry.amount)
                            : receipt?.resultId
                              ? "Transaction #" + receipt.resultId
                              : "Awaiting consumer")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
