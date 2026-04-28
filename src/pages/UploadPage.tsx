import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { categories, departments, regularDepartments, convergenceMajors, exchangeCountries, departmentCourses, coursesByIsuCategory, courseProfessors, courseSemesters, courseProfessorsBySemester } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { apiPost } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Upload, X, CheckCircle, Image, AlertTriangle, Lightbulb, ChevronDown, Camera, FileText, Award, GraduationCap } from "lucide-react";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-hwp",
  "application/haansofthwp",
];
const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PREVIEWS = 5;
const MAX_FILES = 10;

function getFileTypeLabel(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase() || "";
  if (ext === "PPTX" || ext === "PPT") return "PPT";
  if (ext === "DOCX" || ext === "DOC") return "DOCX";
  if (ext === "HWP") return "HWP";
  if (ext === "PDF") return "PDF";
  return ext || "기타";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// R2 키에 안전한 파일명으로 정리 (한글/공백/괄호 등 제거)
function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const rawExt = lastDot >= 0 ? name.slice(lastDot + 1) : "";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rawBase = lastDot >= 0 ? name.slice(0, lastDot) : name;
  const base =
    rawBase
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

interface PreviewImage {
  file: File;
  url: string;
}

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const gradeInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [gradeImage, setGradeImage] = useState<PreviewImage | null>(null);
  const [gradeClaim, setGradeClaim] = useState("");
  const [customSubject, setCustomSubject] = useState(false);
  const [customProfessor, setCustomProfessor] = useState(false);
  const [isuType, setIsuType] = useState(""); // 전공, 학문의기초, 교양, 교직
  const [subCategory, setSubCategory] = useState(""); // 학문의기초/교양/교직 하위분류
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseResults, setShowCourseResults] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    subType: "",
    subject: "",
    professor: "",
    department: "",
    semester: "",
    price: "",
    pages: "",
  });
  const [prefilledFromRequest, setPrefilledFromRequest] = useState(false);

  useEffect(() => {
    const qpSubject = searchParams.get("subject");
    const qpProfessor = searchParams.get("professor") || "";
    const qpCategory = searchParams.get("category") || "수업";
    if (!qpSubject) return;

    let foundDept = "";
    for (const dept of Object.keys(departmentCourses)) {
      if (departmentCourses[dept].includes(qpSubject)) {
        foundDept = dept;
        break;
      }
    }

    const subjectInList = !!foundDept;
    const professorInList =
      subjectInList && (courseProfessors[qpSubject] || []).includes(qpProfessor);

    setFormData((prev) => ({
      ...prev,
      category: qpCategory,
      department: foundDept,
      subject: qpSubject,
      professor: qpProfessor,
    }));
    setIsuType("전공");
    setCustomSubject(!subjectInList);
    setCustomProfessor(!!qpProfessor && !professorInList);
    setPrefilledFromRequest(true);
  }, [searchParams]);

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

  const validateFile = (f: File): string | null => {
    if (f.size > MAX_SIZE) return "파일 크기는 100MB를 초과할 수 없습니다.";
    const ext = f.name.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "ppt", "pptx", "doc", "docx", "hwp"];
    if (!ext || (!validExts.includes(ext) && !ALLOWED_TYPES.includes(f.type))) {
      return "PDF, PPT, DOCX, HWP 파일만 업로드 가능합니다.";
    }
    return null;
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const oversized: string[] = [];
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        setError(`파일은 최대 ${MAX_FILES}개까지 업로드할 수 있습니다.`);
        return prev;
      }
      const accepted: File[] = [];
      const otherRejections: string[] = [];
      for (const f of incoming) {
        if (accepted.length >= remaining) {
          otherRejections.push(`${f.name} — 최대 ${MAX_FILES}개 초과`);
          break;
        }
        if (f.size > MAX_SIZE) {
          oversized.push(`${f.name} (${formatFileSize(f.size)})`);
          continue;
        }
        const err = validateFile(f);
        if (err) {
          otherRejections.push(`${f.name} — ${err}`);
          continue;
        }
        if (prev.some((p) => p.name === f.name && p.size === f.size)) {
          otherRejections.push(`${f.name} — 이미 추가된 파일`);
          continue;
        }
        accepted.push(f);
      }
      if (otherRejections.length > 0 && accepted.length === 0) {
        setError(otherRejections[0]);
      } else {
        setError("");
      }
      return accepted.length > 0 ? [...prev, ...accepted] : prev;
    });
    // 100MB 초과 파일 alert (가장 흔한 거절 사유라 별도 안내)
    if (oversized.length > 0) {
      alert(
        `다음 파일은 100MB를 초과하여 업로드할 수 없습니다.\n\n` +
        oversized.map((s) => `• ${s}`).join("\n") +
        `\n\n파일을 압축하거나 분할해서 다시 시도해주세요.`
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handlePreviewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_PREVIEWS - previewImages.length;
    if (remaining <= 0) {
      setError(`미리보기 이미지는 최대 ${MAX_PREVIEWS}장까지 첨부 가능합니다.`);
      return;
    }

    const newImages: PreviewImage[] = [];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) continue;
      newImages.push({ file: f, url: URL.createObjectURL(f) });
    }

    if (newImages.length === 0) {
      setError("이미지 파일만 업로드 가능합니다. (최대 5MB)");
      return;
    }

    setPreviewImages((prev) => [...prev, ...newImages]);
    setError("");
    if (previewInputRef.current) previewInputRef.current.value = "";
  };

  const removePreviewImage = (index: number) => {
    setPreviewImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    // 등록 쿨타임 확인 — 베타 테스트 중 임시 비활성화
    // TODO: 베타 종료 후 다시 켜기 (백엔드 MaterialService도 같이)
    // try {
    //   const recent = await apiGetList<{ createdAt?: string }>("/users/me/materials?sort=createdAt,desc&limit=1");
    //   if (recent.length > 0 && recent[0].createdAt) {
    //     const lastCreated = new Date(recent[0].createdAt);
    //     if (Date.now() - lastCreated.getTime() < UPLOAD_COOLDOWN_MS) {
    //       const remaining = Math.ceil((UPLOAD_COOLDOWN_MS - (Date.now() - lastCreated.getTime())) / 1000);
    //       const min = Math.floor(remaining / 60);
    //       const sec = remaining % 60;
    //       setError(`자료 등록 후 5분간 재등록할 수 없습니다. (${min}분 ${sec}초 후 가능)`);
    //       return;
    //     }
    //   }
    // } catch { /* ignore cooldown check failure */ }

    if (files.length === 0) {
      setError("파일을 선택해주세요.");
      return;
    }

    if (previewImages.length === 0) {
      setError("미리보기 이미지를 최소 1장 첨부해주세요.");
      return;
    }

    // 가격 검증 (정수, 0~500,000)
    const priceInt = parseInt(formData.price);
    if (!Number.isInteger(priceInt) || priceInt < 0 || priceInt > 500000) {
      setError("판매 가격은 0원 이상 500,000원 이하의 정수여야 합니다.");
      return;
    }

    if (gradeClaim && !gradeImage) {
      setError("성적을 선택하셨다면 성적증명서 캡처를 첨부해주세요.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // 자료 파일 업로드 (최대 10개)
      const uploadedFiles: Array<{
        fileUrl: string;
        key: string;
        name: string;
        size: number;
        type: string;
      }> = [];
      for (const f of files) {
        const ct = f.type || "application/octet-stream";
        const safeName = sanitizeFileName(f.name);
        let fdata: { uploadUrl: string; fileUrl: string; key: string };
        try {
          fdata = await apiPost<{ uploadUrl: string; fileUrl: string; key: string }>("/materials/upload-url", { fileName: safeName, contentType: ct, fileSize: f.size });
        } catch (e) {
          throw new Error(`업로드 URL 발급 실패 (${f.name}): ${(e as Error).message}`);
        }
        try {
          console.log("[upload] PUT →", fdata.uploadUrl.split("?")[0], "ct=", ct, "size=", f.size);
          const putRes = await fetch(fdata.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": ct },
            body: f,
          });
          if (!putRes.ok) {
            const text = await putRes.text().catch(() => "");
            console.error("[upload] PUT failed", putRes.status, text);
            throw new Error(`HTTP ${putRes.status} ${text.slice(0, 200)}`);
          }
          console.log("[upload] PUT ok", putRes.status);
        } catch (e) {
          console.error("[upload] PUT exception", e);
          const msg = (e as Error).message || String(e);
          throw new Error(`파일 업로드 실패 (${f.name}): ${msg} — R2 CORS 설정이 안 돼 있을 수 있습니다. 브라우저 개발자도구 콘솔을 확인하세요.`);
        }
        uploadedFiles.push({
          fileUrl: fdata.fileUrl,
          key: fdata.key,
          name: f.name, // 원본 파일명은 Firestore/표시용으로 유지
          size: f.size,
          type: getFileTypeLabel(f),
        });
      }
      const primaryFile = uploadedFiles[0];

      // 미리보기 이미지들 업로드
      const uploadedPreviewUrls: string[] = [];
      for (let i = 0; i < previewImages.length; i++) {
        const img = previewImages[i].file;
        const imgExt = (img.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const imgName = `preview_${Date.now()}_${i}.${imgExt}`;
        const imgData = await apiPost<{ uploadUrl: string; fileUrl: string; key: string }>("/materials/upload-url", {
          fileName: imgName,
          contentType: img.type,
          fileSize: img.size,
        });
        const imgPut = await fetch(imgData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": img.type },
          body: img,
        });
        if (!imgPut.ok) {
          throw new Error(`미리보기 이미지 업로드 실패: HTTP ${imgPut.status}`);
        }
        uploadedPreviewUrls.push(imgData.fileUrl);
      }

      // 성적증명서 이미지 업로드
      let gradeImageUrl = "";
      if (gradeImage && gradeClaim) {
        const gradeExt = (gradeImage.file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const gradeFileName = `grade_${Date.now()}.${gradeExt}`;
        const gradeData = await apiPost<{ uploadUrl: string; fileUrl: string; key: string }>("/materials/upload-url", {
          fileName: gradeFileName,
          contentType: gradeImage.file.type,
          fileSize: gradeImage.file.size,
        });
        const gradePut = await fetch(gradeData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": gradeImage.file.type },
          body: gradeImage.file,
        });
        if (!gradePut.ok) {
          throw new Error(`성적증명서 업로드 실패: HTTP ${gradePut.status}`);
        }
        gradeImageUrl = gradeData.fileUrl;
      }

      // API로 자료 정보 저장
      const materialData: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        department: (formData.category === "수업" || formData.category === "이중전공 & 융합전공 & 전과" || formData.category === "동아리 & 학회" || formData.category === "교환학생") ? formData.department : "",
        semester: formData.semester || "",
        subject: formData.subject,
        professor: formData.professor,
        price: priceInt,
        fileType: primaryFile.type,
        pages: formData.pages ? parseInt(formData.pages) : 0,
        fileUrl: primaryFile.fileUrl,
        fileKey: primaryFile.key,
        fileName: primaryFile.name,
        fileSize: primaryFile.size,
        fileUrls: uploadedFiles.map((f) => f.fileUrl),
        fileKeys: uploadedFiles.map((f) => f.key),
        fileNames: uploadedFiles.map((f) => f.name),
        fileSizes: uploadedFiles.map((f) => f.size),
        fileTypes: uploadedFiles.map((f) => f.type),
        fileCount: uploadedFiles.length,
        thumbnail: uploadedPreviewUrls[0] || "",
        previewImages: uploadedPreviewUrls,
      };

      if (gradeImageUrl && gradeClaim) {
        materialData.gradeImage = gradeImageUrl;
        materialData.gradeClaim = gradeClaim;
        materialData.gradeStatus = "pending";
      }

      const result = await apiPost<{ id: string }>("/materials", materialData);

      // 바이러스 검사 (백그라운드 실행)
      apiPost(`/materials/${result.id}/scan`).catch(() => {});

      navigate("/browse", { state: { refreshKey: Date.now() } });
    } catch (err) {
      setError((err as Error).message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="py-10 pb-20">
        <div className="mx-auto max-w-[720px] px-6">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="py-10 pb-20 max-sm:py-6 max-sm:pb-16">
      <div className="mx-auto max-w-[720px] px-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-2 tracking-tight">
          공부한 자료, 더 이상 버리지 마세요
        </h1>
        <p className="text-[15px] text-muted-foreground mb-6">
          내 자료를 올려 다른 학생들에게 판매해 보세요
        </p>

        {/* 잘 팔리는 자료 가이드 */}
        <div className="mb-7">
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-3 px-5 py-4 rounded-lg border cursor-pointer transition-colors bg-background",
              showGuide
                ? "border-[#862633]/30 bg-[#862633]/[0.03]"
                : "border-border hover:border-[#862633]/30 hover:bg-[#862633]/[0.02]"
            )}
            onClick={() => setShowGuide(!showGuide)}
          >
            <div className="w-8 h-8 rounded-full bg-[#862633]/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-[#862633]" />
            </div>
            <span className="text-[15px] font-bold text-foreground flex-1 text-left">
              잘 팔리는 자료 가이드
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showGuide && "rotate-180")} />
          </button>

          {showGuide && (
            <Card className="mt-2 border-[#862633]/20">
              <CardContent className="p-6 max-sm:p-4 space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  아래 가이드를 참고하면 자료의 판매 전환율이 크게 올라갑니다. 구매자가 신뢰할 수 있는 자료일수록 잘 팔립니다.
                </p>

                {/* 1. 미리보기 이미지 */}
                <div className="flex gap-4 max-sm:flex-col">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Camera className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] font-bold text-foreground mb-2">
                      1. 미리보기 이미지를 정성스럽게 준비하세요
                    </h3>
                    <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1.5">
                      <p>
                        구매자는 미리보기 이미지만 보고 구매를 결정합니다. <strong className="text-foreground">자료의 내용과 구성이 한눈에 보이는 캡처</strong>를 올려주세요.
                      </p>
                      <ul className="pl-4 list-disc space-y-1 mt-2">
                        <li><strong className="text-foreground">목차 페이지</strong>를 첫 번째 이미지로 — 전체 구성을 파악할 수 있어요</li>
                        <li><strong className="text-foreground">핵심 내용이 담긴 페이지</strong> 2~3장 — 자료의 퀄리티를 보여주세요</li>
                        <li><strong className="text-foreground">표, 그래프, 정리 노트</strong> 등 시각적으로 정돈된 페이지가 효과적이에요</li>
                        <li>흐릿하거나 잘린 캡처는 피하고, <strong className="text-foreground">깨끗하게 전체 화면을 캡처</strong>하세요</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* 2. 상세한 자료 설명 */}
                <div className="flex gap-4 max-sm:flex-col">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] font-bold text-foreground mb-2">
                      2. 자료 설명은 구체적으로 작성하세요
                    </h3>
                    <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1.5">
                      <p>
                        "시험 정리"보다 <strong className="text-foreground">"2025-1 운영체제 중간고사 범위(1~7장) 핵심 요약 + 기출 복원"</strong>처럼 구체적으로 쓸수록 검색에 잘 노출되고 구매율이 높아집니다.
                      </p>
                      <ul className="pl-4 list-disc space-y-1 mt-2">
                        <li><strong className="text-foreground">어떤 시험/과제</strong>를 위한 자료인지 명시하세요 (중간, 기말, 레포트 등)</li>
                        <li><strong className="text-foreground">다루는 범위</strong>를 구체적으로 적어주세요 (단원, 주차, 챕터 등)</li>
                        <li><strong className="text-foreground">자료의 특장점</strong>을 어필하세요 (교수님 판서 반영, 기출 복원, 핵심 요약 등)</li>
                        <li><strong className="text-foreground">페이지 수와 분량</strong>을 꼭 기입하면 구매 결정에 도움이 됩니다</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* 3. 성적 인증 시스템 */}
                <div className="flex gap-4 max-sm:flex-col">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Award className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] font-bold text-foreground mb-2">
                      3. 성적 인증 시스템을 활용하세요
                    </h3>
                    <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1.5">
                      <p>
                        <strong className="text-foreground">해당 과목에서 높은 성적을 받았다면, 성적 인증을 등록해보세요.</strong> 성적 인증 배지가 표시된 자료는 구매자의 신뢰도가 크게 올라갑니다.
                      </p>
                      <ul className="pl-4 list-disc space-y-1 mt-2">
                        <li>마이페이지에서 <strong className="text-foreground">성적표 캡처를 업로드</strong>하면 관리자 검토 후 인증 배지가 부여됩니다</li>
                        <li><strong className="text-foreground">A+ 인증 자료</strong>는 검색 결과에서 상위에 노출되며 판매량이 평균 2배 이상 높습니다</li>
                        <li>성적 인증은 <strong className="text-foreground">과목별로 한 번만</strong> 하면 해당 과목의 모든 자료에 자동 적용됩니다</li>
                        <li>이름 이외의 개인정보(학번, 생년월일 등)는 <strong className="text-foreground">반드시 모자이크 처리 후 업로드</strong>해야 합니다</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-[#862633]/[0.04] rounded-lg p-4 text-[13px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">TIP:</strong> 위 세 가지를 모두 갖춘 자료는 평균 대비 <strong className="text-foreground">판매량이 3배 이상</strong> 높습니다. 처음 등록할 때 조금만 신경 쓰면 꾸준한 수익으로 이어집니다.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <form className="flex flex-col gap-7" onSubmit={handleSubmit}>
          {/* 기본 정보 */}
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
                  placeholder="자료에 대한 상세한 설명을 작성해 주세요"
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
                      <li className="mb-0.5">자료 설명과 실제 내용이 다른 경우 구매자의 하자 신고 접수 시 관리자 검토 후 지급된 포인트가 회수되고 자료가 삭제될 수 있습니다.</li>
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
                        {cat.icon} {cat.name}
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

              {/* 이중전공 & 융합전공 & 전과 → 유형 선택 */}
              {formData.category === "이중전공 & 융합전공 & 전과" && (
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
              {formData.category === "이중전공 & 융합전공 & 전과" && (formData.subType === "이중전공" || formData.subType === "전과") && (
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
                    {regularDepartments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 융합전공 → 융합전공 선택 */}
              {formData.category === "이중전공 & 융합전공 & 전과" && formData.subType === "융합전공" && (
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

          {/* 가격 및 파일 */}
          <Card>
            <CardContent className="p-7 max-sm:p-5">
              <h2 className="text-[17px] font-bold text-foreground mb-5 pb-3.5 border-b border-border tracking-tight">
                가격 및 파일
              </h2>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1 mb-4">
                <div>
                  <label htmlFor="price" className="block text-[13px] font-semibold mb-2 text-foreground">
                    판매 가격 (P) *
                  </label>
                  <Input
                    type="number"
                    id="price"
                    name="price"
                    placeholder="예: 3000"
                    min={0}
                    max={500000}
                    step={1}
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pages" className="block text-[13px] font-semibold mb-2 text-foreground">
                    페이지 수
                  </label>
                  <Input
                    type="number"
                    id="pages"
                    name="pages"
                    placeholder="예: 42"
                    min={1}
                    value={formData.pages}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* 파일 업로드 영역 */}
              <div className="mb-4">
                <label className="block text-[13px] font-semibold mb-2 text-foreground">
                  파일 업로드 * ({files.length}/{MAX_FILES})
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.hwp"
                  multiple
                  onChange={handleFileInput}
                  hidden
                />

                {files.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {files.map((f, idx) => (
                      <div
                        key={`${f.name}-${f.size}-${idx}`}
                        className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3"
                      >
                        <div className="w-8 h-8 shrink-0 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-foreground truncate">{f.name}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {getFileTypeLabel(f)} · {formatFileSize(f.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-black/5 text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
                          onClick={() => removeFile(idx)}
                          aria-label="파일 삭제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {files.length < MAX_FILES && (
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg py-11 px-5 text-center cursor-pointer transition-colors bg-muted",
                      dragActive && "border-[#862633] bg-[#862633]/5",
                      !dragActive && "border-border hover:border-[#862633]/40 hover:bg-[#862633]/5"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-10 h-10 mx-auto mb-2.5 text-muted-foreground/60" strokeWidth={1.5} />
                    <p className="text-sm text-muted-foreground">
                      {files.length === 0
                        ? "파일을 드래그하거나 클릭하여 업로드"
                        : "파일을 더 추가하려면 드래그하거나 클릭하세요"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">
                      PDF, PPT, DOCX, HWP (파일당 최대 100MB, 최대 {MAX_FILES}개)
                    </p>
                  </div>
                )}
              </div>

              {/* 미리보기 이미지 */}
              <div>
                <label className="block text-[13px] font-semibold mb-2 text-foreground">
                  미리보기 이미지 * ({previewImages.length}/{MAX_PREVIEWS})
                </label>
                <p className="text-[13px] text-muted-foreground mb-2.5 leading-relaxed">
                  자료의 내용을 확인할 수 있는 이미지를 첨부해주세요. 첫 번째 이미지가 대표 미리보기로 사용됩니다.
                </p>

                {previewImages.length > 0 && (
                  <div className="flex gap-2.5 flex-wrap mb-3">
                    {previewImages.map((img, idx) => (
                      <div key={idx} className="relative w-[120px] h-[150px] rounded-md overflow-hidden shadow-sm">
                        <img src={img.url} alt={`미리보기 ${idx + 1}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <Badge className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-[#862633] text-white hover:bg-[#862633]">
                            대표
                          </Badge>
                        )}
                        <button
                          type="button"
                          className="absolute top-1.5 right-1.5 w-[22px] h-[22px] flex items-center justify-center bg-black/50 text-white border-none rounded-full cursor-pointer p-0 transition-colors hover:bg-red-500"
                          onClick={() => removePreviewImage(idx)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {previewImages.length < MAX_PREVIEWS && (
                  <div
                    className="border-2 border-dashed border-border rounded-lg cursor-pointer transition-colors overflow-hidden bg-muted hover:border-[#862633]/40 hover:bg-[#862633]/5"
                    onClick={() => previewInputRef.current?.click()}
                  >
                    <input
                      ref={previewInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePreviewImages}
                      hidden
                    />
                    <div className="flex flex-col items-center gap-1.5 py-8 px-5 text-muted-foreground/60 text-sm">
                      <Image className="w-6 h-6" strokeWidth={1.5} />
                      <span>클릭하여 미리보기 이미지 첨부</span>
                      <span className="text-xs text-muted-foreground/60">JPG, PNG (최대 5MB, {MAX_PREVIEWS}장까지)</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 성적 인증 (선택, 수업 카테고리일 때만) */}
          {formData.category === "수업" && <Card>
            <CardContent className="p-7 max-sm:p-5">
              <div className="flex items-center gap-3 mb-5 pb-3.5 border-b border-border">
                <GraduationCap className="w-5 h-5 text-amber-500" />
                <div>
                  <h2 className="text-[17px] font-bold text-foreground tracking-tight">
                    성적 인증
                    <Badge className="ml-2 text-[11px] bg-secondary text-muted-foreground hover:bg-secondary">선택</Badge>
                  </h2>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    해당 과목의 성적을 인증하면 자료에 성적 배지가 표시됩니다
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[13px] font-semibold mb-2 text-foreground">
                  취득 성적
                </label>
                <div className="flex flex-wrap gap-2">
                  {["A+", "A", "B+", "B", "C+", "C", "P"].map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-bold transition-colors cursor-pointer",
                        gradeClaim === grade
                          ? grade === "P"
                            ? "border-purple-500 bg-purple-500/10 text-purple-700"
                            : grade.startsWith("A")
                              ? "border-amber-500 bg-amber-500/10 text-amber-700"
                              : grade.startsWith("B")
                                ? "border-blue-500 bg-blue-500/10 text-blue-700"
                                : "border-green-500 bg-green-500/10 text-green-700"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/70"
                      )}
                      onClick={() => setGradeClaim(gradeClaim === grade ? "" : grade)}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>

              {gradeClaim && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-2 text-foreground">
                    성적증명서 캡처 *
                  </label>
                  <p className="text-[12px] text-muted-foreground mb-2 leading-relaxed">
                    성적증명서에서 해당 과목의 성적이 보이는 부분을 캡처해 주세요. 이름 이외의 개인정보(학번, 생년월일 등)는 반드시 모자이크 처리해야 합니다.
                  </p>
                  <p className="text-[11px] text-red-500 mb-2.5 leading-relaxed font-medium">
                    ⚠ 허위 성적 증명 시 형법 제231조(사문서위조) 및 제234조(위조사문서행사)에 따라 5년 이하의 징역 또는 1천만 원 이하의 벌금에 처해질 수 있으며, 전자상거래법 제21조에 따라 허위·과장 정보 제공에 대한 법적 제재를 받을 수 있습니다.
                  </p>

                  {gradeImage ? (
                    <div className="relative inline-block">
                      <img
                        src={gradeImage.url}
                        alt="성적증명서"
                        className="w-[200px] h-[150px] object-cover rounded-lg border border-border shadow-sm"
                      />
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 w-[22px] h-[22px] flex items-center justify-center bg-black/50 text-white border-none rounded-full cursor-pointer p-0 transition-colors hover:bg-red-500"
                        onClick={() => {
                          URL.revokeObjectURL(gradeImage.url);
                          setGradeImage(null);
                          if (gradeInputRef.current) gradeInputRef.current.value = "";
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-border rounded-lg cursor-pointer transition-colors overflow-hidden bg-muted hover:border-amber-400/60 hover:bg-amber-500/5"
                      onClick={() => gradeInputRef.current?.click()}
                    >
                      <input
                        ref={gradeInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!f.type.startsWith("image/")) {
                            setError("이미지 파일만 업로드 가능합니다.");
                            return;
                          }
                          if (f.size > 5 * 1024 * 1024) {
                            setError("이미지 파일은 5MB를 초과할 수 없습니다.");
                            return;
                          }
                          setGradeImage({ file: f, url: URL.createObjectURL(f) });
                          setError("");
                        }}
                        hidden
                      />
                      <div className="flex flex-col items-center gap-1.5 py-8 px-5 text-muted-foreground/60 text-sm">
                        <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
                        <span>클릭하여 성적증명서 캡처 첨부</span>
                        <span className="text-xs text-muted-foreground/60">JPG, PNG (최대 5MB)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!gradeClaim && (
                <div className="bg-secondary/80 rounded-lg p-3.5 text-[13px] text-muted-foreground leading-relaxed">
                  성적을 선택하면 성적증명서 업로드 영역이 나타납니다. 관리자 검토 후 인증 배지가 자료에 표시됩니다.
                </div>
              )}
            </CardContent>
          </Card>}

          {/* 저작권 배너 */}
          <div className="flex gap-3 p-4.5 bg-amber-500/[0.06] rounded-lg">
            <div className="flex-shrink-0 text-amber-500 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-[13px] text-muted-foreground leading-relaxed">
              <strong className="block text-sm font-bold mb-1.5 text-foreground">
                저작권 관련 주의사항
              </strong>
              <ul className="m-0 pl-4.5 list-disc">
                <li className="mb-0.5">타인의 저작물(교재, 논문, 강의자료 등)을 무단으로 복제하여 업로드하지 마세요.</li>
                <li className="mb-0.5">본인이 직접 작성한 자료만 판매할 수 있습니다.</li>
                <li className="mb-0.5">저작권 침해 자료는 사전 통보 없이 삭제될 수 있으며, 법적 책임은 업로더에게 있습니다.</li>
              </ul>
            </div>
          </div>

          {error && (
            <p className="bg-red-500/[0.06] text-red-500 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={uploading}
            className="w-full py-4 h-auto bg-[#862633] hover:bg-[#6B1E29] text-white text-base font-bold rounded-lg tracking-tight disabled:opacity-40"
          >
            {uploading ? "업로드 중..." : "자료 등록하기"}
          </Button>
        </form>
      </div>
    </div>
  );
}
