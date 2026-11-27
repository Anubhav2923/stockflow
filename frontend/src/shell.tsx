import { useState, useEffect, type FormEvent } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { io } from "socket.io-client";
import {
  Layers3,
  LayoutDashboard,
  Package,
  Boxes,
  ScrollText,
  FlaskConical,
  LogOut,
  Menu,
  X,
  Activity,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { api, authKey, queries, origin, message, useData, toast } from "./api";
import { Button } from "./components/ui/button";
import { Dashboard, InventoryPage, Ledger } from "./reports";
import { Products, Simulator } from "./workspace";

const navigation = [
  { to: "/", name: "Dashboard", icon: LayoutDashboard },
  { to: "/products", name: "Products", icon: Package },
  { to: "/inventory", name: "Inventory", icon: Boxes },
  { to: "/transactions", name: "Transaction ledger", icon: ScrollText },
  { to: "/simulator", name: "Event simulator", icon: FlaskConical },
];
function Brand() {
  return (
    <div className="brand">
      <span>
        <Layers3 size={23} />
      </span>
      StockFlow
    </div>
  );
}
function Login() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (sessionStorage.getItem(authKey)) return <Navigate to="/" replace />;
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post(
        "/auth/login",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      sessionStorage.setItem(authKey, result.data.data.accessToken);
      navigate("/", { replace: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-art">
        <Brand />
        <div className="art-copy">
          <Layers3 size={56} />
          <h1>Inventory workspace</h1>
          <p>Purchases, stock balances and FIFO costs in one place.</p>
        </div>
      </div>
      <div className="login-form">
        <form onSubmit={login}>
          <h1>Welcome back</h1>
          <p>Sign in to your StockFlow workspace.</p>
          <label>
            Username
            <input name="username" required autoComplete="username" />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </Button>
        </form>
      </div>
    </main>
  );
}
function Workspace() {
  const location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [live, setLive] = useState(false);
  const me = useData<{ username: string }>("/auth/me");
  useEffect(() => {
    const socket = io(origin, {
      auth: { token: sessionStorage.getItem(authKey) },
    });
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("inventory:updated", () => {
      void queries.invalidateQueries();
    });
    return () => {
      socket.disconnect();
    };
  }, []);
  const title =
    navigation.find((n) => n.to === location.pathname)?.name || "Workspace";
  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      toast(message(e));
    } finally {
      sessionStorage.removeItem(authKey);
      sessionStorage.removeItem("stockflow.events");
      queries.clear();
      navigate("/login", { replace: true });
    }
  }
  return (
    <div className="workspace">
      {open && (
        <button
          aria-label="Close menu"
          className="scrim"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={open ? "open" : ""}>
        <Brand />
        <div className="nav-label">Workspace</div>
        <nav>
          {navigation.map((n) => (
            <NavLink key={n.to} to={n.to} end onClick={() => setOpen(false)}>
              <n.icon size={19} />
              {n.name}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <span className="avatar">
            {me.data?.username.slice(0, 2).toUpperCase() || "SF"}
          </span>
          <div>
            <strong>{me.data?.username || "Account"}</strong>
            <small>StockFlow workspace</small>
          </div>
          <button title="Sign out" aria-label="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="content">
        <header>
          <div className="crumb">
            <button
              className="mobile"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            Workspace <ChevronRight size={14} /> <b>{title}</b>
          </div>
          <span className={"connection " + (live ? "online" : "")}>
            <Activity size={14} />
            {live ? "Live updates" : "Polling updates"}
          </span>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
function Notices() {
  const [text, setText] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handle = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setText(""), 4500);
    };
    window.addEventListener("stockflow:toast", handle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("stockflow:toast", handle);
    };
  }, []);
  return text ? (
    <div role="status" className="toast">
      {text}
      <button aria-label="Dismiss notification" onClick={() => setText("")}>
        <X size={15} />
      </button>
    </div>
  ) : null;
}
function Protected() {
  return sessionStorage.getItem(authKey) ? (
    <Workspace />
  ) : (
    <Navigate replace to="/login" />
  );
}
export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="transactions" element={<Ledger />} />
          <Route path="simulator" element={<Simulator />} />
        </Route>
        <Route path="*" element={<Link to="/">Return to dashboard</Link>} />
      </Routes>
      <Notices />
    </>
  );
}
