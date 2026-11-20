<p align="center">
  <img
    src="./docs/christmas-commit-city-banner.svg"
    alt="Christmas Commit City — Vila natalina interativa em pixel art"
    width="100%"
  />
</p>

<h1 align="center">🎄 Christmas Commit City</h1>

<p align="center">
  <em>"Every commit lights up a Christmas tree."</em><br />
  Cada commit ilumina uma árvore de Natal.
</p>

---

**Christmas Commit City** é uma vila natalina interativa em pixel art (inspirada em jogos *cozy* como *Stardew Valley*), onde desenvolvedores cultivam suas próprias árvores de Natal a partir das contribuições no GitHub.

Visitantes podem explorar a cidade vista de cima, conhecer desenvolvedores, enviar presentes para decorar as árvores e participar de uma campanha voluntária via Pix para apoiar uma estudante de Engenharia da Computação da **Universidade Federal do Ceará (UFC)** rumo à formatura.

---

## ✨ Destaques do Projeto

- **Identidade Pixel Art Aconchegante:** cidade *top-down* com céu noturno estrelado, lua crescente, neve caindo, chalés iluminados, lampiões quentes e praça central.
- **Árvores Guiadas por Commits:** 7 estágios configuráveis de crescimento (do pequeno pinheiro com `0` commits à árvore especial com `500+` commits), com novos galhos, bolas, guirlandas, luzes cintilantes, estrela dourada e aura.
- **Integração GitHub (somente leitura):** autenticação OAuth e leitura via GitHub GraphQL API considerando um período justo padronizado (ano corrente), sem pedir acesso de escrita aos repositórios.
- **Presentes & Campanha UFC:** presentes gratuitos e especiais integrados visualmente às árvores (sem alterar a contagem de commits) e árvore especial na praça central dedicada à arrecadação voluntária via Pix.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Motor 2D:** Phaser.js (`pixelArt: true`)
- **Backend & Banco:** Supabase (Auth, PostgreSQL + RLS, Edge Functions)
- **Integrações:** GitHub OAuth, GitHub GraphQL API, Pix (BR Code + QR Code)
- **Hospedagem:** Vercel (Frontend) + Supabase (Banco e Funções)

---

## 📁 Estrutura de Pastas

```text
src/
├── config/       # Paleta, dimensões do mapa, estágios de árvore e campanha UFC
├── types/        # Contratos TypeScript alinhados ao modelo de dados
├── data/         # Dados fictícios iniciais para visualização da cidade
├── game/         # Cena Phaser, gerador pixel art procedural, neve e árvore clicável
├── components/   # HUD natalina e painéis em estilo RPG retrô
└── pages/        # Páginas da aplicação
```

---

## 🚀 Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev
```

Scripts disponíveis:
- `npm run dev` — inicia o servidor Vite local
- `npm run build` — gera build de produção (`tsc -b && vite build`)
- `npm run lint` — executa o ESLint
- `npm run typecheck` — valida a tipagem estrita com TypeScript

---

## 📄 Licença

Distribuído sob a licença [MIT](./LICENSE).
