// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '../../shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "@/App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;
};

queryClient.getQueryCache().subscribe((event: any) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event: any) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });

        // Se o servidor retornar HTML (começa com <), provavelmente é um erro 500 da Vercel
        // Vamos interceptar para evitar o erro de JSON "Unexpected token A"
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          const text = await response.text();
          console.error("❌ Servidor retornou HTML em vez de JSON. Possível erro 500 ou queda do backend.");
          
          // Se for erro de Rollup missing module, vamos dar uma mensagem mais específica
          if (text.includes("Cannot find module '@rollup/rollup-linux-x64-gnu'")) {
            throw new TRPCClientError("Erro de dependência nativa no servidor: Rollup binário faltando.");
          }
          
          throw new TRPCClientError("Erro no servidor (Backend retornou HTML). Verifique os logs da Vercel.");
        }

        return response;
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
