import "dotenv/config";
const BASE = 'http://localhost:5000';

async function call(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const line = (label, r) =>
  console.log(`${r.status >= 200 && r.status < 300 ? '✅' : '❌'} ${label.padEnd(28)} ${r.status}  ${JSON.stringify(r.json).slice(0, 200)}`);

(async () => {
  console.log('--- Auth flow ---');
  const login = await call('POST', '/api/v1/auth/login', null, {
    username: process.env.SEED_USERNAME,
    password: process.env.SEED_PASSWORD,
  });
  line('POST /auth/login', login);
  const token = login.json?.data?.accessToken;
  if (!token) { console.log('❌ No token, stopping'); return; }

  const me = await call('GET', '/api/v1/auth/me', token);
  line('GET  /auth/me', me);

  const logout = await call('POST', '/api/v1/auth/logout', token);
  line('POST /auth/logout', logout);

  console.log('\n--- Products flow (authenticated) ---');
  const sku = 'SKU-' + Date.now();
  const create = await call('POST', '/api/v1/products', token, {
    sku,
    name: 'Test Widget',
    category: 'Widgets',
    description: 'created by route test',
  });
  line('POST /products', create);
  const id = create.json?.data?.id;

  const list = await call('GET', '/api/v1/products', token);
  line('GET  /products', list);

  if (id != null) {
    const one = await call('GET', `/api/v1/products/${id}`, token);
    line(`GET  /products/${id}`, one);

    const upd = await call('PATCH', `/api/v1/products/${id}`, token, { name: 'Updated Widget' });
    line(`PATCH /products/${id}`, upd);

    const del = await call('DELETE', `/api/v1/products/${id}`, token);
    line(`DELETE /products/${id}`, del);

    const afterDel = await call('GET', `/api/v1/products/${id}`, token);
    line(`GET  /products/${id} (deactivated)`, afterDel);
  }
})();