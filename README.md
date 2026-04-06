# Maju Task Manager

Um gerenciador de tarefas dinâmico e colaborativo, inspirado no Trello, construído com tecnologias modernas.

## 🚀 Tecnologias

- **Frontend**: React + Vite + Tailwind CSS + Shadcn/ui
- **Backend**: tRPC + Node.js (Vercel Serverless Functions)
- **Banco de Dados**: Supabase (PostgreSQL) + Drizzle ORM
- **Realtime**: Supabase Realtime para atualizações instantâneas
- **IA**: Assistente inteligente integrado para sugestões de projetos

## 🔐 Variáveis de ambiente (Vercel / GitHub)
Para o deploy na Vercel funcionar com Supabase, configure as variáveis abaixo no painel da Vercel (Production e Preview).

- No frontend (build-time, Vite):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- No backend (runtime, Vercel Functions):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (usada no servidor para bypass quando necessário)
  - `DATABASE_URL` (Drizzle/Postgres)
  - `JWT_SECRET`
- Opcional (se o app usar recursos de IA/integracoes):
  - `BUILT_IN_FORGE_API_URL`
  - `BUILT_IN_FORGE_API_KEY`
  - `OAUTH_SERVER_URL`
  - `OWNER_OPEN_ID`

> Não comite o arquivo `.env` no GitHub (ele deve ficar como `.env.example`).

## 👨‍💻 Créditos

Este aplicativo foi desenvolvido por **Diogo Martins**.

## 🛠️ Funcionalidades

- Criar e gerenciar quadros (boards) personalizados.
- Listas de tarefas dinâmicas com arraste e solte (Drag and Drop).
- Detalhes de cartões com:
  - Checklists agrupados.
  - Etiquetas coloridas.
  - Comentários em tempo real.
  - Anexos.
  - Campos personalizados.
  - Datas de Início e Entrega.
- Compartilhamento de quadros com outros usuários.
- Assistente DMS Tesk AI para suporte na organização.

---
© 2026 Diogo Martins. Todos os direitos reservados.
