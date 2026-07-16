import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface DialogContextType {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

type AlertItem = { kind: "alert"; opts: AlertOptions; resolve: () => void };
type ConfirmItem = { kind: "confirm"; opts: ConfirmOptions; resolve: (value: boolean) => void };
type DialogItem = AlertItem | ConfirmItem;

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogItem[]>([]);
  const active = queue[0] ?? null;
  const open = queue.length > 0;

  const advance = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

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

  const handleOpenChange = (next: boolean) => {
    if (next || !active) return;
    if (active.kind === "confirm") active.resolve(false);
    else active.resolve();
    advance();
  };

  const handleConfirm = () => {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(true);
    else active.resolve();
    advance();
  };

  const handleCancel = () => {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(false);
    advance();
  };

  const isConfirm = active?.kind === "confirm";
  const title =
    active?.opts.title ?? (isConfirm ? "확인이 필요합니다" : "알림");

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {active && (
          <DialogContent showClose={false}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="whitespace-pre-line">
                {active.opts.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {isConfirm && (
                <Button variant="secondary" onClick={handleCancel}>
                  {(active.opts as ConfirmOptions).cancelText ?? "취소"}
                </Button>
              )}
              <Button
                variant={
                  isConfirm && (active.opts as ConfirmOptions).destructive
                    ? "destructive"
                    : "primary"
                }
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
