"use client";

import { FormEvent, useState } from "react";
import { Bot, CheckCircle2, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { assistant } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChatSuggestion } from "@/lib/types";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  intent?: string;
  actionTaken?: boolean;
  suggestions?: ChatSuggestion[];
};

const STARTERS: ChatSuggestion[] = [
  { label: "Stats", message: "Show my Q1 performance stats" },
  { label: "Create", message: "Help me create a goal" },
  { label: "Deadline", message: "What are the policy deadlines?" },
];

export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Tell me what you want to do with your goals. I can create goals, log check-ins, show stats, or explain deadlines.",
      suggestions: STARTERS,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (value = input) => {
    const text = value.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text }]);
    setSending(true);
    try {
      const response = await assistant.chat(text);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.reply,
          intent: response.intent,
          actionTaken: response.action_taken,
          suggestions: response.suggestions,
        },
      ]);
      if (response.action_taken) toast.success("Assistant updated your goal workspace");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assistant could not respond";
      toast.error(message);
      setMessages((current) => [...current, { role: "assistant", text: message }]);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section className="w-[min(calc(100vw-2.5rem),420px)] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <header className="flex items-center justify-between border-b border-border bg-foreground px-4 py-3 text-background">
            <div className="flex items-center gap-2">
              <Bot className="size-4" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold">Goal Assistant</h2>
                <p className="text-[10px] uppercase tracking-wider text-background/70">
                  Natural language actions
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-8 place-items-center rounded-md text-background/80 hover:bg-background/10 hover:text-background"
              aria-label="Close assistant"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div className="max-h-[440px] space-y-3 overflow-y-auto bg-muted/20 p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="space-y-2">
                <div
                  className={cn(
                    "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "border border-border bg-background",
                  )}
                >
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.actionTaken && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Action completed
                    </div>
                  )}
                </div>
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={`${index}-${suggestion.label}`}
                        type="button"
                        onClick={() => void submit(suggestion.message)}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-border bg-background p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask or act on goals..."
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="grid size-10 place-items-center rounded-md bg-foreground text-background disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-bold text-background shadow-xl hover:translate-y-[-1px]"
        aria-label="Open goal assistant"
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        Assistant
      </button>
    </div>
  );
}
