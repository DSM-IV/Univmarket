import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const STORAGE_KEY = "betaEventPopupHiddenUntil";
const EVENT_LINK = "/events";
const IMAGE_SRC = "/midterm-event.png";

export default function BetaEventPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hiddenUntil = localStorage.getItem(STORAGE_KEY);
    if (hiddenUntil && Number(hiddenUntil) > Date.now()) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  const hideForToday = () => {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    localStorage.setItem(STORAGE_KEY, String(tomorrow.getTime()));
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 pt-20 pb-8 max-sm:pt-14"
      onClick={close}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="aspect-square w-full bg-muted">
          <img
            src={IMAGE_SRC}
            alt="중간고사 이벤트"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>

        <div className="px-6 pt-5 pb-4 text-center">
          <div className="mb-2 inline-block rounded-full bg-[#862633]/10 px-3 py-1 text-xs font-bold tracking-tight text-[#862633]">
            MIDTERM EVENT
          </div>
          <h2 className="mb-2 text-[20px] font-extrabold tracking-[-0.03em] text-foreground">
            중간고사 이벤트 진행 중
          </h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            중간고사 시즌을 맞아 특별 이벤트를 진행 중입니다.
            <br />
            지금 참여하고 특별한 혜택을 받아보세요!
          </p>
        </div>

        <div className="px-6 pb-5">
          <Link
            to={EVENT_LINK}
            onClick={close}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#862633] to-[#A83344] text-[15px] font-bold !text-white transition-opacity hover:opacity-90"
          >
            이벤트 바로가기
          </Link>
        </div>

        <button
          type="button"
          onClick={hideForToday}
          className="block w-full border-t border-border py-3 text-[13px] text-muted-foreground transition hover:bg-muted"
        >
          오늘 하루 보지 않기
        </button>
      </div>
    </div>
  );
}
