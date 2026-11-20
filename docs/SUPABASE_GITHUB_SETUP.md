# Configuração de GitHub OAuth + Supabase Edge Function (Fase 3)

Este guia descreve como ativar o login real com GitHub e a leitura do calendário de contribuições via **API GraphQL oficial do GitHub** sem expor segredos no frontend.

## 1. Criar um GitHub OAuth App

1. No GitHub, acesse **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Preencha:
   - **Application name:** `Christmas Commit City`
   - **Homepage URL:** `http://localhost:5173` (ou seu domínio da Vercel em produção)
   - **Authorization callback URL:** copie a Callback URL exibida no painel **Authentication → Providers → GitHub** do seu projeto Supabase (`https://<seu-ref>.supabase.co/auth/v1/callback`).
3. Copie o **Client ID** e gere um **Client Secret**.

> **Permissões:** a aplicação solicita apenas o escopo `read:user` — **nunca** acesso de escrita aos repositórios.

## 2. Ativar o provider GitHub no Supabase

1. No painel do Supabase, vá em **Authentication → Providers → GitHub**.
2. Ative o provider e cole o **Client ID** e o **Client Secret**.
3. Em **Authentication → URL Configuration**, adicione `http://localhost:5173` e a URL da Vercel em **Redirect URLs**.

## 3. Publicar a Edge Function `sync-github-contributions`

A função em [`supabase/functions/sync-github-contributions/index.ts`](../supabase/functions/sync-github-contributions/index.ts) consulta `contributionsCollection(from, to)` na API GraphQL do GitHub usando o ano corrente configurado.

```bash
npx supabase login
npx supabase link --project-ref <seu-project-ref>
npx supabase functions deploy sync-github-contributions
```

Opcionalmente (recomendado para re-sincronizações após refresh de sessão quando o `provider_token` expirar), configure um token pessoal clássico **somente leitura pública** como segredo no Supabase:

```bash
npx supabase secrets set GITHUB_READONLY_TOKEN=ghp_seu_token_apenas_leitura_publica
```

## 4. Configurar o `.env` local (e variáveis na Vercel)

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha apenas chaves públicas `VITE_*`:

```env
VITE_SUPABASE_URL=https://<seu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon-publica>
VITE_CONTRIBUTION_YEAR=2026
```
