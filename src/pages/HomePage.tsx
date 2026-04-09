import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

const universities = [
  {
    id: "korea",
    name: "고려대학교",
    logo: "/logos/korea.png",
    path: "/univ/korea",
    color: "bg-red-50 hover:bg-red-100",
  },
  {
    id: "snu",
    name: "서울대학교",
    logo: "/logos/snu.png",
    path: "/univ/snu",
    color: "bg-blue-50 hover:bg-blue-100",
  },
  {
    id: "yonsei",
    name: "연세대학교",
    logo: "/logos/yonsei.png",
    path: "/univ/yonsei",
    color: "bg-blue-50 hover:bg-blue-100",
  },
  {
    id: "sogang",
    name: "서강대학교",
    logo: "/logos/sogang.png",
    path: "/univ/sogang",
    color: "bg-rose-50 hover:bg-rose-100",
  },
  {
    id: "skku",
    name: "성균관대학교",
    logo: "/logos/skku.png",
    path: "/univ/skku",
    color: "bg-teal-50 hover:bg-teal-100",
  },
  {
    id: "hanyang",
    name: "한양대학교",
    logo: "/logos/hanyang.png",
    path: "/univ/hanyang",
    color: "bg-sky-50 hover:bg-sky-100",
  },
  {
    id: "cau",
    name: "중앙대학교",
    logo: "/logos/cau.png",
    path: "/univ/cau",
    color: "bg-indigo-50 hover:bg-indigo-100",
  },
  {
    id: "khu",
    name: "경희대학교",
    logo: "/logos/khu.png",
    path: "/univ/khu",
    color: "bg-amber-50 hover:bg-amber-100",
  },
  {
    id: "hufs",
    name: "한국외국어대학교",
    logo: "/logos/hufs.png",
    path: "/univ/hufs",
    color: "bg-blue-50 hover:bg-blue-100",
  },
  {
    id: "uos",
    name: "서울시립대학교",
    logo: "/logos/uos.png",
    path: "/univ/uos",
    color: "bg-blue-50 hover:bg-blue-100",
  },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div>
      {/* Hero + Search */}
      <section className="pt-24 pb-20 px-6 text-center max-sm:pt-16 max-sm:pb-14">
        <div className="max-w-[720px] mx-auto">
          <h1 className="text-[52px] font-extrabold leading-[1.25] tracking-[-0.04em] text-foreground mb-5 max-sm:text-[34px]">
            대학생을 위한<br />
            <span className="bg-gradient-to-r from-[#1B3A5C] to-[#2E8BC0] bg-clip-text text-transparent">공부자료 플랫폼</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-sm:text-[15px] max-sm:mb-8">
            고려대학교 학생들을 위한 클로즈드 베타 서비스입니다.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-[580px] mx-auto">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
              <input
                type="text"
                placeholder="전체 대학에서 검색하기"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-16 pl-14 pr-32 rounded-2xl border-2 border-border bg-white text-lg placeholder:text-muted-foreground focus:outline-none focus:border-[#1B3A5C] transition-colors max-sm:h-14 max-sm:text-base max-sm:pr-24"
              />
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl px-6 h-11 bg-gradient-to-r from-[#1B3A5C] to-[#2E8BC0] !text-white font-semibold text-sm hover:opacity-90 transition-opacity max-sm:px-4"
              >
                검색
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* University List */}
      <section className="py-16 bg-muted max-sm:py-12">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-[26px] font-bold tracking-[-0.03em] mb-1.5">
              대학별로 찾아보기
            </h2>
            <p className="text-[15px] text-muted-foreground">
              소속 대학교를 선택하면 해당 학교의 자료를 볼 수 있어요
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
            {universities.filter((univ) => univ.id === "korea").map((univ) => (
              <Link
                to={univ.path}
                key={univ.id}
                className={`flex items-center gap-4 p-5 rounded-2xl border border-border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md ${univ.color}`}
              >
                <img
                  src={univ.logo}
                  alt={univ.name}
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div>
                  <span className="text-[17px] font-bold text-foreground">
                    {univ.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 max-sm:py-16">
        <div className="max-w-[560px] mx-auto text-center px-6">
          <h2 className="text-4xl font-extrabold tracking-[-0.04em] leading-[1.3] mb-4 max-sm:text-[28px]">
            내 공부자료로<br />수익을 만들어 보세요
          </h2>
          <p className="text-base text-muted-foreground mb-9">
            노트, 족보, 레포트 등 어떤 자료든 판매할 수 있어요
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center justify-center h-14 px-10 rounded-xl bg-gradient-to-r from-[#1B3A5C] to-[#2E8BC0] !text-white font-bold text-base hover:opacity-90 transition-opacity"
          >
            지금 시작하기
          </Link>
        </div>
      </section>
    </div>
  );
}
