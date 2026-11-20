# tripapp

Monorepo do Share Brasil. O app principal é um **Expo (React Native, Expo Go)** que consome a API do Worker `backend-share` (Hono + D1).

## Estrutura

| Caminho | O que é |
| --- | --- |
| `artifacts/share-brasil` | App Expo (Expo Router). É o produto. |
| `artifacts/share-brasil-pwa` | Versão web em Vite + React. |
| `artifacts/mockup-sandbox` | Sandbox de componentes/UI. |
| `artifacts/api-server` | Express de scaffolding do template. **Não é usado pelo app** — a API real é o Worker. |
| `lib/*` | Pacotes compartilhados (db, api-spec, api-zod, api-client-react). |
| `scripts` | Utilitários de workspace. |

## App mobile

```bash
pnpm install
cd artifacts/share-brasil
cp .env.example .env   # se ainda não existir
pnpm start             # equivale a `expo start`
```

Outros comandos:

```bash
pnpm --filter @workspace/share-brasil run typecheck
pnpm --filter @workspace/share-brasil run build       # expo export (todas as plataformas)
pnpm --filter @workspace/share-brasil run build:web   # expo export --platform web
```

## API

- **Base URL**: `EXPO_PUBLIC_API_URL` (`.env`), apontando para `https://api-workers.sharebrasil.workers.dev`. O mesmo Worker também responde em `https://api.share-brasil.com`.
- **Camada única**: `artifacts/share-brasil/src/lib/api.ts` (`apiFetch`). Nenhuma tela chama `fetch` diretamente.
- **Versionamento**: as rotas do app vivem em `/api/v1/...`. Contrato documentado no repositório `backend-share` (`docs/api-v1.md`).
- **Autenticação**: `Authorization: Bearer <jwt do Supabase>` quando existe sessão. O Worker valida o JWT (`src/lib/auth.ts`).
- **Sessão**: Supabase Auth em `artifacts/share-brasil/src/lib/supabase.ts`. No iOS/Android, o objeto de sessão fica cifrado com AES-GCM no AsyncStorage e a chave AES fica no SecureStore; na web usa `localStorage` com fallback em memória.
- **Login**: `artifacts/share-brasil/app/login.tsx`; exige usuário sem `@` e monta `usuario@share-brasil.com` para o Supabase.
- **Configuração**: defina `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env` conforme `.env.example`. A chave anon/publicável é pública; nunca use `service_role` no app.
- **Renovação**: o Supabase renova tokens automaticamente; o app inicia/para o auto-refresh conforme o estado foreground/background.
- **401**: `apiFetch` chama `supabase.auth.signOut()` e redireciona para `/login` pelo handler registrado no layout raiz.

  ```ts
  setUnauthorizedHandler(() => router.replace("/login"));
  ```

## Ordem de deploy

1. **Worker primeiro.** Enquanto o Worker antigo estiver no ar, `/api/v1/*` responde `404` e o app fica sem clima/plano de voo.
2. **App depois** (`expo export` / EAS).
3. **Web** (`expo export --platform web` → Cloudflare Pages): inclua o domínio do Pages em `ALLOWED_ORIGINS` no `wrangler.toml` do Worker, senão o browser bloqueia por CORS. O app nativo não usa CORS.

## Segurança

- Tudo com prefixo `EXPO_PUBLIC_` é embutido no bundle e é **público**. Não coloque segredo no app.
- Segredos do backend ficam em `wrangler secret put <NOME>` no repositório do Worker.
- O `.env` deste repositório é versionado de propósito. As variáveis Supabase também são públicas por natureza e devem corresponder ao projeto correto; overrides pessoais usam `.env*.local` (ignorados).
