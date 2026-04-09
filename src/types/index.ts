export interface Material {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  university?: string;
  subject: string;
  professor?: string;
  department?: string;
  semester?: string;
  author: string;
  authorId: string;
  thumbnail: string;
  rating: number;
  reviewCount: number;
  salesCount: number;
  createdAt: string;
  pages: number;
  fileType: string;
  previewImages?: string[];
  gradeImage?: string;
  gradeClaim?: string;
  gradeStatus?: "pending" | "verified" | "rejected";
  verifiedGrade?: string;
}

export interface User {
  id: string;
  name: string;
  university: string;
  profileImage: string;
  salesCount: number;
  rating: number;
}

export type Category =
  | "수업"
  | "이중전공 & 전과"
  | "교환학생"
  | "장학금";

export interface UserProfile {
  displayName: string;
  nickname: string;
  email: string;
  university: string;
  points: number;
  earnings: number;
  pendingEarnings: number;
  pendingPoints: number;
  totalEarned: number;
  totalSpent: number;
  role?: string;
  identityVerified?: boolean;
  identityVerifiedAt?: string;
  banned?: boolean;
  banReason?: string;
  suspended?: boolean;
  suspendedUntil?: string;
  suspendReason?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "charge" | "purchase" | "sale" | "refund" | "withdraw";
  amount: number;
  balanceAfter: number;
  balanceType?: "points" | "earnings";
  description: string;
  relatedMaterialId?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}
