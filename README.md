# Altixdev Funnel

Aplicação full-stack para captação e gestão comercial da **Altixdev**. O projeto combina uma landing page voltada à conversão de empresas interessadas em sites, automações de WhatsApp e atendimento com IA, um diagnóstico guiado, entrega contextual para WhatsApp e um painel privado de CRM para qualificação, acompanhamento e integração dos leads.

> O repositório contém apenas código e documentação. **Nunca** versione chaves de API, senhas, tokens, arquivos `.env`, credenciais de banco ou JSON de contas de serviço.

## Índice

- [Visão geral](#visão-geral)
- [Principais recursos](#principais-recursos)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Instalação local](#instalação-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)
- [Como usar](#como-usar)
- [Integrações](#integrações)
- [Segurança](#segurança)
- [Testes e qualidade](#testes-e-qualidade)
- [Comandos disponíveis](#comandos-disponíveis)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Solução de problemas](#solução-de-problemas)

## Visão geral

A jornada comercial começa em `/`, onde a pessoa interessada preenche um diagnóstico com objetivo, canal atual, gargalo e urgência. Após consentir com o tratamento dos dados, o lead é registrado e recebe uma transição contextual para o WhatsApp da Altixdev. O administrador acompanha a operação em `/painel`, protegido por e-mail e senha configurados no ambiente.

```text
Landing page → Diagnóstico + consentimento → Lead no banco → WhatsApp contextual
                                              │
                                              ├─ Painel CRM e pipeline
                                              ├─ Exportação CSV/JSON
                                              ├─ Webhooks / n8n
                                              ├─ Google Sheets / PostgreSQL
                                              └─ Logs e notificações
```

## Principais recursos

| Área | Recursos incluídos |
|---|---|
| Landing page | Proposta comercial da Altixdev, CTAs, objeções, FAQ e formulário diagnóstico em etapas. |
| Captura de leads | Registro de nome, contato, empresa, contexto do diagnóstico, consentimento, origem e data. |
| WhatsApp | Redirecionamento com mensagem contextual baseada nas respostas do diagnóstico. |
| Painel CRM | Pipeline com estágios `novo`, `diagnóstico`, `proposta`, `ganho` e `perdido`; prioridade, observações e próximo passo. |
| Exportação | Leads e logs em CSV ou JSON, com registro de auditoria do evento de exportação. |
| Webhooks / n8n | Criação, edição, ativação, teste, envio manual de lead e autenticação por cabeçalho opcional. |
| Google Sheets | Sincronização manual ou automática opcional de leads; atualiza a linha existente por `source_lead_id`. |
| PostgreSQL externo | Teste de conexão, criação/atualização de tabela e UPSERT por `source_lead_id`. |
| Google Analytics 4 | Tag de medição opcional na landing page e painel de métricas com Google Analytics Data API. |
| Notificações | ntfy e Chanify com teste, estado de saúde e alertas de novos leads, atualizações, exportações e falhas relevantes. |
| Logs | Histórico filtrável e exportável de ações do CRM e de integrações. |

## Arquitetura

O projeto utiliza React no cliente, Express e tRPC no servidor e Drizzle ORM sobre MySQL/TiDB. A comunicação da interface com o servidor é tipada de ponta a ponta por tRPC.

| Camada | Tecnologias | Responsabilidade |
|---|---|---|
| Front-end | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, Wouter | Landing page, painel e formulários de integração. |
| Back-end | Node.js, Express 4, tRPC 11, Zod | Regras de negócio, autorização, validações e endpoints tipados. |
| Dados | MySQL/TiDB, Drizzle ORM | Leads, webhooks, logs e configurações de integração cifradas. |
| Autenticação | Sessão JWT assinada e cookie HTTP-only | Acesso administrativo por e-mail/senha configurados no ambiente. |
| Integrações | Google APIs, `pg`, HTTP seguro | Sheets, PostgreSQL, GA4, webhooks/n8n, ntfy e Chanify. |

## Requisitos

| Item | Versão ou requisito |
|---|---|
| Node.js | 22 ou superior recomendado |
| pnpm | 10 ou superior |
| Banco de dados | MySQL 8+, TiDB compatível ou serviço equivalente acessível por `DATABASE_URL` |
| Navegador | Atualizado, para operar a landing page e o painel |
| Serviços externos | Apenas quando a respectiva integração for ativada no painel |

## Instalação local

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/Wesleybarroso/altixdev-funnel.git
cd altixdev-funnel
pnpm install
```

Crie um arquivo `.env` local a partir das variáveis descritas abaixo, sem incluir esse arquivo no Git. Em seguida, prepare o banco e inicie o servidor:

```bash
pnpm db:push
pnpm dev
```

Com a aplicação em execução, acesse:

| Rota | Finalidade |
|---|---|
| `http://localhost:3000/` | Landing page pública. |
| `http://localhost:3000/painel` | Painel privado de oportunidades e integrações. |

## Variáveis de ambiente

As variáveis devem ser configuradas somente no gerenciador seguro de segredos do ambiente de execução. Valores reais não devem aparecer no código, Git, logs ou documentação.

### Necessárias para a aplicação

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | URL de conexão MySQL/TiDB usada pelo Drizzle. |
| `JWT_SECRET` | Segredo usado para assinar sessões administrativas e cifrar configurações sensíveis. Use valor longo e aleatório. |
| `ALTIXDEV_ADMIN_EMAIL` | E-mail autorizado a entrar em `/painel`. |
| `ALTIXDEV_ADMIN_PASSWORD` | Senha do painel. Nunca a exponha no cliente. |
| `NODE_ENV` | Use `development` localmente e `production` no ambiente publicado. |

### Fornecidas pelo ambiente Manus

| Variável | Finalidade |
|---|---|
| `VITE_APP_ID` | Identificador da aplicação. |
| `OAUTH_SERVER_URL` | URL do serviço OAuth do ambiente. |
| `OWNER_OPEN_ID` | Identificador do proprietário no ambiente. |
| `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` | Serviços internos, quando aplicáveis. |
| `VITE_FRONTEND_FORGE_API_URL` e `VITE_FRONTEND_FORGE_API_KEY` | Configurações de acesso do cliente a serviços fornecidos pelo ambiente. |

> Para produção no Manus, configure credenciais pelo painel de **Secrets** do projeto. Não substitua segredos reais por constantes no código.

## Banco de dados e migrações

O schema está em `drizzle/schema.ts` e contém as tabelas `users`, `leads`, `webhooks`, `eventLogs` e `integrationConfigs`.

| Tabela | Uso |
|---|---|
| `leads` | Leads, diagnóstico, consentimento, pipeline, notas e próximo passo. |
| `webhooks` | Destinos HTTP e segredos cifrados para n8n/CRM. |
| `eventLogs` | Auditoria de CRM, exportações, testes e integrações. |
| `integrationConfigs` | Configurações cifradas de Sheets, PostgreSQL, GA4, ntfy e Chanify. |

Para gerar e aplicar migrações localmente:

```bash
pnpm db:push
```

Em ambientes com dados reais, revise o SQL gerado antes de aplicá-lo. Modificações destrutivas em tabelas devem ser planejadas e ter backup prévio.

## Como usar

### Landing page e diagnóstico

1. A pessoa interessada acessa `/`.
2. Preenche o diagnóstico guiado e aceita o consentimento obrigatório.
3. O sistema cria o lead com o contexto comercial no banco.
4. A página abre o WhatsApp com uma mensagem preparada a partir das respostas.

### Painel CRM

1. Acesse `/painel`.
2. Entre com o e-mail e a senha administrativos definidos nas variáveis de ambiente.
3. Na aba **Pipeline**, filtre oportunidades, atualize estágio/prioridade, escreva notas e defina o próximo passo.
4. Exporte leads ou logs em CSV/JSON conforme necessário.
5. Use a aba **Integrações** para configurar e testar os serviços externos.

### Exportação

As exportações são geradas no navegador e o sistema registra no histórico o formato, a quantidade e o tipo de dado exportado. Utilize CSV para importação comum em CRMs e JSON para integrações ou backup estruturado.

## Integrações

Todas as configurações abaixo são cadastradas no painel por um administrador. Senhas, tokens, URLs protegidas e JSON de conta de serviço são cifrados no banco e não retornam à interface após o salvamento.

### Webhooks e n8n

O painel permite criar múltiplos destinos HTTPS, ativá-los, testá-los e enviar leads manualmente. Para n8n:

1. Crie um workflow com o nó **Webhook** usando método `POST`.
2. Ative o workflow e copie a **Production URL** pública em HTTPS.
3. Em **Integrações → Webhooks**, cadastre a URL, um nome e, se necessário, o nome do cabeçalho/autenticação.
4. Clique em **Testar** e depois use **Enviar lead** para validar o payload comercial.

URLs locais, privadas ou não HTTPS são bloqueadas para reduzir risco de SSRF.

### Google Sheets

Configure uma conta de serviço no Google Cloud, habilite a Google Sheets API e compartilhe a planilha de destino com o e-mail da conta de serviço como editor. No painel, informe o JSON da conta de serviço, o `spreadsheetId` e o nome da aba.

O primeiro envio prepara o cabeçalho quando necessário. Sincronizações posteriores usam `source_lead_id` para atualizar o lead existente em vez de duplicá-lo. A sincronização pode ser manual ou automática para criação/atualização de leads.

### PostgreSQL externo

Cadastre uma string de conexão PostgreSQL, o nome da tabela de destino e a preferência de SSL. O serviço testa a conexão, cria a tabela externa quando necessário e faz UPSERT pela coluna `source_lead_id`.

Use um usuário de banco com o menor conjunto de permissões necessário e prefira conexão TLS em produção.

### Google Analytics 4

Para métricas de painel, habilite a Google Analytics Data API, crie uma conta de serviço e conceda acesso à propriedade GA4. No painel, informe o JSON da conta de serviço e o ID da propriedade. O campo opcional `Measurement ID` ativa a tag de medição na landing page quando a integração estiver habilitada.

> O ID de medição é público por natureza; a credencial JSON da conta de serviço não é. Nunca cole a credencial no código da landing page.

### ntfy

Informe o servidor, tópico e token opcional em **Integrações → ntfy**. Para o serviço oficial, o servidor costuma ser `https://ntfy.sh`. Use um tópico difícil de adivinhar e teste a entrega no celular antes de ativar alertas automáticos.

### Chanify

O Chanify é uma alternativa para alertas no iPhone. Crie um canal no app, copie o token do canal e cole-o somente no painel. É possível usar o servidor oficial `https://api.chanify.net` ou um endpoint HTTPS próprio, desde que esteja publicamente acessível.

### Alertas e saúde das integrações

Quando configurados e ativos, ntfy e Chanify podem receber alertas de:

- novo lead;
- atualização no pipeline;
- exportação de leads ou logs;
- teste de integração;
- falha de integração e sincronização automática.

O painel também mostra o último teste, status HTTP e mensagem de saúde para os provedores configurados.

## Segurança

O projeto foi estruturado para reduzir exposição de informações comerciais e credenciais.

| Medida | Aplicação |
|---|---|
| Acesso administrativo | Procedimentos administrativos protegidos e login por e-mail/senha configurados no ambiente. |
| Sessão | JWT assinado, cookie HTTP-only e fallback por cabeçalho assinado em previews que bloqueiam cookies. |
| Dados sensíveis | URLs, tokens, strings de conexão e JSON de contas de serviço são cifrados em repouso. |
| Interface | A UI recebe somente estados seguros, como `hasToken`, `hasCredential` e host redigido. |
| Webhooks | Exige HTTPS e bloqueia destinos locais e faixas privadas conhecidas. |
| Consentimento | O lead só é criado pela landing page quando o consentimento é confirmado. |
| Auditoria | Operações relevantes registram evento em `eventLogs`. |

Ao operar o projeto, também siga estas regras:

1. Não envie tokens, senhas ou chaves por chat, e-mail público ou Git.
2. Não exponha o painel administrativo em uma conta compartilhada.
3. Revogue tokens de integrações quando houver suspeita de vazamento.
4. Faça backup do banco antes de mudanças estruturais.
5. Revise permissões de conta de serviço e usuários de banco periodicamente.

## Testes e qualidade

O projeto usa Vitest para regressões de autenticação, leads, webhooks, integrações, Google Analytics, Chanify, ntfy e sincronização direta.

```bash
pnpm check
pnpm test
```

Antes de publicar alterações relevantes, execute os dois comandos. Testes que dependem de serviços externos usam mocks; a validação real ainda deve ser feita no painel com credenciais válidas, sem registrar segredos nos logs.

## Comandos disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia o servidor de desenvolvimento com recarregamento. |
| `pnpm build` | Gera o bundle de cliente e servidor em `dist/`. |
| `pnpm start` | Inicia o bundle compilado em produção. |
| `pnpm check` | Executa a verificação de tipos TypeScript. |
| `pnpm test` | Executa a suíte Vitest. |
| `pnpm db:push` | Gera e aplica as migrações Drizzle configuradas. |
| `pnpm format` | Formata o código com Prettier. |

## Estrutura de diretórios

```text
altixdev-funnel/
├── client/
│   └── src/
│       ├── pages/                 # Home, painel e páginas auxiliares
│       ├── components/            # UI reutilizável e cartões de integração
│       └── main.tsx               # Cliente tRPC e fallback de sessão
├── server/
│   ├── routers.ts                 # Contratos tRPC e regras de integração
│   ├── db.ts                      # Acesso a dados via Drizzle
│   ├── adminAuth.ts               # Sessão administrativa
│   ├── webhookService.ts          # Cifragem, payload e segurança de webhook
│   ├── directCrmService.ts        # Google Sheets e PostgreSQL
│   ├── googleAnalyticsService.ts  # Google Analytics Data API
│   ├── ntfyService.ts             # Alertas ntfy
│   └── chanifyService.ts          # Alertas Chanify
├── drizzle/
│   ├── schema.ts                  # Modelos do banco
│   └── *.sql                      # Migrações
├── docs/                          # Guias técnicos, incluindo EasyPanel/Chanify
├── integration_research.md        # Referências e notas de integração
├── todo.md                        # Histórico de tarefas e pendências
└── package.json                   # Dependências e scripts
```

## Solução de problemas

| Situação | Verificação recomendada |
|---|---|
| Painel aceita a senha, mas não abre | Confirme `ALTIXDEV_ADMIN_EMAIL` e `ALTIXDEV_ADMIN_PASSWORD`; o cliente usa fallback de sessão para ambientes de preview que restringem cookies. |
| Google Sheets falha | Verifique se a Sheets API está ativa, se o JSON pertence a uma conta de serviço e se a planilha foi compartilhada com o e-mail dela. |
| PostgreSQL falha | Confirme URL, rede pública, SSL e permissões do usuário externo. |
| GA4 não retorna dados | Confirme a Data API habilitada, ID de propriedade correto e acesso da conta de serviço à propriedade. |
| Webhook/n8n falha | Use URL pública HTTPS, workflow ativo e teste com payload de exemplo. |
| Notificação não chega | Teste o provedor no painel, confirme token/tópico/canal e verifique o estado de saúde exibido. |
| Serviço Chanify próprio falha | Prefira o endpoint oficial enquanto o servidor próprio não estiver com domínio HTTPS, armazenamento persistente e execução validada. |

## Operação e manutenção

Mantenha o repositório privado por padrão, use checkpoints/versionamento antes de alterações importantes e atualize dependências de forma controlada. A documentação de cada integração deve ser revisada sempre que credenciais, domínios, fornecedores ou permissões forem alterados.

Para suporte de produto e hospedagem gerenciada, use os canais oficiais da plataforma. Para mudanças de negócio no funil, registre a demanda em `todo.md`, implemente com testes e atualize este README quando o fluxo operacional mudar.
