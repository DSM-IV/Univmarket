import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPatch, apiPost } from "../api/client";
import { jitterMs } from "../utils/pollWithJitter";
import { Bell, ShoppingBag, MessageSquare, FileText, Check } from "lucide-react";
import type { Notification } from "../types";

interface Props {
  onNavigate?: () => void;
}

export default function NotificationPanel({ onNavigate }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // API에서 알림 조회 (폴링)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    let cancelled = false;

    async function fetchNotifications() {
      try {
        const res = await apiGet<Notification[] | { content?: Notification[] }>("/users/me/notifications?limit=30");
        const items = Array.isArray(res) ? res : (res?.content ?? []);
        if (!cancelled) {
          setNotifications(items);
          setUnreadCount(items.filter((n) => !n.read).length);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    }

    fetchNotifications();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchNotifications();
        if (!cancelled) schedule();
      }, jitterMs(10000));
    };
    schedule();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user]);

  // 외부 클릭 시 패널 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 모두 읽음 처리
  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    await apiPost("/users/me/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // 개별 알림 클릭 → 읽음 처리 + 이동
  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await apiPatch(`/users/me/notifications/${n.id}/read`);
      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    onNavigate?.();
    if (n.materialId) {
      navigate(`/material/${n.materialId}`);
    }
  };

  const typeIcon = (type: Notification["type"]) => {
    switch (type) {
      case "sale":
        return <ShoppingBag className="w-4 h-4 text-green-600 shrink-0" />;
      case "review":
        return <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />;
      case "material_available":
        return <FileText className="w-4 h-4 text-primary shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}일 전`;
    return `${Math.floor(days / 30)}달 전`;
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* 벨 아이콘 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex"
        title="알림"
        aria-label={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "알림"}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold leading-4 text-center text-white bg-red-500 rounded-full" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-sm:w-[calc(100vw-32px)] max-sm:right-[-60px] bg-white rounded-xl shadow-lg border border-border z-[100] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                알림이 없습니다
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0 ${
                    !n.read ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <div className="mt-0.5">{typeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-muted-foreground/70">
                        {timeAgo(n.createdAt)}
                      </span>
                      {n.materialId && (
                        <span className="text-[11px] font-medium text-primary">
                          확인하러 가기 →
                        </span>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
