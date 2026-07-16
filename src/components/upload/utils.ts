export function getFileTypeLabel(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase() || "";
  if (ext === "PPTX" || ext === "PPT") return "PPT";
  if (ext === "DOCX" || ext === "DOC") return "DOCX";
  if (ext === "HWP") return "HWP";
  if (ext === "PDF") return "PDF";
  return ext || "기타";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// R2 키에 안전한 파일명으로 정리 (한글/공백/괄호 등 제거)
export function sanitizeFileName(name: string): string {
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

export interface PreviewImage {
  file: File;
  url: string;
}

export interface UploadFormData {
  title: string;
  description: string;
  category: string;
  subType: string;
  subject: string;
  professor: string;
  department: string;
  semester: string;
  price: string;
  pages: string;
}
