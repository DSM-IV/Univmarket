import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AlertOptions {
  title?: string;
  description: string;
  confirmText?: string;
}

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  required?: boolean;
}

interface DialogContextType {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

type AlertItem = { kind: "alert"; opts: AlertOptions; resolve: () => void };
type ConfirmItem = { kind: "confirm"; opts: ConfirmOptions; resolve: (value: boolean) => void };
type PromptItem = { kind: "prompt"; opts: PromptOptions; resolve: (value: string | null) => void };
type DialogItem = AlertItem | ConfirmItem | PromptItem;

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const active = queue[0] ?? null;
  const open = queue.length > 0;

  const advance = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  useEffect(() => {
    if (active?.kind === "prompt") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue(active.opts.defaultValue ?? "");
    }
  }, [active]);

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setQueue((q) => [...q, { kind: "alert", opts, resolve }]);
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((q) => [...q, { kind: "confirm", opts, resolve }]);
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setQueue((q) => [...q, { kind: "prompt", opts, resolve }]);
    });
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (next || !active) return;
    if (active.kind === "confirm") active.resolve(false);
    else if (active.kind === "prompt") active.resolve(null);
    else active.resolve();
    advance();
  };

  const handleConfirm = () => {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(true);
    else if (active.kind === "prompt") active.resolve(inputValue.trim());
    else active.resolve();
    advance();
  };

  const handleCancel = () => {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(false);
    else if (active.kind === "prompt") active.resolve(null);
    advance();
  };

  const isConfirm = active?.kind === "confirm";
  const isPrompt = active?.kind === "prompt";
  const promptOpts = isPrompt ? (active.opts as PromptOptions) : null;
  const confirmDisabled = !!promptOpts?.required && inputValue.trim() === "";
  const title =
    active?.opts.title ??
    (isConfirm ? "확인이 필요합니다" : isPrompt ? "입력이 필요합니다" : "알림");

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {active && (
          <DialogContent showClose={false}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {active.opts.description && (
                <DialogDescription className="whitespace-pre-line">
                  {active.opts.description}
                </DialogDescription>
              )}
            </DialogHeader>
            {isPrompt && (
              <Input
                autoFocus
                value={inputValue}
                placeholder={promptOpts?.placeholder}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !confirmDisabled) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
            )}
            <DialogFooter>
              {(isConfirm || isPrompt) && (
                <Button variant="secondary" onClick={handleCancel}>
                  {(active.opts as ConfirmOptions | PromptOptions).cancelText ?? "취소"}
                </Button>
              )}
              <Button
                variant={
                  (isConfirm || isPrompt) &&
                  (active.opts as ConfirmOptions | PromptOptions).destructive
                    ? "destructive"
                    : "primary"
                }
                disabled={confirmDisabled}
                onClick={handleConfirm}
              >
                {active.opts.confirmText ?? "확인"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}
