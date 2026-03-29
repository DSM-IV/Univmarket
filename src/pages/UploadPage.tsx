import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    university: "",
    subject: "",
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

  const handleFile = (f: File) => {
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

      // Firestore에 자료 정보 저장
      await addDoc(collection(db, "materials"), {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        university: formData.university,
        subject: formData.subject,
        price: parseInt(formData.price),
        fileType: getFileTypeLabel(file),
        pages: formData.pages ? parseInt(formData.pages) : 0,
        fileUrl: data.fileUrl,
        fileKey: data.key,
        fileName: file.name,
        fileSize: file.size,
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
            <h2>학교 / 과목 정보</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="university">대학교 *</label>
                <input
                  type="text"
                  id="university"
                  name="university"
                  placeholder="예: 서울대학교"
                  value={formData.university}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="subject">과목 분야 *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="예: 컴퓨터공학"
                  value={formData.subject}
                  onChange={handleChange}
                  required
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
