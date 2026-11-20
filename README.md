# 🎄 Christmas Commit City

> *"Every commit lights up a Christmas tree."*  
> *Cada commit ilumina uma árvore de Natal.*

**Christmas Commit City** é uma vila natalina interativa em pixel art (inspirada em jogos *cozy* como *Stardew Valley*), onde cada pessoa desenvolvedora conectada via GitHub cultiva sua própria árvore de Natal conforme suas contribuições no ano corrente.

Visitantes podem explorar a cidade, conhecer desenvolvedores, enviar presentes visuais para decorar as árvores e apoiar voluntariamente uma campanha via Pix para ajudar uma estudante de Engenharia da Computação da **Universidade Federal do Ceará (UFC)** a concluir a graduação.

---

## ✨ Destaques do Projeto

- **Identidade Pixel Art Aconchegante:** cidade vista de cima (*top-down*) com céu noturno estrelado, lua crescente, neve caindo, chalés iluminados, lampiões quentes e praça central.
- **Progressão de Árvores em 7 Níveis:** do pequeno pinheiro (`0` commits) à árvore especial iluminada com aura e estrela (`500+` commits), com identidade visual única por usuário.
- **GitHub GraphQL (Planejado — Fase 3):** autenticação OAuth somente leitura (`read:user`) e período padronizado (ano corrente) para comparação justa.
- **Presentes & Campanha UFC (Planejado — Fases 6 e 7):** presentes gratuitos e especiais integrados visualmente às árvores (sem alterar commits) e árvore especial na praça central para doações voluntárias via Pix.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Motor 2D:** Phaser.js (`pixelArt: true`)
- **Backend & Banco (Fases 3–7):** Supabase (Auth, PostgreSQL + RLS, Edge Functions)
- **Integrações:** GitHub OAuth, GitHub GraphQL API, Pix (BR Code + QR Code)
- **Hospedagem prevista:** Vercel (Frontend) + Supabase (Banco e Funções)

---

## 📁 Estrutura de Pastas

```text
src/
├── config/       # Paleta, dimensões do mapa, estágios de árvore e campanha UFC
├── types/        # Contratos TypeScript alinhados ao modelo de dados
├── data/         # Dados fictícios iniciais (Fase 1)
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

## 🗺️ Roadmap de Desenvolvimento

- [x] **Etapa 0 & Fase 1:** Setup profissional, identidade visual, vila pixel art, neve, luzes, árvore especial da UFC e 7 estágios visuais com dados fictícios
- [ ] **Fase 2:** Navegação avançada no Phaser, página individual `/tree/:username` e `/rankings`
- [ ] **Fase 3:** GitHub OAuth (somente leitura) + Edge Function com API GraphQL
- [ ] **Fase 4:** Árvores dinâmicas sincronizadas com contribuições reais
- [ ] **Fase 5:** Persistência completa no Supabase PostgreSQL com políticas RLS
- [ ] **Fase 6:** Catálogo de presentes gratuitos/especiais e mensagens de visitantes
- [ ] **Fase 7:** Sistema de doações voluntárias via Pix com QR Code e meta configurável
- [ ] **Fase 8:** Testes, ajustes finais de responsividade e publicação na Vercel

---

## 📄 Licença

Distribuído sob a licença [MIT](./LICENSE).
