# Conectas | Projetos e Receita Contábil (MVP)

Next.js 15 + Supabase (Auth, Postgres, RLS). Permissões e regras de receita vivem no banco.

## Configurar o banco (uma vez)
1. Supabase → SQL Editor: rodar `supabase/migrations/0001_schema.sql`, depois `0002_app.sql`, depois `0003_marketing.sql` (sozinha, em uma consulta separada) `0004_responsaveis_alertas.sql`, `0005_papeis_horario_alertas.sql` e `0006_planilha_e_importacao.sql`, `0007_macroetapas_fixas.sql` `0008_financeiro_reacao_calendario.sql` e `0009_cronograma_permissoes_alertas.sql` (ou apenas `supabase/TUDO_PENDENTE_0002_a_0009.sql`).
2. Authentication → Users → Add user (marque "Auto Confirm User"). **O primeiro usuário criado vira administrador** com permissão financeira total. Os demais entram como gestora, sem acesso financeiro; a administração ajusta em Administração.

## Variáveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=https://rmdgqxxrqcyviqbvxoic.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave publishable>
```
`SUPABASE_SERVICE_ROLE_KEY` (chave secret): usada só pelo servidor, para a administração cadastrar usuários. Configure apenas nas variáveis do Railway, nunca no código nem no navegador.

## Rodar
`npm install && npm run dev` (local) ou `npm run build && npm start` (Railway: build padrão Nixpacks).

## Marketing
Aba Marketing: pessoas impactadas (PAX) por projeto, mês e data, e NPS. O PAX é informado uma vez, na entrega; o NPS é lançado no projeto. Entregas podem ser marcadas como pagas ou não (não paga = sem evento de receita).

## Importar arquivo no Novo projeto
Em Projetos > Novo projeto, envie um arquivo e confira a prévia antes de criar (nada é gravado antes disso).
- **Planilha de cronograma (Excel, formato da equipe):** lida sem IA. Se o arquivo tiver várias abas, escolha a aba do cliente.
- **PDF, DOCX ou XLSX do comercial:** lidos por IA (Claude), que nunca preenche o que não encontra e mostra a origem de cada item. Exige a variável `ANTHROPIC_API_KEY` no Railway; sem ela, o sistema avisa e o preenchimento é manual.
A criação usa a função `importar_estrutura`, que grava tudo em uma transação e não dispara e-mails em massa.

## Financeiro do projeto, Impactômetro e Calendário
- **Aba Financeiro em cada projeto:** despesas (logística, material, impressão, parceiros) com valor orçado opcional, gasto e reembolso. Saving = orçado menos gasto líquido. A administração (permissão financeira "editar e validar") lança o saving como receita contábil. A tela Receita contábil mostra despesas e resultado parcial por projeto.
- **Impactômetro** (antes Marketing): inclui avaliação de reação dentro de "NPS por projeto". Avaliações podem vir do cliente, com o arquivo anexado (armazenamento privado `avaliacoes`).
- **Calendário de entregas:** visão mensal com filtros. Cada pessoa gera um link `.ics` privado para assinar no Outlook (calendário geral e minhas tarefas). Exige `SUPABASE_SERVICE_ROLE_KEY` e `APP_URL` no servidor.

## Alertas e agenda
Cada atividade e entrega tem responsável, data e horário. Ao atribuir (ou mudar responsável, data ou horário), o banco cria uma notificação e enfileira um e-mail. O endpoint `/api/cron/alertas` gera lembretes (15 dias, 7 dias e 2 dias antes; atrasada, repetida a cada 7 dias e com aviso ao GP) e envia a fila por e-mail com **convite de agenda (.ics)**, que abre no Outlook, Google Agenda e Apple Calendar.

Para funcionar, configure no Railway: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `APP_URL`, `EMAIL_FROM` e `SENDGRID_API_KEY` (ou `RESEND_API_KEY`), e agende uma chamada a cada 15 minutos:
`POST https://<sistema>/api/cron/alertas` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`.
Sem domínio próprio, o SendGrid com remetente único verificado envia para qualquer destinatário. Ainda não testado com envio real.

## Regras implementadas
- Visualização compartilhada entre toda a equipe; edição só para responsável, apoio, admin ou substituta no período.
- Valores financeiros em tabelas separadas, com visualizar / editar / validar separados.
- Confirmar entrega cria 1 evento de receita pendente (índice único impede duplicidade); só quem tem "validar" reconhece.
- Histórico de alterações (antes/depois/usuário) em `audit_log`, imutável.

## Ainda não implementado (Etapas 3 e 4)
Importação por IA, versões de escopo / mudança de escopo com redistribuição, Gantt/calendário/Kanban, desenvolvimento instrucional, documentos, relatórios.


## Outlook (Microsoft 365)
Para enviar os alertas pelo Outlook e criar o compromisso na agenda de quem recebe a tarefa, o administrador do Microsoft 365 registra um aplicativo no Entra ID com as permissões de aplicativo **Mail.Send** e **Calendars.ReadWrite** (com consentimento do administrador) e informa no servidor: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` e `GRAPH_SENDER` (caixa que envia). Sem essas variáveis, o sistema usa SendGrid/Resend com convite .ics.
