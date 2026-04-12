import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import MaterialCard from "../components/MaterialCard";
import { Button } from "@/components/ui/button";
import { categories } from "../data/mockData";
import { fetchReviewStats, type ReviewStats } from "../services/reviewStats";
import { ChevronRight } from "lucide-react";
import type { Material } from "../types";

export default function HanyangPage() {
  const [popularMaterials, setPopularMaterials] = useState<Material[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<Material[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({});
  const [transformed, setTransformed] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); const timer = setTimeout(() => setTransformed(true), 800); return () => clearTimeout(timer); }, []);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const recentQuery = query(collection(db, "materials"), orderBy("createdAt", "desc"), limit(4));
        const popularQuery = query(collection(db, "materials"), orderBy("salesCount", "desc"), limit(4));
        const [recentSnap, popularSnap] = await Promise.all([getDocs(recentQuery), getDocs(popularQuery)]);
        const recentDocs = recentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "" })) as Material[];
        const popularDocs = popularSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "" })) as Material[];
        setRecentMaterials(recentDocs.filter((m) => !(m as any).hidden));
        setPopularMaterials(popularDocs.filter((m) => !(m as any).hidden));
        const allIds = [...new Set([...recentDocs, ...popularDocs].map((d) => d.id))];
        const stats = await fetchReviewStats(allIds);
        setReviewStats(stats);
      } catch (err) {}
    }
    fetchMaterials();
  }, []);

  return (
    <div className="hanyang-theme">
      <section className="pt-24 pb-20 px-6 text-center max-sm:pt-16 max-sm:pb-14">
        <div className="max-w-[640px] mx-auto">
          <h1 className="text-[52px] font-extrabold leading-[1.25] text-foreground mb-3 max-sm:text-[34px]">
            <span className="inline-flex items-baseline">
              <span className="inline-block transition-all duration-700 ease-in-out" style={{ color: "#2E8BC0", transform: transformed ? "translateX(0)" : "translateX(2.5em)" }}>File</span>
              <span className="inline-block transition-all duration-700 ease-in-out" style={{ width: transformed ? "0.3em" : "0" }} />
              <span className="inline-block transition-all duration-700 ease-in-out" style={{ color: "#1B3A5C", transform: transformed ? "translateX(0)" : "translateX(-0.25em)" }}>i</span>
              <span className="inline-block transition-all duration-700 ease-in-out" style={{ color: "#1B3A5C", transform: transformed ? "translateX(0)" : "translateX(-1.15em)" }}>n</span>
              <span className="inline-block transition-all duration-700 ease-in-out" style={{ width: transformed ? "0.3em" : "0" }} />
              <span className="inline-block transition-all duration-700 ease-in-out overflow-hidden" style={{ maxWidth: transformed ? "0.65em" : "0", opacity: transformed ? 1 : 0, color: "#0E4A84" }}>H</span>
              <span className="inline-block transition-all duration-700 ease-in-out overflow-hidden" style={{ maxWidth: transformed ? "0.65em" : "0", opacity: transformed ? 1 : 0, color: "#0E4A84" }}>Y</span>
              <span className="inline-block transition-all duration-700 ease-in-out" style={{ color: transformed ? "#0E4A84" : "#1B3A5C", transform: transformed ? "translateX(0)" : "translateX(-2.5em)" }}>U</span>
            </span>
          </h1>
          <p className="text-[22px] font-bold text-foreground mb-2 max-sm:text-lg transition-all duration-500" style={{ opacity: transformed ? 1 : 0, transform: transformed ? "translateY(0)" : "translateY(8px)" }}>더이상 자료 찾아서 헤메지 마세요.</p>
          <p className="text-lg text-muted-foreground mb-10 max-sm:text-[15px] max-sm:mb-8">한양대 학생들이 만든 양질의 공부자료를 만나보세요.</p>
          <div className="flex gap-3 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button variant="primary" size="lg" asChild><Link to="/browse">자료 둘러보기</Link></Button>
            <Button variant="secondary" size="lg" asChild><Link to="/upload">자료 판매하기</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-16 max-sm:py-12"><div className="max-w-[1140px] mx-auto px-6"><div className="mb-8"><h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">카테고리</h2><p className="text-[15px] text-muted-foreground">원하는 자료를 빠르게 찾아보세요</p></div><div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">{categories.map((cat) => (<Link to={`/browse?category=${encodeURIComponent(cat.name)}`} key={cat.name} className="flex flex-col items-center gap-2.5 py-7 px-4 bg-muted rounded-xl transition-all hover:bg-primary/5 hover:-translate-y-0.5"><span className="text-[32px]">{cat.icon}</span><span className="text-[15px] font-semibold">{cat.name}</span><span className="text-xs text-muted-foreground text-center leading-snug">{cat.examples}</span></Link>))}</div></div></section>

      {popularMaterials.length > 0 && (<section className="py-16 bg-muted max-sm:py-12"><div className="max-w-[1140px] mx-auto px-6"><div className="flex items-end justify-between mb-8"><div><h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">인기 자료</h2><p className="text-[15px] text-muted-foreground">가장 많이 구매된 자료들이에요</p></div><Link to="/browse?sort=popular" className="flex items-center gap-0.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0">전체보기<ChevronRight className="w-4 h-4" /></Link></div><div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">{popularMaterials.map((m) => (<MaterialCard key={m.id} material={m} rating={reviewStats[m.id]?.avgRating} reviewCount={reviewStats[m.id]?.reviewCount} />))}</div></div></section>)}

      {recentMaterials.length > 0 && (<section className="py-16 max-sm:py-12"><div className="max-w-[1140px] mx-auto px-6"><div className="flex items-end justify-between mb-8"><div><h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">최신 자료</h2><p className="text-[15px] text-muted-foreground">방금 올라온 따끈따끈한 자료들</p></div><Link to="/browse?sort=recent" className="flex items-center gap-0.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0">전체보기<ChevronRight className="w-4 h-4" /></Link></div><div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">{recentMaterials.map((m) => (<MaterialCard key={m.id} material={m} rating={reviewStats[m.id]?.avgRating} reviewCount={reviewStats[m.id]?.reviewCount} />))}</div></div></section>)}

      <section className="py-24 bg-muted max-sm:py-16"><div className="max-w-[560px] mx-auto text-center px-6"><h2 className="text-4xl font-extrabold tracking-[-0.04em] leading-[1.3] mb-4 max-sm:text-[28px]">내 공부자료로<br />수익을 만들어 보세요</h2><p className="text-base text-muted-foreground mb-9">노트, 자소서, 레포트 등 어떤 자료든 판매할 수 있어요</p><Button size="xl" asChild><Link to="/upload">지금 시작하기</Link></Button></div></section>
    </div>
  );
}
