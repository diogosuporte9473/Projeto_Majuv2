# Maju Task Manager - TODO

## Fase 1: Estrutura Base
- [x] Schema do banco de dados (usuários, quadros, listas, cartões, permissões, espelhamentos)
- [x] Migrations e seed inicial
- [x] Procedures de autenticação e controle de acesso

## Fase 2: Autenticação e Permissões
- [x] Implementar roles (admin/user) no banco de dados
- [x] Criar procedures de controle de acesso por quadro
- [x] Implementar adminProcedure para operações administrativas
- [ ] Testes de autenticação e permissões

## Fase 3: Dashboard e Layout
- [x] Criar DashboardLayout com sidebar inspirado no Maju Personalizados
- [x] Implementar navegação principal
- [x] Aplicar cores (roxo #4b4897, verde limão #c1d82f)
- [x] Criar página de Home/Dashboard

## Fase 4: Quadros, Listas e Cartões
- [x] CRUD de quadros (criar, editar, deletar)
- [x] CRUD de listas dentro de quadros
- [x] CRUD de cartões com título, descrição, data de vencimento, responsável
- [ ] Implementar drag-and-drop para reorganizar listas e cartões
- [ ] Testes unitários para CRUD operations

## Fase 5: Sistema de Permissões
- [x] Criar tabela de permissões por quadro
- [x] Implementar controle de acesso por quadro
- [ ] Painel administrativo para gerenciar permissões
- [ ] Visualização de usuários com acesso a cada quadro

## Fase 6: Espelhamento de Cartões
- [x] Criar tabela de espelhamentos de cartões
- [ ] Implementar funcionalidade de espelhar cartão entre quadros
- [ ] Sincronização de atualizações entre cartões espelhados
- [ ] Visualização de cartões espelhados com indicador de origem

## Fase 7: Notificações
- [x] Implementar sistema de notificações em tempo real
- [ ] Notificações para mudanças em cartões espelhados
- [ ] Notificações para atribuição de tarefas
- [ ] Notificações para prazos próximos
- [ ] Painel de notificações do usuário

## Fase 8: Email e Alertas
- [x] Configurar envio de emails automáticos
- [ ] Email quando cartão espelhado é atualizado
- [ ] Email quando tarefa é atribuída
- [ ] Email de alerta para prazos próximos
- [ ] Sistema de preferências de notificação por email

## Fase 9: Upload de Arquivos
- [x] Implementar upload de arquivos para S3
- [x] Armazenar referências de arquivos no banco de dados
- [x] Suporte para imagens, documentos, PDFs
- [ ] Visualização de arquivos anexados
- [ ] Deletar arquivos quando cartão é removido

## Fase 10: UI/UX e Design
- [x] Aplicar design visual do Maju Personalizados
- [x] Cards com bordas arredondadas
- [x] Botões em verde limão com hover effects
- [x] Responsividade mobile
- [x] Temas e consistência visual

## Fase 11: Testes
- [ ] Testes unitários para procedures
- [ ] Testes de permissões e controle de acesso
- [ ] Testes de drag-and-drop
- [ ] Testes de espelhamento de cartões

## Fase 12: Deploy
- [ ] Configurar GitHub repository
- [ ] Configurar Vercel deployment
- [ ] Variáveis de ambiente
- [ ] Documentação de setup

## Fase 13: Página de Apresentação
- [ ] Criar página web estática com visualizações interativas
- [ ] Gráficos de estatísticas (tarefas por status, por usuário, etc)
- [ ] Demonstração de funcionalidades
- [ ] Benefícios: explorar dados intuitivamente, compreender tendências, salvar/compartilhar

## Fase 14: Entrega
- [ ] Checkpoint final
- [ ] Documentação completa
- [ ] Entrega ao usuário

## Fase 15: Drag-and-Drop de Cartões
- [x] Instalar @dnd-kit e dependências
- [x] Criar procedures para atualizar posição de cartões
- [x] Implementar drag-and-drop no componente ListColumn
- [x] Testar reorganização entre listas
- [x] Validar sincronização com banco de dados

## Fase 16: Página de Configurações do Usuário
- [x] Criar procedures para atualizar perfil e preferências
- [x] Desenvolver página Settings com abas
- [x] Implementar formulário de edição de perfil
- [x] Implementar gerenciamento de preferências de notificações
- [x] Testar e validar funcionalidades

## Fase 17: Campos Customizados, Etiquetas e Checklist
- [x] Atualizar schema para suportar etiquetas, checklist e campos personalizados
- [x] Criar procedures tRPC para gerenciar etiquetas e checklist
- [x] Desenvolver modal de detalhes do cartão
- [x] Implementar interface para adicionar etiquetas
- [x] Implementar interface para adicionar checklist
- [x] Adicionar data do projeto ao cartão
- [x] Testar e validar funcionalidades

## Fase 18: Corrigir Modal e Implementar Gestão de Acesso
- [x] Debugar e corrigir abertura do modal de cartões
- [x] Criar procedures tRPC para gerenciar usuários
- [x] Criar procedures tRPC para gerenciar permissões por quadro
- [x] Desenvolver página de gestão de acesso (Admin)
- [x] Implementar interface para adicionar usuários
- [x] Implementar interface para gerenciar permissões
- [x] Testar e validar funcionalidades

## Fase 19: Corrigir Abertura de Cartões
- [x] Debugar erro de abertura do modal
- [x] Corrigir componente DraggableCard ou CardDetailModal
- [x] Testar abertura do modal
- [x] Validar funcionalidades do modal


## Fase 20: Migração para Supabase
- [x] Configurar Supabase e obter credenciais
- [x] Atualizar variáveis de ambiente para Supabase
- [x] Testar conexão com Supabase localmente
- [ ] Fazer push para GitHub
- [ ] Configurar deploy no Vercel com Supabase
- [ ] Validar deploy em produção
