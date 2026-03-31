import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "pt-BR" | "en";

type TranslationKey =
  | "common.cancel"
  | "common.create"
  | "common.save"
  | "common.saving"
  | "settings.title"
  | "settings.subtitle"
  | "settings.profile"
  | "settings.notifications"
  | "settings.users"
  | "layout.taskManager"
  | "layout.userFallback"
  | "layout.yourBoards"
  | "layout.noBoardsYet"
  | "layout.newBoard"
  | "layout.boardName"
  | "layout.admin"
  | "layout.settings"
  | "layout.logout"
  | "home.loadingSession"
  | "home.authSubtitleSignup"
  | "home.authSubtitleSignin"
  | "home.name"
  | "home.yourName"
  | "home.userEmail"
  | "home.password"
  | "home.signUp"
  | "home.signIn"
  | "home.haveAccount"
  | "home.noAccount"
  | "home.welcome"
  | "home.centerSubtitle"
  | "home.dynamicBoards"
  | "home.dynamicBoardsDesc"
  | "home.checklistsLabels"
  | "home.checklistsLabelsDesc"
  | "home.aiAssistant"
  | "home.aiAssistantDesc"
  | "home.readyToStart"
  | "home.readyToStartDesc"
  | "home.aiTip"
  | "home.aiActive"
  | "board.addAnotherList"
  | "board.createList"
  | "board.addCard"
  | "board.movingCard"
  | "board.renameSuccess"
  | "board.renameError"
  | "board.moveSuccess"
  | "board.moveError"
  | "card.archiveSuccess"
  | "card.archiveError"
  | "card.deleteSuccess"
  | "card.deleteError"
  | "card.mirrorSuccess"
  | "card.mirrorError"
  | "card.mirrorAlreadyExists"
  | "card.quickAction.mirror"
  | "card.quickAction.archive"
  | "card.quickAction.delete";

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  "pt-BR": {
    "common.cancel": "Cancelar",
    "common.create": "Criar",
    "common.save": "Salvar",
    "common.saving": "Salvando...",
    "settings.title": "Configurações",
    "settings.subtitle": "Gerencie seu perfil e preferências",
    "settings.profile": "Perfil",
    "settings.notifications": "Notificações",
    "settings.users": "Usuários",
    "layout.taskManager": "Gerenciador de tarefas",
    "layout.userFallback": "Usuário",
    "layout.yourBoards": "Seus Quadros",
    "layout.noBoardsYet": "Nenhum quadro ainda",
    "layout.newBoard": "Novo Quadro",
    "layout.boardName": "Nome do quadro",
    "layout.admin": "Admin",
    "layout.settings": "Configurações",
    "layout.logout": "Sair",
    "home.loadingSession": "Carregando sessão...",
    "home.authSubtitleSignup": "Crie sua conta",
    "home.authSubtitleSignin": "Entre para gerenciar suas tarefas",
    "home.name": "Nome",
    "home.yourName": "Seu nome",
    "home.userEmail": "Usuário (Email)",
    "home.password": "Senha",
    "home.signUp": "Criar Conta",
    "home.signIn": "Entrar",
    "home.haveAccount": "Já tem uma conta? Entrar",
    "home.noAccount": "Não tem uma conta? Criar",
    "home.welcome": "Bem-vindo",
    "home.centerSubtitle": "Seu centro de produtividade pessoal. Comece a organizar suas tarefas hoje.",
    "home.dynamicBoards": "Quadros Dinâmicos",
    "home.dynamicBoardsDesc": "Crie quadros para diferentes projetos e organize suas tarefas em listas personalizáveis.",
    "home.checklistsLabels": "Checklists & Etiquetas",
    "home.checklistsLabelsDesc": "Adicione detalhes minuciosos aos seus cartões com checklists e etiquetas coloridas para fácil identificação.",
    "home.aiAssistant": "Assistente IA",
    "home.aiAssistantDesc": "Use nossa inteligência artificial integrada para sugerir passos de projeto e organizar seu fluxo de trabalho.",
    "home.readyToStart": "Pronto para começar?",
    "home.readyToStartDesc": "Crie seu primeiro quadro agora e experimente uma nova forma de gerenciar projetos.",
    "home.aiTip": "Dica: Use o botão de chat na visualização do quadro para falar com a Maju AI!",
    "home.aiActive": "Assistente IA Ativo",
    "board.addAnotherList": "Adicionar outra lista",
    "board.createList": "Criar Lista",
    "board.addCard": "Adicionar um cartão",
    "board.movingCard": "Movendo cartão...",
    "board.renameSuccess": "Quadro renomeado",
    "board.renameError": "Erro ao renomear quadro",
    "board.moveSuccess": "Cartão movido",
    "board.moveError": "Erro ao mover cartão",
    "card.archiveSuccess": "Cartão arquivado",
    "card.archiveError": "Erro ao arquivar cartão",
    "card.deleteSuccess": "Cartão excluído",
    "card.deleteError": "Erro ao excluir cartão",
    "card.mirrorSuccess": "Cartão espelhado com sucesso",
    "card.mirrorError": "Erro ao espelhar cartão",
    "card.mirrorAlreadyExists": "Este cartão já está espelhado para o quadro selecionado.",
    "card.quickAction.mirror": "Espelhar Cartão",
    "card.quickAction.archive": "Arquivar Cartão",
    "card.quickAction.delete": "Excluir Permanentemente",
  },
  en: {
    "common.cancel": "Cancel",
    "common.create": "Create",
    "common.save": "Save",
    "common.saving": "Saving...",
    "settings.title": "Settings",
    "settings.subtitle": "Manage your profile and preferences",
    "settings.profile": "Profile",
    "settings.notifications": "Notifications",
    "settings.users": "Users",
    "layout.taskManager": "Task Manager",
    "layout.userFallback": "User",
    "layout.yourBoards": "Your Boards",
    "layout.noBoardsYet": "No boards yet",
    "layout.newBoard": "New Board",
    "layout.boardName": "Board name",
    "layout.admin": "Admin",
    "layout.settings": "Settings",
    "layout.logout": "Logout",
    "home.loadingSession": "Loading session...",
    "home.authSubtitleSignup": "Create your account",
    "home.authSubtitleSignin": "Sign in to manage your tasks",
    "home.name": "Name",
    "home.yourName": "Your name",
    "home.userEmail": "User (Email)",
    "home.password": "Password",
    "home.signUp": "Sign Up",
    "home.signIn": "Sign In",
    "home.haveAccount": "Already have an account? Sign In",
    "home.noAccount": "Don't have an account? Sign Up",
    "home.welcome": "Welcome",
    "home.centerSubtitle": "Your personal productivity hub. Start organizing your tasks today.",
    "home.dynamicBoards": "Dynamic Boards",
    "home.dynamicBoardsDesc": "Create boards for different projects and organize tasks into customizable lists.",
    "home.checklistsLabels": "Checklists & Labels",
    "home.checklistsLabelsDesc": "Add detailed information to cards with checklists and colored labels for easy identification.",
    "home.aiAssistant": "AI Assistant",
    "home.aiAssistantDesc": "Use our integrated AI to suggest project steps and organize your workflow.",
    "home.readyToStart": "Ready to start?",
    "home.readyToStartDesc": "Create your first board now and experience a new way to manage projects.",
    "home.aiTip": "Tip: Use the chat button in board view to talk with Maju AI!",
    "home.aiActive": "AI Assistant Active",
    "board.addAnotherList": "Add another list",
    "board.createList": "Create List",
    "board.addCard": "Add a card",
    "board.movingCard": "Moving card...",
    "board.renameSuccess": "Board renamed",
    "board.renameError": "Error renaming board",
    "board.moveSuccess": "Card moved",
    "board.moveError": "Error moving card",
    "card.archiveSuccess": "Card archived",
    "card.archiveError": "Error archiving card",
    "card.deleteSuccess": "Card deleted",
    "card.deleteError": "Error deleting card",
    "card.mirrorSuccess": "Card mirrored successfully",
    "card.mirrorError": "Error mirroring card",
    "card.mirrorAlreadyExists": "This card is already mirrored to the selected board.",
    "card.quickAction.mirror": "Mirror Card",
    "card.quickAction.archive": "Archive Card",
    "card.quickAction.delete": "Delete Permanently",
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "maju_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "pt-BR" || stored === "en") return stored;
    return "pt-BR";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key) => translations[language][key] ?? key,
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

