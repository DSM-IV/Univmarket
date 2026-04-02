import { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { categories } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, functions } from "../firebase";
import "./UploadPage.css";

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
      <div className="upload">
        <div className="upload-inner">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="upload">
      <div className="upload-inner">
        <h1 className="upload-title">자료 판매하기</h1>
        <p className="upload-subtitle">
          공부 자료를 올려 다른 학생들에게 판매해 보세요
        </p>

        <form className="upload-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>기본 정보</h2>
            <div className="form-group">
              <label htmlFor="title">자료 제목 *</label>
              <input
                type="text"
                id="title"
                name="title"
                placeholder="예: 운영체제 중간고사 완벽정리 노트"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">자료 설명 *</label>
              <textarea
                id="description"
                name="description"
                placeholder="자료에 대한 상세한 설명을 작성해 주세요"
                rows={5}
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">카테고리 *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">선택하세요</option>
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>파일 형식</label>
                <input
                  type="text"
                  value={file ? getFileTypeLabel(file) : "파일 업로드 시 자동 감지"}
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>과목 정보</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="subject">과목명 *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="예: 운영체제"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="professor">교수명</label>
                <input
                  type="text"
                  id="professor"
                  name="professor"
                  placeholder="예: 홍길동"
                  value={formData.professor}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>가격 및 파일</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price">판매 가격 (P) *</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  placeholder="예: 3000"
                  min="0"
                  value={formData.price}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="pages">페이지 수</label>
                <input
                  type="number"
                  id="pages"
                  name="pages"
                  placeholder="예: 42"
                  min="1"
                  value={formData.pages}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>파일 업로드 *</label>
              <div
                className={`file-upload-area ${dragActive ? "drag-active" : ""} ${file ? "has-file" : ""}`}
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
                  <div className="file-selected">
                    <span className="file-selected-icon">✓</span>
                    <p className="file-selected-name">{file.name}</p>
                    <p className="file-selected-info">
                      {getFileTypeLabel(file)} · {formatFileSize(file.size)}
                    </p>
                    <button
                      type="button"
                      className="file-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      파일 변경
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="file-icon">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </span>
                    <p>파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="file-hint">PDF, PPT, DOCX, HWP (최대 50MB)</p>
                  </>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>미리보기 이미지 * ({previewImages.length}/{MAX_PREVIEWS})</label>
              <p className="preview-upload-hint">
                자료의 내용을 확인할 수 있는 이미지를 첨부해주세요. 첫 번째 이미지가 대표 미리보기로 사용됩니다.
              </p>

              {previewImages.length > 0 && (
                <div className="preview-image-list">
                  {previewImages.map((img, idx) => (
                    <div key={idx} className="preview-image-item">
                      <img src={img.url} alt={`미리보기 ${idx + 1}`} />
                      {idx === 0 && <span className="preview-image-badge">대표</span>}
                      <button
                        type="button"
                        className="preview-image-remove"
                        onClick={() => removePreviewImage(idx)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {previewImages.length < MAX_PREVIEWS && (
                <div
                  className="preview-upload-area"
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
                  <div className="preview-upload-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>클릭하여 미리보기 이미지 첨부</span>
                    <span className="preview-upload-sub">JPG, PNG (최대 5MB, {MAX_PREVIEWS}장까지)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="copyright-banner">
            <div className="copyright-banner-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="copyright-banner-content">
              <strong>저작권 관련 주의사항</strong>
              <ul>
                <li>타인의 저작물(교재, 논문, 강의자료 등)을 무단으로 복제하여 업로드하지 마세요.</li>
                <li>본인이 직접 작성한 자료만 판매할 수 있습니다.</li>
                <li>저작권 침해 자료는 사전 통보 없이 삭제될 수 있으며, 법적 책임은 업로더에게 있습니다.</li>
              </ul>
            </div>
          </div>

          {error && <p className="upload-error">{error}</p>}

          <button type="submit" className="btn-submit" disabled={uploading}>
            {uploading ? "업로드 중..." : "자료 등록하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
