import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";

type NoticeCategory = "general" | "update" | "service";

type NoticeItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: NoticeCategory;
  link?: string;
};

const notices: NoticeItem[] = [];

const categoryStyle: Record<NoticeCategory, { label: string; className: string }> = {
  general: {
    label: "일반",
    className: "bg-gray-500 text-white",
  },
  update: {
    label: "업데이트",
    className: "bg-[#862633] text-white",
  },
  service: {
    label: "서비스",
    className: "bg-blue-500 text-white",
  },
};

export default function NoticesPage() {
  return (
    <div className="min-h-[70vh] bg-muted/30">
      <div className="mx-auto max-w-[960px] px-6 py-14 max-sm:py-10">
        <header className="mb-10 max-sm:mb-7">
          <h1 className="mb-2 text-[34px] font-extrabold tracking-[-0.04em] text-foreground max-sm:text-[26px]">
            공지사항
          </h1>
          <p className="text-[15px] text-muted-foreground">
            서비스 운영 관련 공지를 확인해 보세요
          </p>
        </header>

        {notices.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white py-20 text-center">
            <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-[15px] text-muted-foreground">
              등록된 공지사항이 없습니다
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
            {notices.map((notice) => {
              const cat = categoryStyle[notice.category];
              const row = (
                <article className="flex items-start gap-4 px-6 py-5 transition-colors hover:bg-muted/40">
                  <span
                    className={`mt-0.5 inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${cat.className}`}
                  >
                    {cat.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                      {notice.title}
                    </h2>
                    <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                      {notice.description}
                    </p>
                  </div>
                  <span className="shrink-0 self-center text-[12px] text-muted-foreground max-sm:hidden">
                    {notice.date}
                  </span>
                </article>
              );

              return (
                <li key={notice.id}>
                  {notice.link ? (
                    <Link to={notice.link} className="block">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
