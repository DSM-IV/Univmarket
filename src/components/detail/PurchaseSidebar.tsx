import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { apiPost, apiDelete } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { startCheckout } from "../../services/checkoutService";
import { addToCart, isInCart } from "../../services/cartService";
import type { Material } from "../../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, ShoppingCart } from "lucide-react";
import { getFileList, formatBytes } from "./utils";

function DownloadSection({
  material,
  downloading,
  onDownload,
}: {
  material: Material;
  downloading: boolean;
  onDownload: (fileKey?: string) => void;
}) {
  const list = getFileList(material);
  if (list.length === 0) {
    return (
      <Button
        className="w-full mb-2.5 bg-success hover:bg-success/90 text-white"
        size="lg"
        onClick={() => onDownload()}
        disabled={downloading}
      >
        <Download className="w-4 h-4 mr-1" />
        {downloading ? "준비 중..." : "다운로드"}
      </Button>
    );
  }
  return (
    <div className="mb-2.5 space-y-2">
      <p className="text-[12px] font-semibold text-muted-foreground">
        포함된 파일 {list.length}개
      </p>
      {list.map((f, idx) => (
        <div
          key={`${f.fileKey}-${idx}`}
          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">{f.fileName || `파일 ${idx + 1}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {[f.fileType, formatBytes(f.fileSize)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-success hover:bg-success/90 text-white"
            onClick={() => onDownload(f.fileKey || undefined)}
            disabled={downloading}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            다운로드
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function PurchaseSidebar({ material, owned }: { material: Material; owned: boolean }) {
  const { user, userProfile } = useAuth();
  const dialog = useDialog();
  const navigate = useNavigate();
  const location = useLocation();

  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (user && material) {
      isInCart(user.uid, material.id).then(setInCart);
    }
  }, [user, material]);

  const handleDownload = async (fileKey?: string) => {
    setDownloading(true);
    try {
      const data = await apiPost<{ downloadUrl: string }>(
        `/materials/${material.id}/download-url`,
        fileKey ? { fileKey } : undefined
      );
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      void dialog.alert({ description: "다운로드에 실패했습니다. 다시 시도해주세요." });
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!(await dialog.confirm({ title: "자료 삭제", description: "정말 이 자료를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.", confirmText: "삭제", destructive: true }))) return;
    setDeleting(true);
    try {
      await apiDelete(`/materials/${material.id}`);
      navigate("/mypage");
    } catch {
      void dialog.alert({ description: "자료 삭제에 실패했습니다." });
      setDeleting(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    setAddingToCart(true);
    try {
      await addToCart(user.uid, {
        id: material.id,
        title: material.title,
        price: material.price,
        author: material.author,
        category: material.category,
        thumbnail: material.thumbnail,
      });
      setInCart(true);
    } catch (err) {

    } finally {
      setAddingToCart(false);
    }
  };

  const handleDirectPurchase = async () => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    try {
      await startCheckout([material.id], {
        customerKey: user.uid,
        customerName: userProfile?.nickname,
        customerEmail: userProfile?.email,
      });
    } catch (err) {
      const msg = (err as Error).message || "결제를 시작할 수 없습니다.";
      void dialog.alert({ description: msg });
    }
  };

  return (
    <aside className="max-md:order-none">
      <Card className="sticky top-[84px] max-md:static">
        <CardContent className="p-7">
          <div className="text-[32px] font-extrabold tracking-tight mb-5 max-md:text-[28px]">
            {material.price.toLocaleString()}
            <span className="text-lg font-medium text-muted-foreground">원</span>
          </div>
          {material.authorId === user?.uid ? (
            <>
              <p className="text-center text-[13px] text-success font-medium mb-2.5">내가 등록한 자료입니다</p>
              <DownloadSection
                material={material}
                downloading={downloading}
                onDownload={handleDownload}
              />
              <Button
                variant="ghost"
                className="w-full bg-destructive/5 text-destructive hover:bg-destructive/10 mt-2.5 mb-2.5"
                onClick={handleDeleteMaterial}
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </Button>
            </>
          ) : owned ? (
            <>
              <DownloadSection
                material={material}
                downloading={downloading}
                onDownload={handleDownload}
              />
              <p className="text-center text-[13px] text-success font-medium mb-2.5">구매 완료된 자료입니다</p>
            </>
          ) : (
            <>
              <div className="mb-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900">
                결제 시 <span className="font-semibold">환불·청약철회 정책</span>에 동의하는 것으로 간주됩니다. 자료를 <span className="font-semibold">다운로드하면 청약철회가 제한</span>됩니다.{" "}
                <Link to="/terms" className="underline hover:no-underline">자세히</Link>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full mb-2.5"
                onClick={handleDirectPurchase}
              >
                바로 구매
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full mb-4"
                onClick={inCart ? () => navigate("/cart") : handleAddToCart}
                disabled={addingToCart}
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                {addingToCart ? "추가 중..." : inCart ? "장바구니 보기" : "장바구니에 담기"}
              </Button>
            </>
          )}
          <Separator className="my-4" />
          <div className="space-y-1">
            <p className="text-[13px] text-muted-foreground">{owned ? "파일을 다운로드할 수 있습니다" : "구매 후 즉시 다운로드 가능"}</p>
          </div>
          {owned && material.authorId !== user?.uid && (
            <Link
              to={`/report?type=defect&materialId=${material.id}&title=${encodeURIComponent(material.title)}`}
              className="block text-center py-2 mt-3 text-[13px] text-amber-700 font-medium transition-colors hover:text-amber-900"
            >
              자료 하자 신고
            </Link>
          )}
          <Link
            to={`/report?materialId=${material.id}&title=${encodeURIComponent(material.title)}`}
            className="block text-center py-2 mt-1 text-[13px] text-muted-foreground transition-colors hover:text-destructive"
          >
            저작권 침해 신고
          </Link>
        </CardContent>
      </Card>
    </aside>
  );
}
