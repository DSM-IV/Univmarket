import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";

type EventStatus = "ongoing" | "upcoming" | "ended";

type EventItem = {
  id: string;
  title: string;
  description: string;
  period: string;
  status: EventStatus;
  image?: string;
  link?: string;
};

const events: EventItem[] = [
  {
    id: "midterm-event",
    title: "중간고사 이벤트",
    description:
      "중간고사 시즌을 맞아 진행하는 특별 이벤트입니다. 지금 참여하고 특별한 혜택을 받아보세요!",
    period: "2026.04.10 ~ 별도 공지 시까지",
    status: "ongoing",
    image: "/event-popup.png",
    link: "/events/closed-beta-raffle",
  },
];

const statusStyle: Record<EventStatus, { label: string; className: string }> = {
  ongoing: {
    label: "진행중",
    className: "bg-[#862633] text-white",
  },
  upcoming: {
    label: "예정",
    className: "bg-amber-500 text-white",
  },
  ended: {
    label: "종료",
    className: "bg-gray-400 text-white",
  },
};

export default function EventsPage() {
  return (
    <div className="min-h-[70vh] bg-muted/30">
      <div className="mx-auto max-w-[960px] px-6 py-14 max-sm:py-10">
        {/* Header */}
        <header className="mb-10 max-sm:mb-7">
          <h1 className="mb-2 text-[34px] font-extrabold tracking-[-0.04em] text-foreground max-sm:text-[26px]">
            이벤트
          </h1>
          <p className="text-[15px] text-muted-foreground">
            진행 중인 이벤트와 지난 이벤트를 확인해 보세요
          </p>
        </header>

        {/* Event List */}
        {events.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white py-20 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-[15px] text-muted-foreground">
              현재 진행 중인 이벤트가 없습니다
            </p>
          </div>
        ) : (
          <ul className="space-y-5">
            {events.map((event) => {
              const status = statusStyle[event.status];
              const card = (
                <article className="group flex overflow-hidden rounded-2xl border border-border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md max-sm:flex-col">
                  <div className="aspect-[4/3] w-[280px] shrink-0 bg-muted max-sm:w-full">
                    {event.image ? (
                      <img
                        src={event.image}
                        alt={event.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-center px-6 py-5">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {event.period}
                      </span>
                    </div>
                    <h2 className="mb-1.5 text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      {event.title}
                    </h2>
                    <p className="line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                </article>
              );

              return (
                <li key={event.id}>
                  {event.link ? (
                    <Link to={event.link} className="block">
                      {card}
                    </Link>
                  ) : (
                    card
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
