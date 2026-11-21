# Trip Share

Aplicativo de tripulação em Expo Router para iOS, Android e web. As três plataformas usam as telas de `artifacts/share-brasil` e a API autenticada do Worker `backend-share`.

## Desenvolvimento

```bash
pnpm install
cd artifacts/share-brasil
cp .env.example .env # somente se ainda não existir
pnpm start
```

Configure `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Todas são configurações públicas do aplicativo; nunca use service_role ou credenciais de serviço no bundle. O login mantém o usuário sem `@`, com domínio `share-brasil.com`; os dados pessoais exibidos vêm de `/api/colaborador/perfil`, incluindo o e-mail cadastrado no D1.

## Produto

- **Início:** próximo voo atribuído, acesso à operação, diário e despesas reais.
- **Meus voos:** seleção por dia, próximos voos e histórico; detalhe com horários, checklist, briefing e hospedagem.
- **Despesas:** iniciar pelo voo, continuar rascunho, criar despesas e comprovantes, consultar histórico, finalizar e abrir PDF.
- **Perfil:** identidade e avatar privados, habilitações e CMA atualizados, dados cadastrais, pagamentos, férias e documentos; saída da conta com retorno ao login.

A antiga PWA em Vite tinha perfil, financeiro e relatórios de demonstração independentes do app. Suas telas e contexto foram removidos. `artifacts/share-brasil-pwa` agora exporta a mesma aplicação Expo para web, preservando esse diretório de saída para o deploy existente. O cache `sb:*` usado pela demonstração é removido na primeira abertura da aplicação web.

## Validação

```bash
pnpm --filter @workspace/share-brasil run typecheck
pnpm --filter @workspace/share-brasil test
pnpm --filter @workspace/share-brasil test:web
```

`test:web` compila o bundle de produção e executa os fluxos em JSDOM com uma API local isolada: início, perfil/CMA/habilitações, criação e salvamento de despesas com centavos e IDs estáveis, finalização e logout. As fixtures ficam exclusivamente em `tests`; não integram o aplicativo. A simulação DOM não substitui a conferência visual e de câmera/compartilhamento em iOS e Android.

## Compilação e deploy

```bash
# Saída web única em artifacts/share-brasil-pwa/dist
pnpm --filter @workspace/share-brasil-pwa build

# Exportação nativa / build EAS, conforme o ambiente do projeto
pnpm --filter @workspace/share-brasil run build
```

O build web aceita `EXPO_PUBLIC_*`; por compatibilidade também converte `VITE_API_URL`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` quando presentes no ambiente. O diretório `dist` inclui manifesto e redirecionamento SPA para Cloudflare Pages. O domínio web deve estar autorizado no CORS do Worker.

Publique primeiro o backend que adiciona `habilitacoes` e `cma` ao perfil e trata avatars legados, depois o aplicativo. Esta correção não exige migração de banco. As validades exibidas são as cadastradas pela equipe; o app não altera registros médicos ou habilitações.

## Autenticação e arquivos

O Supabase Auth valida o acesso; a API recebe o Bearer da sessão. Em iOS/Android, a sessão é cifrada com AES-GCM e a chave permanece no SecureStore. Na web, utiliza o armazenamento da sessão Supabase. O logout local apaga essa sessão, limpa o cache de consultas e recria a navegação para evitar dados de outro usuário.

Fotos e documentos privados são carregados com autorização, sem token na URL. PDFs e comprovantes usam compartilhamento nativo ou download autenticado na web. Falhas de consulta mostram erro e opção de tentar novamente; não ativam dados de demonstração.

Os diretórios `artifacts/mockup-sandbox`, `artifacts/api-server` e `lib` são infraestrutura/sandbox do monorepo, não a interface de produção.
