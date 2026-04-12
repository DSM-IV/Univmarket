import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ArrowLeft, Coins, Gift, CheckCircle } from "lucide-react";
import { db, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

type RaffleProduct = {
  id: string;
  name: string;
  subtitle: string;
  image: string;
};

const POINTS_PER_TICKET = 100;

const products: RaffleProduct[] = [
  {
    id: "ipad-air-4",
    name: "iPad Air 5세대 (11형)",
    subtitle: "Apple iPad Air 5th Generation 11-inch",
    image: "/products/ipad-air-4.png",
  },
];

type EntryMap = Record<string, number>;

export default function EventRafflePage() {
  const { user, userProfile } = useAuth();
  const [entries, setEntries] = useState<EntryMap>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setEntries({});
      return;
    }
    const q = query(
      collection(db, "raffle_entries"),
      where("uid", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const next: EntryMap = {};
      snap.forEach((d) => {
        const data = d.data() as { productId: string; count: number };
        if (data.productId) next[data.productId] = Number(data.count || 0);
      });
      setEntries(next);
    });
    return unsub;
  }, [user]);

  const points = Number(userProfile?.points || 0);

  const handleEnter = async (product: RaffleProduct) => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (points < POINTS_PER_TICKET) {
      alert(`포인트가 부족합니다. (필요: ${POINTS_PER_TICKET.toLocaleString()}P)`);
      return;
    }
    const confirmed = window.confirm(
      `${product.name}에 응모하시겠습니까?\n${POINTS_PER_TICKET.toLocaleString()}P가 차감됩니다. (1인 1회)`
    );
    if (!confirmed) return;

    try {
      setSubmitting(product.id);
      const call = httpsCallable(functions, "enterRaffle");
      await call({ productId: product.id, quantity: 1 });
      alert("응모가 완료되었습니다!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "응모에 실패했습니다.";
      alert(message);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-[70vh] bg-muted/30">
      <div className="mx-auto max-w-[960px] px-6 py-12 max-sm:py-8">
        {/* Back link */}
        <Link
          to="/events"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          이벤트 목록으로
        </Link>

        {/* Header */}
        <header className="mb-8">
          <div className="mb-3 inline-block rounded-full bg-[#862633]/10 px-3 py-1 text-[11px] font-bold tracking-tight text-[#862633]">
            CLOSED BETA 이벤트
          </div>
          <h1 className="mb-3 text-[32px] font-extrabold tracking-[-0.04em] text-foreground max-sm:text-[24px]">
            포인트로 응모하고 상품 받아가세요
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground max-sm:text-[14px]">
            클로즈드 베타 기간 동안 쌓은 포인트는 아래 상품 응모권으로 교환할 수 있어요.
            <br />
            사용하지 않은 포인트는 정식 서비스 출시 후 현금으로 전환하실 수 있습니다.
          </p>
        </header>

        {/* Notice */}
        <div className="mb-8 rounded-2xl border border-border bg-white p-5 text-[13px] leading-relaxed text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              응모 비용: <strong className="text-foreground">{POINTS_PER_TICKET.toLocaleString()}P</strong> (1인 1회)
            </li>
            <li>추첨은 베타 종료 후 진행되며, 당첨자는 개별 안내됩니다.</li>
            <li>응모에 사용하지 않은 포인트는 정식 서비스 출시 후 현금으로 전환 가능합니다.</li>
          </ul>
        </div>

        {/* User Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              보유 포인트
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em] text-foreground">
              {points.toLocaleString()}P
            </div>
          </div>
          <div className="rounded-2xl border border-[#862633]/30 bg-[#862633]/5 p-5">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[#862633]">
              <Gift className="h-3.5 w-3.5" />
              응모 상태
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em] text-[#862633]">
              {Object.keys(entries).length > 0 ? "응모 완료" : "미응모"}
            </div>
          </div>
        </div>

        {/* Products */}
        <section>
          <h2 className="mb-4 text-[18px] font-bold tracking-[-0.02em] text-foreground">
            응모 상품
          </h2>
          <div className="flex justify-center">
            {products.map((product) => {
              const alreadyEntered = (entries[product.id] || 0) > 0;
              const isSubmitting = submitting === product.id;
              const canSubmit = !!user && points >= POINTS_PER_TICKET && !isSubmitting && !alreadyEntered;

              return (
                <article
                  key={product.id}
                  className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-white"
                >
                  <div className="aspect-square w-full bg-muted">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col px-5 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {product.subtitle}
                    </p>
                    <h3 className="mt-0.5 text-[17px] font-bold tracking-[-0.02em] text-foreground">
                      {product.name}
                    </h3>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-[13px]">
                      <span className="text-muted-foreground">응모 비용</span>
                      <span className="font-bold text-foreground">
                        {POINTS_PER_TICKET.toLocaleString()}P
                      </span>
                    </div>

                    {alreadyEntered ? (
                      <div className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-50 border border-green-200 text-[14px] font-bold text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        응모 완료
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEnter(product)}
                        disabled={!canSubmit}
                        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#862633] to-[#A83344] text-[14px] font-bold !text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSubmitting
                          ? "응모 중..."
                          : !user
                          ? "로그인 후 응모 가능"
                          : points < POINTS_PER_TICKET
                          ? "포인트 부족"
                          : `응모하기 (${POINTS_PER_TICKET.toLocaleString()}P)`}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
