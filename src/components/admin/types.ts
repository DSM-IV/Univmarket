export interface Report {
  id: string;
  materialId: string;
  materialTitle: string;
  type?: "copyright" | "defect";
  reason: string;
  originalSource: string;
  description: string;
  contactEmail: string;
  isRightsHolder: boolean;
  reporterId: string | null;
  reporterName: string;
  purchaseId?: string | null;
  status: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  commission: number;
  tax: number;
  totalDeduction: number;
  received: number;
  bankName: string;
  accountNumber: string;
  realAccountNumber?: string;
  accountHolder: string;
  status: string;
  description: string;
  createdAt: string;
}

export interface GradeRequest {
  id: string;
  title: string;
  subject: string;
  author: string;
  authorId: string;
  gradeClaim: string;
  gradeImage: string;
  gradeStatus: string;
  createdAt: string;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
