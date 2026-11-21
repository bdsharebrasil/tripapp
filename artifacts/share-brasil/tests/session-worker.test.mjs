import test from "node:test";
import assert from "node:assert/strict";
import {
  SessionManager,
  SESSION_STORAGE_KEY,
} from "../src/lib/session-core.ts";
const value = (token = "access", expires_at = 200) => ({
  access_token: token,
  refresh_token: "refresh",
  expires_at,
  user: { id: "piloto" },
});
function setup(initial, request, clock = () => 100) {
  const data = new Map(
    initial ? [[SESSION_STORAGE_KEY, JSON.stringify(initial)]] : [],
  );
  const storage = {
    getItem: async (k) => data.get(k) || null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
  return { manager: new SessionManager(storage, request, clock), data };
}
test("login usa somente a rota Worker e persiste sessão recebida, sem metadados fictícios", async () => {
  let received;
  const { manager, data } = setup(null, async (path, init) => {
    received = { path, init };
    return value();
  });
  const events = [];
  manager.subscribe((s) => events.push(s));
  await manager.login("piloto", "senha");
  assert.equal(received.path, "/api/trip/auth/login");
  assert.equal(received.init.auth, false);
  assert.deepEqual(JSON.parse(received.init.body), {
    usuario: "piloto",
    senha: "senha",
  });
  assert.equal((await manager.getSession()).user.id, "piloto");
  assert.ok(data.has(SESSION_STORAGE_KEY));
  assert.equal(events.length, 1);
});
test("requisições concorrentes compartilham uma única rotação do refresh token", async () => {
  let calls = 0;
  let resolve;
  const next = new Promise((r) => (resolve = r));
  const { manager } = setup(value("old", 120), async () => {
    calls++;
    return next;
  });
  const first = manager.getSession(),
    second = manager.getSession();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  resolve(value("renewed", 1000));
  const result = await Promise.all([first, second]);
  assert.ok(result.every((s) => s.access_token === "renewed"));
});
test("logout durante renovação impede restauração tardia e remove armazenamento", async () => {
  let resolve;
  const wait = new Promise((r) => (resolve = r));
  const { manager, data } = setup(value("old", 120), async (path) =>
    path.endsWith("/logout") ? {} : wait,
  );
  const renewing = manager.getSession();
  await new Promise((r) => setImmediate(r));
  await manager.logout();
  resolve(value("late", 1000));
  await renewing;
  assert.equal(await manager.getSession(), null);
  assert.ok(!data.has(SESSION_STORAGE_KEY));
});
test("refresh recusado encerra sessão; falha temporária preserva refresh para nova tentativa", async () => {
  const denied = setup(value("old", 120), async () => {
    throw Object.assign(new Error("expirada"), { status: 401 });
  });
  assert.equal(await denied.manager.getSession(), null);
  assert.equal(denied.data.size, 0);
  const offline = setup(value("old", 90), async () => {
    throw Object.assign(new Error("rede"), { status: 0 });
  });
  await assert.rejects(offline.manager.getSession(), /rede/);
  assert.ok(offline.data.has(SESSION_STORAGE_KEY));
});
test("logout local termina mesmo sem acesso ao Worker", async () => {
  const { manager, data } = setup(value(), async () => {
    throw new Error("offline");
  });
  await manager.getSession();
  await manager.logout();
  assert.equal(await manager.getSession(), null);
  assert.equal(data.size, 0);
});
