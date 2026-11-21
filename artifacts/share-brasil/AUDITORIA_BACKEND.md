# Trip Share Expo — auditoria de integração (21/11/2026)

## Referência visual
- Início: único lugar onde pode existir fotografia de aeronave ao fundo.
- Agenda, detalhes, briefing, hospedagem e despesas: superfícies sólidas azul-marinho, sem imagem de avião.
- Navegação principal: Início, Agenda, Despesas, Perfil; Diário e Plano ICAO permanecem acessíveis por rotas internas, sem duplicação no menu inferior.

## Rotas verificadas no Worker
| Funcionalidade | Rota | Situação nesta branch |
| --- | --- | --- |
| Voos atribuídos | GET /api/colaborador/meus-voos | Conectado na Agenda |
| Voo, jornadas e hospedagens | GET /api/colaborador/meus-voos/:id | Conectado na Agenda |
| AC / DEP / POU / COR | PATCH /api/interno/jornadas/:jornadaId/pernas/:pernaId | Conectado na Agenda, sujeito à autorização do Worker |
| Listagem dos relatórios de viagem | GET /api/financeiro/relatorios-despesa-viagem/minhas | Já conectado no módulo Despesas |
| Voos disponíveis para relatório | GET /api/financeiro/relatorios-despesa-viagem/meus-voos | Já conectado |
| Criar relatório por voo | POST /api/financeiro/relatorios-despesa-viagem/iniciar-do-voo | Já conectado |
| Gravar despesas | PUT /api/financeiro/relatorios-despesa-viagem/:id/despesas-tripulante | Já conectado |
| Anexos | POST /api/financeiro/relatorios-despesa-viagem/:id/anexos-tripulante | Já conectado |
| Finalizar relatório | POST /api/financeiro/relatorios-despesa-viagem/:id/finalizar | Já conectado |

## Lacunas ainda não resolvidas
1. **Checklist pré-voo:** a Agenda exibe a ação, mas ainda não possui formulário nem fluxo de leitura/gravação. Não é correto declarar o checklist como concluído sem consultar e gravar no Worker.
2. **Briefing:** a Agenda mostra observações operacionais da solicitação e tripulação. O briefing formal, anexos e PDF ainda não foram conectados.
3. **Hospedagem:** consulta real, porém os campos retornados precisam de apresentação específica e validação com registros de produção.
4. **Home:** o dashboard ainda utiliza `useApp()` para horas/voos e o contexto ainda possui `DEMO_*` com persistência AsyncStorage. **Não usar esses números para decisões operacionais.** Migrar para endpoints reais antes de remover os dados de demonstração.
5. **Diário, perfil, férias, plano ICAO, financeiro e manutenção:** revisar cada operação de leitura e escrita para remover dependência de `AppContext` e validar contratos reais; não foram totalmente refatorados nesta branch.
6. **Testes:** não houve execução local de Expo, teste de compilação nem teste autenticado contra produção. Verificar permissões de tripulante para PATCH de horários e fluxo de despesas.
7. **Segurança:** nunca gravar dados de voo, manutenção, checklist ou despesas somente em AsyncStorage como fonte definitiva; o Worker/D1 é a fonte de verdade.

## Publicação
O PR é uma **primeira etapa funcional**, não a conclusão da refatoração de todo o monorepo. Validar em Expo Go (iOS e Android), confirmar chamadas e erros 401/403, e seguir com a integração do checklist/briefing e migração do contexto de demonstração.
