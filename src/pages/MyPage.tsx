import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, getDocs, documentId } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Material } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Download, FileText, Upload, ShoppingBag } from "lucide-react";

type Tab = "uploaded" | "purchased";

export default function MyPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("uploaded");
  const [uploadedMaterials, setUploadedMaterials] = useState<Material[]>([]);
  const [purchasedMaterials, setPurchasedMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        // 내가 올린 자료
        const uploadedQuery = query(
          collection(db, "materials"),
          where("authorId", "==", user!.uid),
          orderBy("createdAt", "desc")
        );
        const uploadedSnap = await getDocs(uploadedQuery);
        setUploadedMaterials(
          uploadedSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
          })) as Material[]
        );

        // 내가 구매한 자료
        const purchasesQuery = query(
          collection(db, "purchases"),
          where("buyerId", "==", user!.uid)
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        const materialIds = purchasesSnap.docs.map((d) => d.data().materialId);

        if (materialIds.length > 0) {
          const materialsData: Material[] = [];
          // Firestore "in" queries support max 30 items, so batch the IDs
          for (let i = 0; i < materialIds.length; i += 30) {
            const batch = materialIds.slice(i, i + 30);
            const batchQuery = query(
              collection(db, "materials"),
              where(documentId(), "in", batch)
            );
            const batchSnap = await getDocs(batchQuery);
            for (const snap of batchSnap.docs) {
              materialsData.push({
                id: snap.id,
                ...snap.data(),
                createdAt: snap.data().createdAt?.toDate?.()?.toISOString?.() || "",
              } as Material);
            }
          }
          setPurchasedMaterials(materialsData);
        }
      } catch (err) {
        console.error("데이터 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, authLoading, navigate]);

  const handleDownload = async (materialId: string) => {
    setDownloading(materialId);
    try {
      const getDownloadUrl = httpsCallable<
        { materialId: string },
        { downloadUrl: string }
      >(functions, "getDownloadUrl");
      const { data } = await getDownloadUrl({ materialId });
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("다운로드에 실패했습니다. 다시 시도해주세요.");
      console.error("다운로드 실패:", err);
    } finally {
      setDownloading(null);
    }
  };

  if (authLoading) return <p className="py-20 text-center text-gray-500">불러오는 중...</p>;
  if (!user) return null;

  const currentList = tab === "uploaded" ? uploadedMaterials : purchasedMaterials;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center gap-5 p-6 max-sm:p-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#862633] text-2xl font-bold text-white">
              {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-gray-900">
                {user.displayName || user.email}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                {userProfile?.university || ""}
              </p>
            </div>
            <div className="flex gap-6 max-sm:gap-3 text-center">
              <Link to="/transactions" className="group no-underline">
                <span className="block text-lg font-bold text-[#862633] group-hover:underline">
                  {userProfile?.points?.toLocaleString() || 0}P
                </span>
                <span className="text-xs text-gray-500">보유 포인트</span>
              </Link>
              <div>
                <span className="block text-lg font-bold text-gray-900">
                  {uploadedMaterials.length}
                </span>
                <span className="text-xs text-gray-500">등록 자료</span>
              </div>
              <div>
                <span className="block text-lg font-bold text-gray-900">
                  {purchasedMaterials.length}
                </span>
                <span className="text-xs text-gray-500">구매 자료</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="mb-4 flex border-b border-gray-200">
          <button
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "uploaded"
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setTab("uploaded")}
          >
            <Upload className="mr-1.5 inline-block h-4 w-4" />
            내가 올린 자료
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "purchased"
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setTab("purchased")}
          >
            <ShoppingBag className="mr-1.5 inline-block h-4 w-4" />
            구매한 자료
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <p className="py-16 text-center text-gray-500">불러오는 중...</p>
        ) : currentList.length > 0 ? (
          <div className="space-y-3">
            {currentList.map((m) => (
              <Card key={m.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <Link
                    to={`/material/${m.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Badge variant="outline" className="text-xs">
                        {m.fileType}
                      </Badge>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {m.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {m.subject}
                        {m.professor ? ` · ${m.professor} 교수` : ""} ·{" "}
                        {m.price.toLocaleString()}P
                      </p>
                    </div>
                  </Link>
                  <div className="shrink-0">
                    {tab === "purchased" && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(m.id)}
                        disabled={downloading === m.id}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {downloading === m.id ? "준비 중..." : "다운로드"}
                      </Button>
                    )}
                    {tab === "uploaded" && (
                      <span className="text-xs text-gray-500">
                        판매 {m.salesCount || 0}건
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <FileText className="mx-auto mb-3 h-10 w-10" />
            <p>{tab === "uploaded" ? "등록한 자료가 없습니다." : "구매한 자료가 없습니다."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
