import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export interface CartItem {
  id: string; // cart document id
  materialId: string;
  title: string;
  price: number;
  author: string;
  category: string;
  thumbnail: string;
  addedAt: string;
}

export async function getCartItems(userId: string): Promise<CartItem[]> {
  const q = query(
    collection(db, "carts"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    addedAt: d.data().addedAt?.toDate?.()?.toISOString?.() || "",
  })) as CartItem[];
}

export async function addToCart(
  userId: string,
  material: {
    id: string;
    title: string;
    price: number;
    author: string;
    category: string;
    thumbnail: string;
  }
): Promise<void> {
  // 이미 장바구니에 있는지 확인
  const existing = query(
    collection(db, "carts"),
    where("userId", "==", userId),
    where("materialId", "==", material.id)
  );
  const snap = await getDocs(existing);
  if (!snap.empty) return;

  await addDoc(collection(db, "carts"), {
    userId,
    materialId: material.id,
    title: material.title,
    price: material.price,
    author: material.author,
    category: material.category,
    thumbnail: material.thumbnail,
    addedAt: serverTimestamp(),
  });
}

export async function removeFromCart(cartDocId: string): Promise<void> {
  await deleteDoc(doc(db, "carts", cartDocId));
}

export async function isInCart(
  userId: string,
  materialId: string
): Promise<boolean> {
  const q = query(
    collection(db, "carts"),
    where("userId", "==", userId),
    where("materialId", "==", materialId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
