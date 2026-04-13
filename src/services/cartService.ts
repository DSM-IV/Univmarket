import { apiGet, apiPost, apiDelete } from "../api/client";

export interface CartItem {
  id: string;
  materialId: string;
  title: string;
  price: number;
  author: string;
  category: string;
  thumbnail: string;
  addedAt: string;
}

export async function getCartItems(_userId: string): Promise<CartItem[]> {
  return apiGet<CartItem[]>("/cart");
}

export async function addToCart(
  _userId: string,
  material: {
    id: string;
    title: string;
    price: number;
    author: string;
    category: string;
    thumbnail: string;
  }
): Promise<void> {
  await apiPost("/cart", {
    materialId: material.id,
    title: material.title,
    price: material.price,
    author: material.author,
    category: material.category,
    thumbnail: material.thumbnail || "",
  });
}

export async function removeFromCart(cartDocId: string): Promise<void> {
  await apiDelete(`/cart/${cartDocId}`);
}

export async function isInCart(
  _userId: string,
  materialId: string
): Promise<boolean> {
  const items = await getCartItems("");
  return items.some((item) => item.materialId === materialId);
}
