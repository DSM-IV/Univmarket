import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { categories } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, functions } from "../firebase";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./UploadPage.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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

async function generatePdfThumbnail(file: File): Promise<Blob | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  } catch (err) {
    console.error("썸네일 생성 실패:", err);
    return null;
  }
}

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [customPreview, setCustomPreview] = useState<File | null>(null);
  const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
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

    // PDF인 경우 썸네일 미리보기 생성
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      const blob = await generatePdfThumbnail(f);
      if (blob) {
        setThumbnailPreview(URL.createObjectURL(blob));
      }
    } else {
      setThumbnailPreview(null);
    }
  };

  // 미리보기 URL 정리
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

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

  const handlePreviewImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("미리보기 이미지는 5MB를 초과할 수 없습니다.");
      return;
    }
    setCustomPreview(f);
    setThumbnailPreview(URL.createObjectURL(f));
    setError("");
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

    if (!isPdf && !customPreview) {
      setError("미리보기 이미지를 첨부해주세요.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // R2 presigned URL 발급
      const getUploadUrl = httpsCallable<
        { fileName: string; contentType: string },
        { uploadUrl: string; fileUrl: string; key: string }
      >(functions, "getUploadUrl");

      const { data } = await getUploadUrl({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
      });

      // R2에 파일 직접 업로드
      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      // 썸네일 업로드 (PDF 자동 생성 또는 사용자 첨부)
      let thumbnailUrl = "";
      let thumbBlob: Blob | null = null;

      if (customPreview) {
        thumbBlob = customPreview;
      } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        thumbBlob = await generatePdfThumbnail(file);
      }

      if (thumbBlob) {
        const thumbFileName = `thumb_${Date.now()}.jpg`;
        const thumbContentType = customPreview ? customPreview.type : "image/jpeg";
        const { data: thumbData } = await getUploadUrl({
          fileName: thumbFileName,
          contentType: thumbContentType,
        });
        await fetch(thumbData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": thumbContentType },
          body: thumbBlob,
        });
        thumbnailUrl = thumbData.fileUrl;
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
        thumbnail: thumbnailUrl,
        author: user.displayName || user.email || "",
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
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} alt="미리보기" className="file-thumbnail-preview" />
                    ) : (
                      <span className="file-selected-icon">✓</span>
                    )}
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
                        setThumbnailPreview(null);
                        setCustomPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        if (previewInputRef.current) previewInputRef.current.value = "";
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

            {file && !isPdf && (
              <div className="form-group">
                <label>미리보기 이미지 *</label>
                <p className="preview-upload-hint">
                  PDF가 아닌 파일은 미리보기가 자동 생성되지 않습니다. 첫 페이지 캡처를 첨부해주세요.
                </p>
                <div
                  className="preview-upload-area"
                  onClick={() => previewInputRef.current?.click()}
                >
                  <input
                    ref={previewInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePreviewImage}
                    hidden
                  />
                  {thumbnailPreview ? (
                    <div className="preview-upload-selected">
                      <img src={thumbnailPreview} alt="미리보기" className="preview-upload-img" />
                      <button
                        type="button"
                        className="preview-upload-change"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomPreview(null);
                          setThumbnailPreview(null);
                          if (previewInputRef.current) previewInputRef.current.value = "";
                        }}
                      >
                        이미지 변경
                      </button>
                    </div>
                  ) : (
                    <div className="preview-upload-empty">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>클릭하여 미리보기 이미지 첨부</span>
                      <span className="preview-upload-sub">JPG, PNG (최대 5MB)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
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
