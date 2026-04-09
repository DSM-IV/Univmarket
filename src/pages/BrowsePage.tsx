import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import MaterialCard from "../components/MaterialCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categories, departments, convergenceMajors, exchangeCountries, departmentCourses, coursesByIsuCategory, courseProfessors, courseSemesters, courseProfessorsBySemester } from "../data/mockData";
import { fetchReviewStats, type ReviewStats } from "../services/reviewStats";
import { BookOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Material, Category } from "../types";

const ITEMS_PER_PAGE = 12;

export default function BrowsePage() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") as Category | null;
  const initialQuery = searchParams.get("q") || "";
  const initialSort = searchParams.get("sort") || "popular";

  const [selectedCategory, setSelectedCategory] = useState<Category | "전체">(
    initialCategory || "전체"
  );
  const initialDept = searchParams.get("department") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedIsuType, setSelectedIsuType] = useState(""); // 전공, 학문의기초, 교양, 교직
  const [selectedSubType, setSelectedSubType] = useState(""); // 이중전공, 전과
  const [selectedDepartment, setSelectedDepartment] = useState(initialDept);
  const [selectedSubCategory, setSelectedSubCategory] = useState(""); // 학문의기초/교양/교직 하위분류
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedProfessor, setSelectedProfessor] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [sortBy, setSortBy] = useState(initialSort);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const showIsuFilter = selectedCategory === "수업";
  const showSubTypeFilter = selectedCategory === "이중전공 & 전과";
  const showDepartmentFilter =
    (selectedCategory === "수업" && selectedIsuType === "전공") ||
    (selectedCategory === "이중전공 & 전과" && selectedSubType) ||
    selectedCategory === "교환학생";
  const showSubCategoryFilter =
    selectedCategory === "수업" &&
    (selectedIsuType === "학문의기초" || selectedIsuType === "교양" || selectedIsuType === "교직");
  const showCourseFilter =
    selectedCategory === "수업" &&
    ((selectedIsuType === "전공" && selectedDepartment && departmentCourses[selectedDepartment]) ||
     (showSubCategoryFilter && selectedSubCategory && coursesByIsuCategory[selectedIsuType]?.[selectedSubCategory]));
  const professorOptions = useMemo(() => {
    if (!selectedCourse) return [];
    if (selectedSemester && courseProfessorsBySemester[selectedSemester]?.[selectedCourse]) {
      return courseProfessorsBySemester[selectedSemester][selectedCourse];
    }
    return courseProfessors[selectedCourse] || [];
  }, [selectedCourse, selectedSemester]);
  const showProfessorFilter = showCourseFilter && selectedCourse && professorOptions.length > 0;

  const courseOptions = useMemo(() => {
    let courses: string[] = [];
    if (selectedIsuType === "전공" && selectedDepartment) {
      courses = departmentCourses[selectedDepartment] || [];
    } else if (showSubCategoryFilter && selectedSubCategory) {
      courses = coursesByIsuCategory[selectedIsuType]?.[selectedSubCategory] || [];
    }
    if (selectedSemester && courses.length > 0) {
      courses = courses.filter((c) => !courseSemesters[c] || courseSemesters[c].includes(selectedSemester));
    }
    return courses;
  }, [selectedIsuType, selectedDepartment, selectedSubCategory, selectedSemester, showSubCategoryFilter]);

  useEffect(() => {
    setSelectedIsuType("");
    setSelectedSubType("");
    setSelectedDepartment("");
    setSelectedSubCategory("");
    setSelectedCourse("");
  }, [selectedCategory]);

  useEffect(() => {
    setSelectedDepartment("");
    setSelectedSubCategory("");
    setSelectedCourse("");
  }, [selectedIsuType]);

  useEffect(() => {
    setSelectedDepartment("");
  }, [selectedSubType]);

  useEffect(() => {
    setSelectedCourse("");
    setSelectedProfessor("");
  }, [selectedDepartment, selectedSubCategory, selectedSemester]);

  useEffect(() => {
    setSelectedProfessor("");
  }, [selectedCourse]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedIsuType, selectedDepartment, selectedSubCategory, selectedCourse, selectedProfessor, selectedSemester, searchQuery, sortBy]);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const q = query(collection(db, "materials"), orderBy("createdAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
        })) as Material[];
        setMaterials(docs);

        const stats = await fetchReviewStats(docs.map((d) => d.id));
        setReviewStats(stats);
      } catch (err) {

      } finally {
        setLoading(false);
      }
    }
    fetchMaterials();
  }, []);

  const filtered = useMemo(() => {
    let result = materials.filter((m) => !(m as any).hidden && (m as any).scanStatus !== "infected" && (m as any).scanStatus !== "scanning");

    if (selectedCategory !== "전체") {
      result = result.filter((m) => m.category === selectedCategory);
    }

    if (selectedDepartment) {
      result = result.filter((m) => m.department === selectedDepartment);
    }

    if (selectedCourse) {
      result = result.filter((m) => m.subject === selectedCourse);
    }

    if (selectedProfessor) {
      result = result.filter((m) => (m.professor || "") === selectedProfessor);
    }

    if (selectedSemester) {
      result = result.filter((m) => (m as any).semester === selectedSemester);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          (m.professor || "").toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }

    if (sortBy === "popular") {
      result.sort((a, b) => b.salesCount - a.salesCount);
    } else if (sortBy === "recent") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => {
        const ra = reviewStats[a.id]?.avgRating || 0;
        const rb = reviewStats[b.id]?.avgRating || 0;
        return rb - ra;
      });
    }

    return result;
  }, [materials, reviewStats, selectedCategory, selectedDepartment, selectedCourse, selectedProfessor, selectedSemester, searchQuery, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pt-10 pb-20 min-h-[60vh] max-sm:pt-6 max-sm:pb-14">
      <div className="max-w-[1140px] mx-auto px-6 max-sm:px-4">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] mb-7">
          자료 찾기
        </h1>

        {/* Filters */}
        <div className="flex flex-col gap-3.5 mb-7">
          <Input
            type="text"
            placeholder="과목명, 교수명, 키워드로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 rounded-lg text-[15px]"
          />

          <div className="flex flex-wrap gap-2">
            <button
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                selectedCategory === "전체"
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={() => setSelectedCategory("전체")}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  selectedCategory === cat.name
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* 이수구분 선택 (수업 카테고리일 때) */}
            {showIsuFilter && (
              <select
                value={selectedIsuType}
                onChange={(e) => setSelectedIsuType(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground max-w-[200px] outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">이수구분 선택</option>
                <option value="전공">전공</option>
                <option value="학문의기초">학문의기초</option>
                <option value="교양">교양</option>
                <option value="교직">교직</option>
              </select>
            )}

            {/* 이중전공/전과 → 유형 선택 */}
            {showSubTypeFilter && (
              <div className="flex gap-1.5">
                {["이중전공", "전과"].map((type) => (
                  <button
                    key={type}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                      selectedSubType === type
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    )}
                    onClick={() => setSelectedSubType(selectedSubType === type ? "" : type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}

            {/* 전공 → 학과 선택 */}
            {showDepartmentFilter && (
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground max-w-[200px] outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {selectedCategory === "교환학생" ? (
                  <>
                    <option value="">전체 국가</option>
                    {Object.entries(exchangeCountries).map(([region, countries]) => (
                      <optgroup key={region} label={region}>
                        {countries.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="">전체 학과</option>
                    <optgroup label="학과">
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </optgroup>
                    {selectedCategory === "이중전공 & 전과" && (
                      <optgroup label="융합전공">
                        {convergenceMajors.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
            )}

            {/* 학문의기초/교양/교직 → 하위분류 선택 */}
            {showSubCategoryFilter && (
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground max-w-[200px] outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">전체 분류</option>
                {Object.keys(coursesByIsuCategory[selectedIsuType] || {}).sort().map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            )}

            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">전체 학기</option>
              {Array.from({ length: 6 }, (_, i) => 2025 - i).map((year) => (
                <optgroup key={year} label={`${year}학년도`}>
                  <option value={`${year}-1`}>{year}학년도 1학기</option>
                  <option value={`${year}-2`}>{year}학년도 2학기</option>
                </optgroup>
              ))}
            </select>

            {/* 과목 선택 */}
            {showCourseFilter && (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground max-w-[200px] outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">전체 과목</option>
                {courseOptions.map((course) => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            )}

            {/* 교수 선택 */}
            {showProfessorFilter && (
              <select
                value={selectedProfessor}
                onChange={(e) => setSelectedProfessor(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground max-w-[200px] outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">전체 교수</option>
                {professorOptions.map((prof) => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-white text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="popular">인기순</option>
              <option value="recent">최신순</option>
              <option value="rating">평점순</option>
              <option value="price-low">가격 낮은순</option>
              <option value="price-high">가격 높은순</option>
            </select>
          </div>
        </div>

        {/* Scholarship Banner */}
        {selectedCategory === "장학금" && (
          <a
            href="https://www.notion.so/KU-1f8b3a03eb5080b28009e2a9b46c5be4"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-5 mb-7 bg-gradient-to-r from-primary to-primary-light rounded-xl text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(134,38,51,0.3)]"
          >
            <div className="shrink-0 w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <strong className="text-[15px] font-bold text-white">KU 장학금 정보 모음</strong>
              <span className="text-[13px] text-white/85">고려대학교 장학금 종류, 지원 자격, 신청 방법을 한눈에 확인하세요</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 shrink-0" />
          </a>
        )}

        {/* Results */}
        {loading ? (
          <p className="text-sm text-muted-foreground font-medium mb-5">불러오는 중...</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-medium mb-5">
              {filtered.length}개의 자료
            </p>
            {filtered.length > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
                  {paginatedItems.map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      rating={reviewStats[m.id]?.avgRating}
                      reviewCount={reviewStats[m.id]?.reviewCount}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="flex justify-center items-center gap-1.5 mt-10">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      이전
                    </Button>
                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-sm text-muted-foreground">
                          ...
                        </span>
                      ) : (
                        <button
                          key={page}
                          className={cn(
                            "min-w-9 h-9 px-2.5 rounded-lg text-sm font-medium transition-colors",
                            currentPage === page
                              ? "bg-primary text-white"
                              : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      )
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      다음
                    </Button>
                  </nav>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-[15px]">검색 결과가 없습니다.</p>
                <p className="text-[15px]">다른 키워드로 검색해 보세요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
