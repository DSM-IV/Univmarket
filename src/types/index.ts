export interface Material {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  university?: string;
  subject: string;
  professor?: string;
  author: string;
  authorId: string;
  thumbnail: string;
  rating: number;
  reviewCount: number;
  salesCount: number;
  createdAt: string;
  pages: number;
  fileType: string;
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
  email: string;
  university: string;
  points: number;
  totalEarned: number;
  totalSpent: number;
  role?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "charge" | "purchase" | "sale" | "refund";
  amount: number;
  balanceAfter: number;
  description: string;
  relatedMaterialId?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}
