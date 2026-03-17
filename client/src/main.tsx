// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '../../shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "@/App";
import { supabase } from "@/lib/supabase";
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
      async headers() {
        try {
          const { data: { session } } = await (supabase.auth as any).getSession();
          if (session?.access_token) {
            return {
              Authorization: `Bearer ${session.access_token}`,
            };
          }
        } catch (e) {
          console.warn("[Auth] Failed to get session:", e);
        }
        return {};
      },
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
          throw new TRPCClientError("Erro no servidor (Backend Offline ou Erro 500). Verifique os logs da Vercel.");
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
