// Exemplo de como ficará o código no seu componente de login
import { useLocation } from "wouter";

// ... dentro do seu componente
const [, setLocation] = useLocation();

const loginMutation = trpc.auth.login.useMutation({
  onSuccess: (data) => {
    // Sucesso! Redirecionar para a página principal
    setLocation("/dashboard"); // ou a rota que você usa para a home
  },
  onError: (error) => {
    // Lógica para mostrar erro
  }
});