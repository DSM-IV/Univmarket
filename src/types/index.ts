export interface Material {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  university: string;
  subject: string;
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
  | "노트정리"
  | "시험족보"
  | "과제/레포트"
  | "발표자료"
  | "요약본"
  | "기타";
