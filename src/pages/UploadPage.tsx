import { useState, useEffect } from "react";
import { useNavigate, Navigate, useSearchParams, Link } from "react-router-dom";
import { departmentCourses, courseProfessors } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { apiPost } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { getFileTypeLabel, sanitizeFileName, type PreviewImage, type UploadFormData } from "../components/upload/utils";
import UploadGuide from "../components/upload/UploadGuide";
import BasicInfoSection from "../components/upload/BasicInfoSection";
import FileUploadZone from "../components/upload/FileUploadZone";
import PreviewImageSection from "../components/upload/PreviewImageSection";
import GradeCertSection from "../components/upload/GradeCertSection";

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [gradeImage, setGradeImage] = useState<PreviewImage | null>(null);
  const [gradeClaim, setGradeClaim] = useState("");
  const [customSubject, setCustomSubject] = useState(false);
  const [customProfessor, setCustomProfessor] = useState(false);
  const [isuType, setIsuType] = useState(""); // 전공, 학문의기초, 교양, 교직
  const [formData, setFormData] = useState<UploadFormData>({
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
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);

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

    if (!copyrightConfirmed) {
      setError("자료가 본인 저작물임을 확인하는 항목에 동의해주세요.");
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
          const putRes = await fetch(fdata.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": ct },
            body: f,
          });
          if (!putRes.ok) {
            const text = await putRes.text().catch(() => "");
            throw new Error(`HTTP ${putRes.status} ${text.slice(0, 200)}`);
          }
        } catch (e) {
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
        department: (formData.category === "수업" || formData.category === "다중전공" || formData.category === "동아리 & 학회" || formData.category === "교환학생") ? formData.department : "",
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
        copyrightConfirmed: true,
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
        <UploadGuide />

        <form className="flex flex-col gap-7" onSubmit={handleSubmit}>
          {/* 기본 정보 */}
          <BasicInfoSection
            formData={formData}
            setFormData={setFormData}
            prefilledFromRequest={prefilledFromRequest}
            isuType={isuType}
            setIsuType={setIsuType}
            customSubject={customSubject}
            setCustomSubject={setCustomSubject}
            customProfessor={customProfessor}
            setCustomProfessor={setCustomProfessor}
          />

          {/* 가격 및 파일 */}
          <Card>
            <CardContent className="p-7 max-sm:p-5">
              <h2 className="text-[17px] font-bold text-foreground mb-5 pb-3.5 border-b border-border tracking-tight">
                가격 및 파일
              </h2>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1 mb-4">
                <div>
                  <label htmlFor="price" className="block text-[13px] font-semibold mb-2 text-foreground">
                    판매 가격 (원) *
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
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                  />
                </div>
              </div>

              {/* 파일 업로드 영역 */}
              <FileUploadZone files={files} setFiles={setFiles} onError={setError} />

              {/* 미리보기 이미지 */}
              <PreviewImageSection images={previewImages} setImages={setPreviewImages} onError={setError} />
            </CardContent>
          </Card>

          {/* 성적 인증 (선택, 수업 카테고리일 때만) */}
          {formData.category === "수업" && (
            <GradeCertSection
              gradeImage={gradeImage}
              setGradeImage={setGradeImage}
              gradeClaim={gradeClaim}
              setGradeClaim={setGradeClaim}
              onError={setError}
            />
          )}

          {/* 저작권 동의 (필수) */}
          <div>
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

            <label className="mt-3 flex items-start gap-2.5 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={copyrightConfirmed}
                onChange={(e) => setCopyrightConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#862633] focus:ring-[#862633]"
              />
              <span className="text-[13px] text-muted-foreground leading-relaxed">
                위 내용을 모두 확인했으며, 등록하는 자료가 <strong className="text-foreground">본인이 직접 작성·제작한 저작물</strong>로서 제3자의 저작권 등 권리를 침해하지 않음을 확인합니다. (
                <Link to="/terms" className="text-[#862633] hover:underline">이용약관</Link> 제12·19·20조)
              </span>
            </label>
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
