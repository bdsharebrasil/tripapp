// Verificação do bundle de produção em DOM, com API isolada de teste.
// Execute com QA_URL apontando para um servidor local de fixtures; não usa contas reais.
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { criarServidorQA } from "./fixtures-web.mjs";
const { server, url } = await criarServidorQA();
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => {
  errors.push(e);
  console.error("DOM:", e.message);
});
virtualConsole.on("error", (...args) => console.error("APP:", ...args));
const dom = await JSDOM.fromURL(url, {
  resources: "usable",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(w) {
    w.fetch = (url, init) =>
      fetch(
        new URL(typeof url === "string" ? url : url.url, w.location.href),
        init,
      );
    for (const key of [
      "TextEncoder",
      "TextDecoder",
      "Request",
      "Response",
      "Headers",
      "AbortController",
      "Blob",
    ])
      w[key] = globalThis[key];
    Object.defineProperty(w, "crypto", { value: webcrypto });
    w.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    });
    w.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollTo = () => {};
    w.alert = () => {};
    w.confirm = () => true;
    const anchorClick=w.HTMLAnchorElement.prototype.click;
    w.qaDownloads=[];
    w.HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download'))w.qaDownloads.push(this.download);else anchorClick.call(this)};
    w.URL.createObjectURL = () => "blob:qa";
    w.URL.revokeObjectURL = () => {};
    w.CSSFontFaceRule = class {};
    w.FontFace = class {
      constructor() {}
      async load() {
        return this;
      }
    };
    w.document.fonts = {
      add() {},
      delete() {},
      load: async () => [{}],
      ready: Promise.resolve(),
    };
  },
});
const w = dom.window,
  doc = w.document;
const wait = async (fn, label) => {
  for (let i = 0; i < 150; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Tempo excedido: ${label}\n${doc.body.textContent.slice(0, 5000)}`,
  );
};
const text = () => doc.body.textContent;
const click = async (label) => {
  let el;
  await wait(()=>{
    el=[...doc.querySelectorAll('[role="button"],[role="tab"],a,button')].find(x=>x.getAttribute('aria-label')===label||x.textContent.replace(/[\uE000-\uF8FF]/g,'').trim()===label);
    return Boolean(el);
  },`controle ${label}`);
  el.click();
  await new Promise(r=>setTimeout(r,250));
};

try {
  await wait(() => text().includes("Sua operação, em dia."), "início");
  await wait(
    () => text().includes("Piloto de Teste"),
    "identidade do cadastro",
  );
  await click("Perfil");
  await wait(() => text().includes("30/06/2027"), "CMA atualizado");
  assert.ok(text().includes("MLTE") && text().includes("IFRA"));
  await wait(()=>doc.querySelector('img[src^="data:image/"]'),"avatar autenticado");
  await click("Dados");
  assert.ok(text().includes("piloto.teste@exemplo.com"));
  assert.ok(!text().includes("login-interno@share-brasil.com"));
  await click("Despesas");
  await wait(() => text().includes("Iniciar"), "voo disponível");
  // O botão Iniciar é parte do cartão clicável de voo.
  const start = [...doc.querySelectorAll('[role="button"]')].find((el) =>
    el.textContent.includes("Iniciar"),
  );
  assert.ok(start);
  start.click();
  await wait(
    () => text().includes("Criar nova despesa"),
    "abrir relatório criado",
  );
  console.log(
    "PASS: início, perfil real, CMA/habilitações e criação de relatório.",
  );
  await click("Criar nova despesa");
  await wait(() => text().includes("Despesa 1"), "nova despesa");
  const inputs = [...doc.querySelectorAll("input")];
  const change = (el, value) => {
    const set = Object.getOwnPropertyDescriptor(
      w.HTMLInputElement.prototype,
      "value",
    ).set;
    set.call(el, value);
    el.dispatchEvent(new w.Event("input", { bubbles: true }));
    el.dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  change(
    inputs.find((el) => el.getAttribute("inputmode") === "decimal") ||
      inputs[1],
    "188,50",
  );
  const description = doc.querySelector("textarea");
  const set = Object.getOwnPropertyDescriptor(
    w.HTMLTextAreaElement.prototype,
    "value",
  ).set;
  set.call(description, "Refeição de teste");
  description.dispatchEvent(new w.Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  await click("Salvar despesas");
  await wait(
    () => w.qaRequests?.some((x) => x.path.endsWith("/despesas-tripulante")),
    "salvamento",
  );
  const saved = w.qaRequests.find((x) =>
    x.path.endsWith("/despesas-tripulante"),
  ).body.despesas[0];
  assert.ok(saved.id);
  assert.equal(saved.valor, 188.5);
  assert.equal(saved.descricao, "Refeição de teste");
  await wait(() => !text().includes("Salvando…"), "salvo");
  await click('Voltar');
  await wait(()=>text().includes('Continuar'),'rascunho disponível');
  const draft=[...doc.querySelectorAll('[role="button"]')].find(el=>el.textContent.includes('REL-QA-001/26')&&el.textContent.includes('Continuar'));
  assert.ok(draft);draft.click();
  await wait(()=>text().includes('Finalizar relatório'),'continuar rascunho');
  await click("Finalizar relatório");
  await wait(
    () => w.qaRequests.some((x) => x.path.endsWith("/finalizar")),
    "finalização",
  );
  await wait(()=>text().includes('Abrir PDF do relatório'),'PDF disponível');
  await click('Abrir PDF do relatório');
  await wait(()=>w.qaDownloads.length===1,'download autenticado');
  assert.ok(w.qaRequests.some(x=>x.path.endsWith('/pdf')));
  await click('Voltar');
  await wait(()=>text().includes('Ver relatório'),'relatório finalizado');
  const finished=[...doc.querySelectorAll('[role="button"]')].find(el=>el.textContent.includes('QA-001/26')&&el.textContent.includes('Ver relatório'));
  assert.ok(finished);finished.click();
  await wait(()=>text().includes('Abrir PDF do relatório'),'consultar relatório finalizado');
  assert.ok(!text().includes('Criar nova despesa'));
  await click("Perfil");
  await wait(() => text().includes("Sair da conta"), "perfil");
  await click("Sair da conta");
  await wait(
    () => text().includes("Entrar") && !text().includes("Piloto de Teste"),
    "logout",
  );
  assert.ok(
    !Object.keys(w.localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    ),
  );
  console.log(
    "PASS: valor com vírgula, ID estável, salvar, finalizar e logout limpando sessão.",
  );
  assert.equal(errors.length, 0);
} finally {
  dom.window.close();
  server.close();
}
