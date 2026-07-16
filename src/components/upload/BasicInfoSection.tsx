import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { visibleCategories as categories, departments, regularDepartments, doubleMajorDepartments, transferDepartmentsByCollege, convergenceMajors, exchangeCountries, departmentCourses, coursesByIsuCategory, courseProfessors, courseSemesters, courseProfessorsBySemester } from "../../data/mockData";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, Lightbulb } from "lucide-react";
import type { UploadFormData } from "./utils";

interface Props {
  formData: UploadFormData;
  setFormData: Dispatch<SetStateAction<UploadFormData>>;
  prefilledFromRequest: boolean;
  isuType: string;
  setIsuType: Dispatch<SetStateAction<string>>;
  customSubject: boolean;
  setCustomSubject: Dispatch<SetStateAction<boolean>>;
  customProfessor: boolean;
  setCustomProfessor: Dispatch<SetStateAction<boolean>>;
}

export default function BasicInfoSection({
  formData,
  setFormData,
  prefilledFromRequest,
  isuType,
  setIsuType,
  customSubject,
  setCustomSubject,
  customProfessor,
  setCustomProfessor,
}: Props) {
  const [subCategory, setSubCategory] = useState(""); // 학문의기초/교양/교직 하위분류
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseResults, setShowCourseResults] = useState(false);

  // 과목 검색 인덱스: (과목명, 이수구분, 학과/분류)
  const courseIndex = useMemo(() => {
    const list: Array<{ subject: string; isuType: string; dept: string }> = [];
    for (const [dept, courses] of Object.entries(departmentCourses)) {
      for (const c of courses) list.push({ subject: c, isuType: "전공", dept });
    }
    for (const [isu, subMap] of Object.entries(coursesByIsuCategory)) {
      for (const [sub, courses] of Object.entries(subMap)) {
        for (const c of courses) list.push({ subject: c, isuType: isu, dept: sub });
      }
    }
    return list;
  }, []);

  const courseSearchResults = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return [];
    return courseIndex
      .filter((item) => item.subject.toLowerCase().includes(q))
      .slice(0, 30);
  }, [courseSearch, courseIndex]);

  const selectCourseFromSearch = (item: { subject: string; isuType: string; dept: string }) => {
    setIsuType(item.isuType);
    setCustomSubject(false);
    setCustomProfessor(false);
    if (item.isuType === "전공") {
      setSubCategory("");
      setFormData((prev) => ({
        ...prev,
        department: item.dept,
        subject: item.subject,
        professor: "",
      }));
    } else {
      setSubCategory(item.dept);
      setFormData((prev) => ({
        ...prev,
        department: "",
        subject: item.subject,
        professor: "",
      }));
    }
    setCourseSearch("");
    setShowCourseResults(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "category") {
      setCustomSubject(false);
      setIsuType("");
      setSubCategory("");
      setCourseSearch("");
      setShowCourseResults(false);
      setFormData({ ...formData, [name]: value, subType: "", subject: "", department: "" });
      return;
    } else if (name === "department") {
      setCustomSubject(false);
      setCustomProfessor(false);
      setFormData({ ...formData, [name]: value, subject: "", professor: "" });
      return;
    } else if (name === "semester") {
      setCustomSubject(false);
      setCustomProfessor(false);
      setFormData({ ...formData, [name]: value, subject: "", professor: "" });
      return;
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  return (
    <Card>
      <CardContent className="p-7 max-sm:p-5">
        <h2 className="text-[17px] font-bold text-foreground mb-5 pb-3.5 border-b border-border tracking-tight">
          기본 정보
        </h2>

        {prefilledFromRequest && (
          <div className="mb-4 flex items-start gap-2 bg-[#862633]/5 border border-[#862633]/20 text-[#862633] rounded-lg py-3 px-4 text-sm">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              요청 게시판에서 넘어온 정보로 과목/교수가 미리 입력되었어요. 자유롭게 수정 가능합니다.
            </span>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="title" className="block text-[13px] font-semibold mb-2 text-foreground">
            자료 제목 *
          </label>
          <Input
            type="text"
            id="title"
            name="title"
            placeholder="예: 운영체제 중간고사 완벽정리 노트"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-[13px] font-semibold mb-2 text-foreground">
            자료 설명 *
          </label>
          <textarea
            id="description"
            name="description"
            placeholder={
              formData.category === "자격증"
                ? "합격수기, 준비방법 등을 자세히 작성해 주세요"
                : "자료에 대한 상세한 설명을 작성해 주세요"
            }
            rows={5}
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors resize-y focus:bg-muted focus:ring-2 focus:ring-[#862633]/30 placeholder:text-muted-foreground"
          />
          <div className="mt-2 flex gap-3 p-4.5 bg-amber-500/[0.06] rounded-lg">
            <div className="flex-shrink-0 text-amber-500 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-[13px] text-muted-foreground leading-relaxed">
              <strong className="block text-sm font-bold mb-1.5 text-foreground">
                자료 설명 관련 주의
              </strong>
              <ul className="m-0 pl-4.5 list-disc">
                <li className="mb-0.5">자료 설명과 실제 내용이 다른 경우 구매자의 하자 신고 접수 시 관리자 검토 후 지급된 수익금이 회수되고 자료가 삭제될 수 있습니다.</li>
                <li className="mb-0.5">반복 적발 시 계정 제재가 이루어질 수 있으니 설명을 정확히 작성해 주세요.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <div className="mb-4">
            <label htmlFor="category" className="block text-[13px] font-semibold mb-2 text-foreground">
              카테고리 *
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">선택하세요</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label htmlFor="semester" className="block text-[13px] font-semibold mb-2 text-foreground">
              학기
            </label>
            <select
              id="semester"
              name="semester"
              value={formData.semester}
              onChange={handleChange}
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">학기를 선택하세요</option>
              {Array.from({ length: 7 }, (_, i) => 2026 - i).map((year) => (
                <optgroup key={year} label={`${year}학년도`}>
                  <option value={`${year}-1`}>{year}학년도 1학기</option>
                  {year < 2026 && (
                    <option value={`${year}-2`}>{year}학년도 2학기</option>
                  )}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* 과목명 검색 — 학기 선택 후에만 노출, 클릭 시 이수구분/학과/과목명 자동 채움 */}
        {formData.category === "수업" && !formData.semester && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-muted/50 border border-dashed border-border text-[13px] text-muted-foreground">
            학기를 먼저 선택하면 과목 검색창이 나타납니다.
          </div>
        )}
        {formData.category === "수업" && formData.semester && (
          <div className="mb-4">
            <label htmlFor="courseSearch" className="block text-[13px] font-semibold mb-2 text-foreground">
              과목명으로 빠르게 찾기
            </label>
            <div className="relative">
              <Input
                id="courseSearch"
                type="text"
                placeholder="과목명을 입력하세요 (예: 자료구조)"
                value={courseSearch}
                onChange={(e) => {
                  setCourseSearch(e.target.value);
                  setShowCourseResults(true);
                }}
                onFocus={() => setShowCourseResults(true)}
                onBlur={() => {
                  // 클릭 이벤트가 먼저 처리되도록 지연
                  setTimeout(() => setShowCourseResults(false), 150);
                }}
                autoComplete="off"
              />
              {showCourseResults && courseSearchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-background shadow-lg">
                  {courseSearchResults.map((item, idx) => (
                    <button
                      key={`${item.subject}-${item.isuType}-${item.dept}-${idx}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectCourseFromSearch(item);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-b-0"
                    >
                      <div className="text-sm font-medium text-foreground">{item.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.isuType} · {item.dept}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showCourseResults && courseSearch.trim() && courseSearchResults.length === 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-lg px-4 py-3 text-xs text-muted-foreground">
                  일치하는 과목이 없습니다. 아래에서 직접 선택해주세요.
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              검색 결과를 클릭하면 이수구분·학과·과목명이 자동으로 입력됩니다.
            </p>
          </div>
        )}

        {/* 이수구분 선택 (수업 카테고리) */}
        {formData.category === "수업" && (
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2 text-foreground">
              이수구분 *
            </label>
            <select
              value={isuType}
              onChange={(e) => {
                setIsuType(e.target.value);
                setSubCategory("");
                setCustomSubject(false);
                setFormData({ ...formData, department: "", subject: "" });
              }}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">이수구분을 선택하세요</option>
              <option value="전공">전공</option>
              <option value="학문의기초">학문의기초</option>
              <option value="교양">교양</option>
              <option value="교직">교직</option>
            </select>
          </div>
        )}

        {/* 전공 → 학과 선택 */}
        {formData.category === "수업" && isuType === "전공" && (
          <div className="mb-4">
            <label htmlFor="department" className="block text-[13px] font-semibold mb-2 text-foreground">
              학과 *
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">학과를 선택하세요</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        )}

        {/* 학문의기초/교양/교직 → 하위분류 선택 */}
        {formData.category === "수업" && (isuType === "학문의기초" || isuType === "교양" || isuType === "교직") && (
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2 text-foreground">
              분류 *
            </label>
            <select
              value={subCategory}
              onChange={(e) => {
                setSubCategory(e.target.value);
                setCustomSubject(false);
                setFormData({ ...formData, subject: "" });
              }}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">분류를 선택하세요</option>
              {Object.keys(coursesByIsuCategory[isuType] || {}).sort().map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        )}

        {/* 다중전공 → 유형 선택 */}
        {formData.category === "다중전공" && (
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2 text-foreground">
              유형 *
            </label>
            <select
              value={formData.subType}
              onChange={(e) => setFormData({ ...formData, subType: e.target.value, department: "" })}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">유형을 선택하세요</option>
              <option value="이중전공">이중전공</option>
              <option value="융합전공">융합전공</option>
              <option value="전과">전과</option>
            </select>
          </div>
        )}

        {/* 이중전공/전과 → 학과 선택 */}
        {formData.category === "다중전공" && (formData.subType === "이중전공" || formData.subType === "전과") && (
          <div className="mb-4">
            <label htmlFor="department" className="block text-[13px] font-semibold mb-2 text-foreground">
              학과 *
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">학과를 선택하세요</option>
              {formData.subType === "이중전공" ? (
                doubleMajorDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))
              ) : formData.subType === "전과" ? (
                Object.entries(transferDepartmentsByCollege).map(([college, depts]) => (
                  <optgroup key={college} label={college}>
                    {depts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </optgroup>
                ))
              ) : (
                regularDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))
              )}
            </select>
          </div>
        )}

        {/* 융합전공 → 융합전공 선택 */}
        {formData.category === "다중전공" && formData.subType === "융합전공" && (
          <div className="mb-4">
            <label htmlFor="department" className="block text-[13px] font-semibold mb-2 text-foreground">
              융합전공 *
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">융합전공을 선택하세요</option>
              {convergenceMajors.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* 동아리 & 학회 → 유형 선택 */}
        {formData.category === "동아리 & 학회" && (
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2 text-foreground">
              유형 *
            </label>
            <div className="flex gap-3">
              {["동아리", "학회"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, department: type })}
                  className={cn(
                    "flex-1 py-3 rounded-lg text-sm font-medium transition-colors border",
                    formData.department === type
                      ? "bg-primary text-white border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 교환학생 → 국가 선택 */}
        {formData.category === "교환학생" && (
          <div className="mb-4">
            <label htmlFor="department" className="block text-[13px] font-semibold mb-2 text-foreground">
              국가 *
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
            >
              <option value="">국가를 선택하세요</option>
              {Object.entries(exchangeCountries).map(([region, countries]) => (
                <optgroup key={region} label={region}>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* 자격증 → 자격증 이름 입력 */}
        {formData.category === "자격증" && (
          <div className="mb-4">
            <label htmlFor="subject" className="block text-[13px] font-semibold mb-2 text-foreground">
              자격증 이름 *
            </label>
            <Input
              type="text"
              id="subject"
              name="subject"
              placeholder="예: 정보처리기사, TOEIC, 한국사능력검정시험"
              value={formData.subject}
              onChange={handleChange}
              required
            />
          </div>
        )}

        {/* 과목명 — 학과/분류 선택 후 표시, 학기 선택 시 해당 학기 과목만 */}
        {formData.category === "수업" && (
          (isuType === "전공" && formData.department) ||
          ((isuType === "학문의기초" || isuType === "교양" || isuType === "교직") && subCategory) ||
          (customSubject && prefilledFromRequest)
        ) && (
          <div className="mb-4">
            <label htmlFor="subject" className="block text-[13px] font-semibold mb-2 text-foreground">
              과목명 *
            </label>
            {!customSubject ? (
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomSubject(true);
                    setCustomProfessor(false);
                    setFormData({ ...formData, subject: "", professor: "" });
                  } else {
                    setCustomProfessor(false);
                    setFormData({ ...formData, subject: e.target.value, professor: "" });
                  }
                }}
                required
                className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
              >
                <option value="">과목을 선택하세요</option>
                {(() => {
                  const base = (isuType === "전공"
                    ? departmentCourses[formData.department] || []
                    : coursesByIsuCategory[isuType]?.[subCategory] || []
                  ).filter((course) =>
                    !formData.semester || !courseSemesters[course] || courseSemesters[course].includes(formData.semester)
                  );
                  // 검색으로 선택한 과목이 학기 필터에 걸러져도 항상 노출되도록 보정
                  const list = formData.subject && !base.includes(formData.subject)
                    ? [formData.subject, ...base]
                    : base;
                  return list.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ));
                })()}
                <option value="__custom__">기타 (직접 입력)</option>
              </select>
            ) : (
              <>
                <Input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="예: 운영체제"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="mt-1.5 text-xs text-primary hover:underline"
                  onClick={() => {
                    setCustomSubject(false);
                    setFormData({ ...formData, subject: "", professor: "" });
                  }}
                >
                  목록에서 선택하기
                </button>
              </>
            )}
          </div>
        )}

        {/* 교수명 — 과목 선택 후 표시, 학기 선택 시 해당 학기 교수만 */}
        {formData.category === "수업" && formData.subject && (
          <div className="mb-4">
            <label htmlFor="professor" className="block text-[13px] font-semibold mb-2 text-foreground">
              교수명
            </label>
            {!customSubject && !customProfessor && (
              (formData.semester && courseProfessorsBySemester[formData.semester]?.[formData.subject]) ||
              courseProfessors[formData.subject]
            ) ? (
              <select
                id="professor"
                name="professor"
                value={formData.professor}
                onChange={(e) => {
                  if (e.target.value === "__custom_prof__") {
                    setCustomProfessor(true);
                    setFormData({ ...formData, professor: "" });
                  } else {
                    setFormData({ ...formData, professor: e.target.value });
                  }
                }}
                className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
              >
                <option value="">교수를 선택하세요</option>
                {((formData.semester && courseProfessorsBySemester[formData.semester]?.[formData.subject])
                  ? courseProfessorsBySemester[formData.semester][formData.subject]
                  : courseProfessors[formData.subject] || []
                ).map((prof) => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
                <option value="__custom_prof__">기타 (직접 입력)</option>
              </select>
            ) : (
              <>
                <Input
                  type="text"
                  id="professor"
                  name="professor"
                  placeholder="예: 홍길동"
                  value={formData.professor}
                  onChange={handleChange}
                />
                {customProfessor && (
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-primary hover:underline"
                    onClick={() => {
                      setCustomProfessor(false);
                      setFormData({ ...formData, professor: "" });
                    }}
                  >
                    목록에서 선택하기
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
