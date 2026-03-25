// client/src/components/AIChatBox.tsx
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Sparkles, Globe, Minimize2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (
    content: string,
    options?: { useWebSearch?: boolean; shortResponse?: boolean }
  ) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
};

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Digite sua mensagem...",
  className,
  height = "600px",
  emptyStateMessage = "Olá! Sou o Maju IA. Como posso ajudar você hoje?",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [shortResponse, setShortResponse] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Auto scroll to bottom
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;

    if (viewport) {
      setTimeout(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput, {
      useWebSearch,
      shortResponse,
    });

    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    onSendMessage(prompt, { useWebSearch, shortResponse });
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-[#1a1a1a] text-white rounded-xl border border-[#333] shadow-xl overflow-hidden",
        className
      )}
      style={{ height }}
    >
      {/* Header com toggles */}
      <div className="flex items-center justify-between border-b border-[#333] px-4 py-3 bg-[#222]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-sm">Maju IA</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Toggle Pesquisar na Web */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <Label htmlFor="web-search" className="text-xs cursor-pointer">
              Web
            </Label>
            <Switch
              id="web-search"
              checked={useWebSearch}
              onCheckedChange={setUseWebSearch}
            />
          </div>

          {/* Toggle Resposta Curta */}
          <div className="flex items-center gap-2">
            <Minimize2 className="w-4 h-4 text-emerald-400" />
            <Label htmlFor="short-response" className="text-xs cursor-pointer">
              Curto
            </Label>
            <Switch
              id="short-response"
              checked={shortResponse}
              onCheckedChange={setShortResponse}
            />
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Sparkles className="w-16 h-16 text-yellow-400/30 mb-6" />
            <p className="text-lg text-gray-400 mb-8">{emptyStateMessage}</p>

            {suggestedPrompts && suggestedPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm bg-[#2a2a2a] hover:bg-[#333] border border-[#444] rounded-full transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-4 space-y-6">
              {displayMessages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex-shrink-0 flex items-center justify-center mt-1">
                      <Sparkles className="w-4 h-4 text-black" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      message.role === "user"
                        ? "bg-yellow-500 text-black"
                        : "bg-[#2a2a2a] text-gray-200"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex-shrink-0 flex items-center justify-center mt-1">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <div className="bg-[#2a2a2a] rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[#333] bg-[#1a1a1a]">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 min-h-[52px] max-h-[160px] resize-y bg-[#222] border-[#444] focus:border-yellow-500 text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-[52px] w-[52px] bg-yellow-500 hover:bg-yellow-600 text-black shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>

        <p className="text-[10px] text-gray-500 mt-2 text-center">
          {useWebSearch && "🔍 Pesquisando na web • "}
          {shortResponse && "📝 Resposta curta ativada"}
        </p>
      </form>
    </div>
  );
}
