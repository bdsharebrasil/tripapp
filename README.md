# Trip Share

App de tripulação para iOS, Android e web, com uma única interface Expo Router.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

O único endereço de serviço configurado no app é `EXPO_PUBLIC_API_URL` (padrão `https://api.share-brasil.com`). O arquivo de exemplo fica em `artifacts/share-brasil/.env.example`. Não é necessário configurar banco, chaves de serviço ou outro servidor no aplicativo.

## Arquitetura

- `artifacts/share-brasil`: telas, componentes, sessão e cliente da API.
- O Worker `backend-share` é o único servidor consumido pelo app.
- Dados de negócio e perfis ficam no D1; fotos, comprovantes e PDFs ficam no R2, acessados pelo Worker.
- O serviço de identidade já usado pelas contas existentes fica exclusivamente atrás do Worker. O app não contém SDK nem chaves do provedor.

Todo acesso remoto usa `src/lib/api.ts` (`apiFetch`), incluindo respostas binárias. O upload web lê somente arquivos Blob/Data selecionados no dispositivo e envia o multipart ao Worker. Redirecionamentos HTTP são recusados pelo cliente para impedir saídas do domínio da API.

## Autenticação

O login envia `usuario` e `senha` para `/api/trip/auth/login`. O Worker valida as credenciais no provedor de identidade configurado, exige perfil ativo no D1 e devolve a sessão. A senha não é persistida.

A sessão nativa é cifrada com AES-GCM; a chave fica no SecureStore. A versão web mantém a sessão no armazenamento local. Renovação e logout usam `/api/trip/auth/refresh` e `/api/trip/auth/logout`. Uma renovação atrasada não restaura uma conta já encerrada. Falhas transitórias de rede não apagam o token de renovação; credenciais recusadas encerram a sessão.

## Verificação e builds

```bash
pnpm typecheck
pnpm test
pnpm test:web
pnpm build:native
```

`test:web` compila a aplicação e testa seus fluxos em DOM com API isolada. As fixtures ficam em `tests` e não entram no bundle. Câmera, compartilhamento e apresentação visual devem ser conferidos em aparelho.

Para iOS/Android, use o fluxo Expo/EAS do projeto.

Publique primeiro a atualização de autenticação e arquivos do `backend-share`, depois este aplicativo. Não há migração de banco. Usuários da versão anterior precisam entrar novamente após a atualização da sessão.

O mapa de rotas do aplicativo está em [docs/rotas-worker.md](docs/rotas-worker.md).
