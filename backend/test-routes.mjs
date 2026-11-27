import "dotenv/config";
const BASE = 'http://localhost:5000';

async function probe(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 160) };
}

function verdict(name, r, expected) {
  const mounted = r.status !== 404;
  console.log(
    `${mounted ? '✅' : '❌'} ${name.padEnd(32)} ${r.status} ${mounted ? '(mounted)' : '(NOT MOUNTED)'}  ${r.body}`
  );
}

(async () => {
  const checks = [
    ['GET  /api/v1/health',        'GET',  '/api/v1/health',        null],
    ['POST /api/v1/auth/login',    'POST', '/api/v1/auth/login',    { username: process.env.SEED_USERNAME, password: process.env.SEED_PASSWORD }],
    ['GET  /api/v1/auth/me',       'GET',  '/api/v1/auth/me',       null],
    ['POST /api/v1/auth/logout',   'POST', '/api/v1/auth/logout',   null],
    ['GET  /api/v1/products',      'GET',  '/api/v1/products',      null],
    ['POST /api/v1/products',      'POST', '/api/v1/products',      { sku: 'X', name: 'Y', category: 'Z' }],
    ['GET  /api/v1/products/1',    'GET',  '/api/v1/products/1',    null],
    ['PATCH /api/v1/products/1',   'PATCH','/api/v1/products/1',    { name: 'Updated' }],
    ['DELETE /api/v1/products/1',  'DELETE','/api/v1/products/1',   null],
  ];

  for (const [name, method, path, body] of checks) {
    try {
      const r = await probe(method, path, body);
      verdict(name, r);
    } catch (e) {
      console.log(`❌ ${name.padEnd(32)} ERROR ${e.message}`);
    }
  }
})();