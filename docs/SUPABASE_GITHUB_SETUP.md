# Configuração do Backend Supabase + GitHub OAuth (Fase 6)

Este guia descreve como colocar o **Christmas Commit City** em produção com **GitHub OAuth**, banco PostgreSQL blindado com **RLS estrito + RPCs atômicas** e **Edge Function** segura (`sync-github-contributions`).

---

## 1. Criar Projeto no Supabase e Configurar o GitHub OAuth

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard) e anote seu **Project Ref** (`<seu-project-ref>`).
2. No painel **Authentication → Providers → GitHub**, copie a **Callback URL** exata:
   ```text
   https://<seu-project-ref>.supabase.co/auth/v1/callback
   ```
3. No GitHub, acesse **Settings → Developer settings → OAuth Apps → New OAuth App** e preencha:
   - **Application name:** `Christmas Commit City`
   - **Homepage URL:** `https://seu-dominio.vercel.app` (ou `http://localhost:5173` para testes locais)
   - **Authorization callback URL:** `https://<seu-project-ref>.supabase.co/auth/v1/callback`
4. Copie o **Client ID** e o **Client Secret** do GitHub e cole em **Authentication → Providers → GitHub** no Supabase (ative o provider).
5. Em **Authentication → URL Configuration** no Supabase:
   - **Site URL:** `https://seu-dominio.vercel.app` (ou `http://localhost:5173`)
   - **Redirect URLs:** adicione `http://localhost:5173` e `https://seu-dominio.vercel.app/**`.

> **Escopo mínimo:** o app solicita apenas `read:user` — **nunca** acesso de escrita aos repositórios.

---

## 2. Variáveis de Ambiente (`.env` / Vercel vs Secrets do Supabase)

### Frontend (`.env` local e Environment Variables na Vercel)
Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha **apenas** variáveis públicas `VITE_*` (nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend):

```env
VITE_SUPABASE_URL=https://<seu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon-publica>
VITE_CONTRIBUTION_YEAR=2026
```

### Backend (Secrets da Edge Function no Supabase)
As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente nas Edge Functions do Supabase. Configure adicionalmente:

```bash
# Origens permitidas para CORS em produção (separadas por vírgula)
npx supabase secrets set ALLOWED_ORIGINS="https://seu-dominio.vercel.app,http://localhost:5173"

# Opcional/recomendado: token clássico read-only para re-sincronizações após refresh de sessão
npx supabase secrets set GITHUB_READONLY_TOKEN="ghp_seu_token_apenas_leitura"
```

---

## 3. Aplicar Migrations SQL e Fazer Deploy da Edge Function

No diretório raiz do projeto:

```bash
# 1. Autenticar e vincular ao projeto Supabase
npx supabase login
npx supabase link --project-ref <seu-project-ref>

# 2. Aplicar todas as migrations SQL (tabelas, seed de shop_catalog, RLS, views e RPCs)
npx supabase db push

# 3. Fazer deploy da Edge Function endurecida
npx supabase functions deploy sync-github-contributions
```

> **Alternativa pelo painel Web:** caso prefira aplicar o SQL manualmente, cole o conteúdo de [`supabase/migrations/20261122_phase6_secure_backend.sql`](../supabase/migrations/20261122_phase6_secure_backend.sql) no **SQL Editor** do Supabase e execute.

---

## 4. Checklist Rápido de Teste de Segurança

Execute estes testes no console do navegador ou via `curl`/Postman usando a chave `anon` e um JWT de usuário autenticado:

1. **Bloqueio de escrita direta (forjar commits / desbloquear itens):**
   - Tente um `POST /rest/v1/trees` ou `PATCH /rest/v1/trees?user_id=eq.<uid>` com `{ "total_commits": 99999 }` usando `anon` ou o JWT do usuário.
   - **Resultado esperado:** HTTP `401` / `403` (`permission denied for table trees`).
   - Tente inserir diretamente em `user_unlocks`, `tree_gifts` ou `payment_orders` via REST.
   - **Resultado esperado:** HTTP `401` / `403` (escrita bloqueada para clientes).

2. **Privacidade de remetentes de presentes:**
   - Como visitante anônimo (`anon`) ou logado com outro usuário (`Usuário B`), consulte `/rest/v1/tree_gifts?select=*`.
   - **Resultado esperado:** array vazio `[]` (ninguém além do dono `auth.uid() = recipient_user_id` enxerga `sender_username`).
   - Consulte `/rest/v1/public_trees?select=*` e `/rest/v1/rpc/get_public_tree_gift_counts`.
   - **Resultado esperado:** retorna árvores públicas sem `user_id`/`spent_commits` e apenas contagens agregadas `(recipient_tree_id, gift_id, gift_count)` sem remetentes.

3. **Bloqueio de presente pago gratuito e rate limit:**
   - Tente chamar `/rest/v1/rpc/send_free_gift` passando `p_gift_id: "gift-retro-pc"` ou `"gift-teddy"`.
   - **Resultado esperado:** erro `GIFT_NOT_FREE_OR_INVALID`.
   - Envie mais de 10 presentes gratuitos em menos de 10 minutos.
   - **Resultado esperado:** erro `RATE_LIMIT_SENDER_WINDOW`.

4. **Proteção contra gasto duplo de commits (race condition) e spoof no sync:**
   - Chame `unlock_item_with_commits` em paralelo 2x rápidas para o mesmo item ou sem saldo suficiente.
   - **Resultado esperado:** o lock `FOR UPDATE` impede cobrança dupla e bloqueia saldo insuficiente com `INSUFFICIENT_COMMITS`.
   - Chame `sync-github-contributions` enviando `username` de outra pessoa no body; confirme que a função ignora o body e sincroniza apenas a identidade GitHub verificada do JWT, respeitando o cooldown de 5 minutos.
