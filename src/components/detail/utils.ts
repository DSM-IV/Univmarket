import type { Material, MaterialFile } from "../../types";

export interface Review {
  id: string;
  userId: string;
  userName: string;
  materialId: string;
  rating: number;
  content: string;
  createdAt: string;
}

export function getRatingStats(reviews: Review[]) {
  const counts = [0, 0, 0, 0, 0]; // 1~5점
  reviews.forEach((r) => { counts[r.rating - 1]++; });
  const total = reviews.length;
  const avg = total > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
    : "0.0";
  return { counts, total, avg };
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)}${units[i]}`;
}

export function getFileList(material: Material): MaterialFile[] {
  const list = (material.files || []).filter((f) => f.fileKey);
  if (list.length > 0) return list;
  // 다중 파일이 도입되기 전 등록된 자료(레거시) — 대표 파일 1건으로 간주
  if (material.fileKey) {
    return [{
      fileKey: material.fileKey,
      fileName: material.fileName || material.title,
      fileSize: material.fileSize,
      fileType: material.fileType,
    }];
  }
  return [];
}
