# Conectas | Etapa 1 — Análise e arquitetura

## Entendimento
Hoje venda, execução e receita vivem em planilhas e ferramentas separadas. O sistema liga **vendido → acordado → executado → reconhecível como receita**, começando pelo módulo de Projetos e já preparado para Comercial e Financeiro.

Dois princípios guiam tudo:
1. **Escopo contratado ≠ escopo operacional vigente.** Cada projeto tem versões de escopo; a original nunca é alterada.
2. **Tarefa concluída ≠ receita.** Só um *entregável marcado como marco de receita* gera um *evento de receita pendente*, que precisa de validação por quem tem permissão financeira "validar".

## Decisões técnicas
| Tema | Decisão |
|---|---|
| Front-end | Next.js (App Router) + React + TypeScript, responsivo |
| Back-end/Banco | Supabase: Postgres, Auth individual, Storage privado, RLS |
| Hospedagem | Railway (front) + Supabase (dados) |
| IA | Rota de servidor; chave nunca vai ao navegador. Ativa quando a chave Anthropic for informada. Sem chave: conferência manual |
| Dinheiro | `numeric(14,2)`; redistribuição preserva o total (centavos sobram no último item) |
| Auditoria | Triggers gravam antes/depois/usuário/data em `audit_log` (imutável) |
| Permissões | Papel (admin, gestora, instrucional, comercial, financeiro) + nível financeiro separado (nenhum, ver, editar, validar) |

## Perfis
- **Admin/Coordenação (Ju):** tudo, usuários, permissões, auditoria.
- **Gestora (Angélica, Marcelle):** vê todos os projetos; edita os seus e os de quem ela substitui no período; confirma entregas.
- **Instrucional (Rosângela):** vê tudo; atualiza só o que é dela; não confirma entrega financeira.
- **Comercial / Financeiro:** reservados para integração futura.
- **Substituição temporária:** tabela `substituicoes` dá edição temporária (Cenário B).

## Modelo de dados
Arquivo: `supabase/migrations/0001_schema.sql` (sintaxe validada, 92 comandos; ainda não executado em banco real).
Hierarquia: Cliente → Projeto → Escopo (versão) → Macroetapa → Entregável → Atividade. Mais: valores por entregável, eventos de receita (índice único impede duplicidade), mudanças de escopo, demandas instrucionais, documentos versionados, importações por IA, notificações, auditoria.

## Fluxos-chave
- **Mudança de escopo:** nova versão de escopo → decisão de valor (manter e redistribuir / alterar valor / pendente) → aprovação por quem tem permissão financeira.
- **Entrega → receita:** `confirmar_entrega()` cria 1 evento pendente; `validar_receita()` reconhece. Dashboards leem só dados persistidos.
- **Importação:** upload → extração com origem por campo → conferência humana → criação.

## Dúvidas a validar com a Conectas (nada foi presumido)
1. Regra contábil exata de reconhecimento de receita.
2. Quem aprova mudanças financeiras.
3. Formato definitivo das planilhas de precificação e receita.
4. Lista completa de perfis.
5. Integrações com sistemas financeiros existentes.
6. Se o cliente precisa aprovar entregas.
7. Se o piloto "Impactômetro", NPS, impressão e custo logístico entram agora (existem no piloto, não no prompt).

## Próximos passos
Etapa 2 (MVP) começa assim que houver o projeto Supabase e os prints do design.

## Design
Tokens em `design/tokens.css` (cores claro/escuro, Funnel Display + DM Sans, raios, sombras). Regras: sem emoji, sem ícones além de "←" e pontos de status, status sempre com palavra, números em pt-BR, logo sempre sobre fundo branco (BrandBar).
