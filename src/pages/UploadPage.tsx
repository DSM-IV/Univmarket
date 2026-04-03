import { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { categories, departments, convergenceMajors, microDegrees, exchangeCountries } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, functions } from "../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Upload, X, CheckCircle, Image, AlertTriangle } from "lucide-react";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-hwp",
  "application/haansofthwp",
];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PREVIEWS = 5;

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

interface PreviewImage {
  file: File;
  url: string;
}

export default function UploadPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    subject: "",
    professor: "",
    department: "",
    price: "",
    pages: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateFile = (f: File): string | null => {
    if (f.size > MAX_SIZE) return "파일 크기는 50MB를 초과할 수 없습니다.";
    const ext = f.name.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "ppt", "pptx", "doc", "docx", "hwp"];
    if (!ext || (!validExts.includes(ext) && !ALLOWED_TYPES.includes(f.type))) {
      return "PDF, PPT, DOCX, HWP 파일만 업로드 가능합니다.";
    }
    return null;
  };

  const handleFile = async (f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
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
      handleFile(e.target.files[0]);
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

    if (!file) {
      setError("파일을 선택해주세요.");
      return;
    }

    if (previewImages.length === 0) {
      setError("미리보기 이미지를 최소 1장 첨부해주세요.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const getUploadUrl = httpsCallable<
        { fileName: string; contentType: string },
        { uploadUrl: string; fileUrl: string; key: string }
      >(functions, "getUploadUrl");

      // 자료 파일 업로드
      const { data } = await getUploadUrl({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
      });

      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      // 미리보기 이미지들 업로드
      const uploadedPreviewUrls: string[] = [];
      for (let i = 0; i < previewImages.length; i++) {
        const img = previewImages[i].file;
        const imgName = `preview_${Date.now()}_${i}.${img.name.split(".").pop()}`;
        const { data: imgData } = await getUploadUrl({
          fileName: imgName,
          contentType: img.type,
        });
        await fetch(imgData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": img.type },
          body: img,
        });
        uploadedPreviewUrls.push(imgData.fileUrl);
      }

      // Firestore에 자료 정보 저장
      await addDoc(collection(db, "materials"), {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        department: (formData.category === "수업" || formData.category === "이중전공 & 전과" || formData.category === "교환학생") ? formData.department : "",
        subject: formData.subject,
        professor: formData.professor,
        price: parseInt(formData.price),
        fileType: getFileTypeLabel(file),
        pages: formData.pages ? parseInt(formData.pages) : 0,
        fileUrl: data.fileUrl,
        fileKey: data.key,
        fileName: file.name,
        fileSize: file.size,
        thumbnail: uploadedPreviewUrls[0] || "",
        previewImages: uploadedPreviewUrls,
        author: userProfile?.nickname || user.displayName || user.email || "",
        authorId: user.uid,
        rating: 0,
        reviewCount: 0,
        salesCount: 0,
        createdAt: serverTimestamp(),
      });

      navigate("/browse");
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
        <p className="text-[15px] text-muted-foreground mb-9">
          내 자료를 올려 다른 학생들에게 판매해 보세요
        </p>

        <form className="flex flex-col gap-7" onSubmit={handleSubmit}>
          {/* 기본 정보 */}
          <Card>
            <CardContent className="p-7 max-sm:p-5">
              <h2 className="text-[17px] font-bold text-foreground mb-5 pb-3.5 border-b border-border tracking-tight">
                기본 정보
              </h2>

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
                  <label className="block text-[13px] font-semibold mb-2 text-foreground">
                    파일 형식
                  </label>
                  <Input
                    type="text"
                    value={file ? getFileTypeLabel(file) : "파일 업로드 시 자동 감지"}
                    disabled
                  />
                </div>
              </div>

              {(formData.category === "수업" || formData.category === "이중전공 & 전과" || formData.category === "교환학생") && (
                <div className="mb-4">
                  <label htmlFor="department" className="block text-[13px] font-semibold mb-2 text-foreground">
                    {formData.category === "교환학생" ? "국가" : "학과"} *
                  </label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-none rounded-lg text-sm bg-secondary text-foreground outline-none transition-colors focus:bg-muted focus:ring-2 focus:ring-[#862633]/30"
                  >
                    {formData.category === "교환학생" ? (
                      <>
                        <option value="">국가를 선택하세요</option>
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
                        <option value="">학과를 선택하세요</option>
                        <optgroup label="학과">
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </optgroup>
                        {formData.category === "이중전공 & 전과" && (
                          <>
                            <optgroup label="융합전공">
                              {convergenceMajors.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </optgroup>
                            <optgroup label="마이크로디그리">
                              {microDegrees.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </optgroup>
                          </>
                        )}
                      </>
                    )}
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 과목 정보 */}
          <Card>
            <CardContent className="p-7 max-sm:p-5">
              <h2 className="text-[17px] font-bold text-foreground mb-5 pb-3.5 border-b border-border tracking-tight">
                과목 정보
              </h2>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div>
                  <label htmlFor="subject" className="block text-[13px] font-semibold mb-2 text-foreground">
                    과목명 *
                  </label>
                  <Input
                    type="text"
                    id="subject"
                    name="subject"
                    placeholder="예: 운영체제"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="professor" className="block text-[13px] font-semibold mb-2 text-foreground">
                    교수명
                  </label>
                  <Input
                    type="text"
                    id="professor"
                    name="professor"
                    placeholder="예: 홍길동"
                    value={formData.professor}
                    onChange={handleChange}
                  />
                </div>
              </div>
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
                  파일 업로드 *
                </label>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg py-11 px-5 text-center cursor-pointer transition-colors bg-muted",
                    dragActive && "border-[#862633] bg-[#862633]/5",
                    !dragActive && !file && "border-border hover:border-[#862633]/40 hover:bg-[#862633]/5",
                    file && "border-solid border-green-500 bg-green-500/5"
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.hwp"
                    onChange={handleFileInput}
                    hidden
                  />
                  {file ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-[42px] h-[42px] bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-1">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-foreground text-[15px] break-all">{file.name}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {getFileTypeLabel(file)} · {formatFileSize(file.size)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2.5 text-[13px] text-muted-foreground hover:text-[#862633] hover:bg-[#862633]/5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        파일 변경
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto mb-2.5 text-muted-foreground/60" strokeWidth={1.5} />
                      <p className="text-sm text-muted-foreground">파일을 드래그하거나 클릭하여 업로드</p>
                      <p className="text-xs text-muted-foreground/60 mt-1.5">PDF, PPT, DOCX, HWP (최대 50MB)</p>
                    </>
                  )}
                </div>
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
