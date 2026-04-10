import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query, limit, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import MaterialCard from "../components/MaterialCard";
import { Button } from "@/components/ui/button";
// Input removed - using native selects
import { Card, CardContent } from "@/components/ui/card";
import { categories, departments, departmentCourses, courseProfessors } from "../data/mockData";
import { fetchReviewStats, type ReviewStats } from "../services/reviewStats";
import { ChevronRight, Hand, Plus, X, Bell, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Material } from "../types";

interface MaterialRequest {
  id: string;
  userId: string;
  nickname: string;
  subject: string;
  professor: string;
  description: string;
  needCount: number;
  needUsers: string[];
  status: string;
  createdAt: string;
}

export default function KoreaUnivPage() {
  const { user } = useAuth();
  const [popularMaterials, setPopularMaterials] = useState<Material[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<Material[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({});
  const [transformed, setTransformed] = useState(false);

  // 자료 요청 관련
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqDept, setReqDept] = useState("");
  const [reqSubject, setReqSubject] = useState("");
  const [reqProfessor, setReqProfessor] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [needLoading, setNeedLoading] = useState<string | null>(null);
  const [showNeedAlert, setShowNeedAlert] = useState(false);

  const fetchRequests = async () => {
    try {
      const q = query(
        collection(db, "material_requests"),
        where("status", "==", "open"),
        orderBy("needCount", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      setMaterialRequests(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
        })) as MaterialRequest[]
      );
    } catch (err) {
      console.error("자료 요청 목록 조회 실패:", err);
    }
  };

  const handleSubmitRequest = async () => {
    if (!user) return;
    if (!reqSubject.trim()) return;
    setReqLoading(true);
    try {
      // 이미 같은 과목+교수 요청이 있는지 확인
      const existing = materialRequests.find(
        (r) => r.subject === reqSubject.trim() && r.professor === (reqProfessor?.trim() || "")
      );
      if (existing) {
        // 이미 공감했으면 알림만
        if (existing.needUsers.includes(user.uid)) {
          alert("이미 공감한 요청입니다.");
        } else {
          await handleToggleNeed(existing.id);
        }
      } else {
        const fn = httpsCallable(functions, "submitMaterialRequest");
        await fn({ subject: reqSubject, professor: reqProfessor, description: "" });
        fetchRequests();
      }
      setReqDept("");
      setReqSubject("");
      setReqProfessor("");
      setShowRequestForm(false);
    } catch (err) {
      console.error("자료 요청 등록 실패:", err);
      alert("요청 등록에 실패했습니다. 다시 시도해주세요.");
    }
    setReqLoading(false);
  };

  const handleToggleNeed = async (requestId: string) => {
    if (!user) return;
    setNeedLoading(requestId);
    try {
      const fn = httpsCallable<{ requestId: string }, { added: boolean }>(functions, "toggleNeedRequest");
      const { data } = await fn({ requestId });
      // 로컬 상태 업데이트
      setMaterialRequests((prev) =>
        prev.map((r) => {
          if (r.id !== requestId) return r;
          const newNeedUsers = data.added
            ? [...r.needUsers, user.uid]
            : r.needUsers.filter((u) => u !== user.uid);
          return { ...r, needCount: newNeedUsers.length, needUsers: newNeedUsers };
        })
      );
      if (data.added) {
        setShowNeedAlert(true);
        setTimeout(() => setShowNeedAlert(false), 3000);
      }
    } catch {}
    setNeedLoading(null);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => setTransformed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const recentQuery = query(collection(db, "materials"), orderBy("createdAt", "desc"), limit(4));
        const popularQuery = query(collection(db, "materials"), orderBy("salesCount", "desc"), limit(4));

        const [recentSnap, popularSnap] = await Promise.all([
          getDocs(recentQuery),
          getDocs(popularQuery),
        ]);

        const recentDocs = recentSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
        })) as Material[];

        const popularDocs = popularSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
        })) as Material[];

        setRecentMaterials(recentDocs.filter((m) => !(m as any).hidden));
        setPopularMaterials(popularDocs.filter((m) => !(m as any).hidden));

        const allIds = [...new Set([...recentDocs, ...popularDocs].map((d) => d.id))];
        const stats = await fetchReviewStats(allIds);
        setReviewStats(stats);
      } catch (err) {

      }
    }
    fetchMaterials();
  }, []);

  return (
    <div className="korea-univ-theme">
      {/* Hero */}
      <section className="pt-24 pb-20 px-6 text-center max-sm:pt-16 max-sm:pb-14">
        <div className="max-w-[640px] mx-auto">
          {/* UniFile → File in KU 애니메이션 */}
          <h1 className="text-[52px] font-extrabold leading-[1.25] text-foreground mb-3 max-sm:text-[34px]">
            <span className="inline-flex items-baseline">
              {/* File: 블루 유지, 초기엔 오른쪽으로 이동 */}
              <span
                className="inline-block transition-all duration-700 ease-in-out"
                style={{
                  color: "#2E8BC0",
                  transform: transformed ? "translateX(0)" : "translateX(1.8em)",
                }}
              >
                File
              </span>
              {/* 공백1: File | in 사이 */}
              <span
                className="inline-block transition-all duration-700 ease-in-out"
                style={{ width: transformed ? "0.3em" : "0" }}
              />
              {/* i: 초기엔 n 뒤로 이동 (ni 순서) */}
              <span
                className="inline-block transition-all duration-700 ease-in-out"
                style={{
                  color: "#1B3A5C",
                  transform: transformed ? "translateX(0)" : "translateX(-0.25em)",
                }}
              >
                i
              </span>
              {/* n: 초기엔 i 앞으로 이동 (ni 순서) */}
              <span
                className="inline-block transition-all duration-700 ease-in-out"
                style={{
                  color: "#1B3A5C",
                  transform: transformed ? "translateX(0)" : "translateX(-1.15em)",
                }}
              >
                n
              </span>
              {/* 공백2: in | KU 사이 */}
              <span
                className="inline-block transition-all duration-700 ease-in-out"
                style={{ width: transformed ? "0.3em" : "0" }}
              />
              {/* K: 새로 등장 (크림슨) */}
              <span
                className="inline-block transition-all duration-700 ease-in-out overflow-hidden"
                style={{
                  maxWidth: transformed ? "0.65em" : "0",
                  opacity: transformed ? 1 : 0,
                  color: "#862633",
                }}
              >
                K
              </span>
              {/* U: 네이비 → 크림슨, 초기엔 맨 왼쪽으로 이동 */}
              <span
                className="inline-block transition-all duration-700 ease-in-out"
                style={{
                  color: transformed ? "#862633" : "#1B3A5C",
                  transform: transformed ? "translateX(0)" : "translateX(-2.5em)",
                }}
              >
                U
              </span>
            </span>
          </h1>
          <p
            className="text-[22px] font-bold text-foreground mb-2 max-sm:text-lg transition-all duration-500"
            style={{ opacity: transformed ? 1 : 0, transform: transformed ? "translateY(0)" : "translateY(8px)" }}
          >
            더이상 자료 찾아서 헤메지 마세요.
          </p>
          <p className="text-lg text-muted-foreground mb-10 max-sm:text-[15px] max-sm:mb-8">
            고려대 학생들이 만든 양질의 공부자료를 만나보세요.
          </p>
          <div className="flex gap-3 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button variant="primary" size="lg" asChild>
              <Link to="/browse">자료 둘러보기</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link to="/upload">자료 판매하기</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 max-sm:py-12">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">카테고리</h2>
            <p className="text-[15px] text-muted-foreground">원하는 자료를 빠르게 찾아보세요</p>
          </div>
          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
            {categories.map((cat) => (
              <Link
                to={`/browse?category=${encodeURIComponent(cat.name)}`}
                key={cat.name}
                className="flex flex-col items-center gap-2.5 py-7 px-4 bg-muted rounded-xl transition-all hover:bg-primary/5 hover:-translate-y-0.5"
              >
                <span className="text-[32px]">{cat.icon}</span>
                <span className="text-[15px] font-semibold">{cat.name}</span>
                <span className="text-xs text-muted-foreground text-center leading-snug">
                  {cat.examples}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      {popularMaterials.length > 0 && (
        <section className="py-16 bg-muted max-sm:py-12">
          <div className="max-w-[1140px] mx-auto px-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">인기 자료</h2>
                <p className="text-[15px] text-muted-foreground">가장 많이 구매된 자료들이에요</p>
              </div>
              <Link
                to="/browse?sort=popular"
                className="flex items-center gap-0.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                전체보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
              {popularMaterials.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  rating={reviewStats[m.id]?.avgRating}
                  reviewCount={reviewStats[m.id]?.reviewCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent */}
      {recentMaterials.length > 0 && (
        <section className="py-16 max-sm:py-12">
          <div className="max-w-[1140px] mx-auto px-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">최신 자료</h2>
                <p className="text-[15px] text-muted-foreground">방금 올라온 따끈따끈한 자료들</p>
              </div>
              <Link
                to="/browse?sort=recent"
                className="flex items-center gap-0.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                전체보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
              {recentMaterials.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  rating={reviewStats[m.id]?.avgRating}
                  reviewCount={reviewStats[m.id]?.reviewCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 이 자료가 필요해요 */}
      <section className="py-16 bg-muted max-sm:py-12">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5 flex items-center gap-2">
                <Hand className="w-7 h-7 text-[#862633]" />
                이 자료가 필요해요
              </h2>
              <p className="text-[15px] text-muted-foreground">
                필요한 과목 자료를 요청하고, 다른 학생들의 요청에 공감해보세요
              </p>
            </div>
            {user && (
              <Button
                size="sm"
                className="bg-[#862633] hover:bg-[#6e1f2b] text-white shrink-0"
                onClick={() => setShowRequestForm((v) => !v)}
              >
                <Plus className="w-4 h-4 mr-1" />
                요청하기
              </Button>
            )}
          </div>

          {/* 알림 토스트 */}
          {showNeedAlert && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg py-3 px-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <Bell className="w-4 h-4 shrink-0" />
              해당 과목의 자료가 올라오면 알림을 보내드릴게요!
            </div>
          )}

          {/* 요청 작성 폼 */}
          {showRequestForm && (
            <Card className="mb-6 border-[#862633]/20">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold">필요한 과목 선택</h3>
                  <button
                    onClick={() => setShowRequestForm(false)}
                    className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">학과 *</label>
                  <select
                    value={reqDept}
                    onChange={(e) => { setReqDept(e.target.value); setReqSubject(""); setReqProfessor(""); }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-[#862633] transition-colors"
                  >
                    <option value="">학과를 선택하세요</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                {reqDept && departmentCourses[reqDept] && (
                  <div>
                    <label className="block text-sm font-semibold mb-1.5">과목명 *</label>
                    <select
                      value={reqSubject}
                      onChange={(e) => { setReqSubject(e.target.value); setReqProfessor(""); }}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-[#862633] transition-colors"
                    >
                      <option value="">과목을 선택하세요</option>
                      {departmentCourses[reqDept].map((course) => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                  </div>
                )}
                {reqSubject && courseProfessors[reqSubject] && (
                  <div>
                    <label className="block text-sm font-semibold mb-1.5">교수님 (선택)</label>
                    <select
                      value={reqProfessor}
                      onChange={(e) => setReqProfessor(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-[#862633] transition-colors"
                    >
                      <option value="">전체 (교수 무관)</option>
                      {courseProfessors[reqSubject].map((prof) => (
                        <option key={prof} value={prof}>{prof}</option>
                      ))}
                    </select>
                  </div>
                )}
                {reqSubject && (() => {
                  const existing = materialRequests.find(
                    (r) => r.subject === reqSubject && r.professor === (reqProfessor || "")
                  );
                  if (existing) {
                    const alreadyNeed = user && existing.needUsers.includes(user.uid);
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        이미 <strong>{existing.needCount}명</strong>이 요청한 과목입니다.
                        {alreadyNeed ? " (이미 공감함)" : " 아래 버튼을 눌러 공감해주세요!"}
                      </div>
                    );
                  }
                  return null;
                })()}
                <Button
                  className="w-full bg-[#862633] hover:bg-[#6e1f2b] text-white"
                  onClick={handleSubmitRequest}
                  disabled={reqLoading || !reqSubject.trim()}
                >
                  {reqLoading ? "처리 중..." : (() => {
                    const existing = materialRequests.find(
                      (r) => r.subject === reqSubject && r.professor === (reqProfessor || "")
                    );
                    if (existing && user && existing.needUsers.includes(user.uid)) return "이미 공감함";
                    if (existing) return "저도 필요해요 +1";
                    return "요청 등록";
                  })()}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 요청 목록 */}
          {materialRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquarePlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">아직 요청이 없어요. 첫 번째 요청을 남겨보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              {materialRequests.map((req) => (
                <Card key={req.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-bold text-foreground truncate">{req.subject}</h4>
                        {req.professor && (
                          <p className="text-xs text-muted-foreground mt-0.5">{req.professor} 교수님</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{req.nickname}</span>
                    </div>
                    {req.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                        {req.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <button
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none",
                          user && req.needUsers.includes(user.uid)
                            ? "bg-[#862633] text-white"
                            : "bg-[#862633]/5 text-[#862633] hover:bg-[#862633]/10"
                        )}
                        onClick={() => handleToggleNeed(req.id)}
                        disabled={!user || needLoading === req.id}
                      >
                        <Hand className="w-4 h-4" />
                        저도 필요해요
                        <span className="ml-0.5 font-bold">{req.needCount}</span>
                      </button>
                      {!user && (
                        <Link to="/login" className="text-xs text-muted-foreground hover:text-[#862633]">
                          로그인하고 공감하기
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white max-sm:py-16">
        <div className="max-w-[560px] mx-auto text-center px-6">
          <h2 className="text-4xl font-extrabold tracking-[-0.04em] leading-[1.3] mb-4 max-sm:text-[28px]">
            내 공부자료로<br />수익을 만들어 보세요
          </h2>
          <p className="text-base text-muted-foreground mb-9">
            노트, 족보, 레포트 등 어떤 자료든 판매할 수 있어요
          </p>
          <Button size="xl" asChild>
            <Link to="/upload">지금 시작하기</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
