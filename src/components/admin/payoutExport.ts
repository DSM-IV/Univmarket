import { apiGet, apiDownload } from "../../api/client";
import type { useDialog } from "../../contexts/DialogContext";

type Dialog = ReturnType<typeof useDialog>;

interface PayoutPreview {
  included: {
    transactionId: number;
    userId: number;
    submallId: string;
    amount: number;
    accountHolder: string;
  }[];
  excluded: { transactionId: number; reason: string }[];
}

/** 내일 날짜 (yyyy-MM-dd) — 지급일 기본값. */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 이니시스 지급파일 내보내기 플로우:
 * 지급일 입력 → 미리보기 요약 확인 → EUC-KR txt 다운로드.
 */
export async function runPayoutExport(dialog: Dialog): Promise<void> {
  const payDate = await dialog.prompt({
    title: "지급일 입력",
    description: "지급데이터의 지급일(yyyy-MM-dd)을 입력하세요. 금융기관 영업일이어야 합니다.",
    defaultValue: tomorrowIso(),
    required: true,
  });
  if (payDate === null) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
    void dialog.alert({ description: "지급일 형식이 올바르지 않습니다. (yyyy-MM-dd)" });
    return;
  }

  let preview: PayoutPreview;
  try {
    preview = await apiGet<PayoutPreview>(
      `/admin/payouts/export/preview?payDate=${encodeURIComponent(payDate)}`
    );
  } catch {
    void dialog.alert({ description: "지급 대상을 불러오는 데 실패했습니다." });
    return;
  }

  const included = preview.included ?? [];
  const excluded = preview.excluded ?? [];

  if (included.length === 0) {
    void dialog.alert({
      title: "지급 대상 없음",
      description:
        `지급 가능한 출금 건이 없습니다.\n제외 ${excluded.length}건` +
        (excluded.length > 0
          ? "\n" + excluded.map((e) => `- #${e.transactionId}: ${e.reason}`).join("\n")
          : ""),
    });
    return;
  }

  const total = included.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const excludedLines =
    excluded.length > 0
      ? "\n\n제외 " +
        excluded.length +
        "건\n" +
        excluded.map((e) => `- #${e.transactionId}: ${e.reason}`).join("\n")
      : "\n\n제외 0건";

  const ok = await dialog.confirm({
    title: "이니시스 지급파일 생성",
    description:
      `지급일 ${payDate}\n포함 ${included.length}건 · 총 지급액 ${total.toLocaleString()}원` +
      excludedLines,
    confirmText: "다운로드",
  });
  if (!ok) return;

  const fileDate = payDate.replace(/-/g, "");
  try {
    await apiDownload(
      `/admin/payouts/export/payout-data?payDate=${encodeURIComponent(payDate)}`,
      `payout_${fileDate}.txt`
    );
  } catch {
    void dialog.alert({ description: "지급파일 다운로드에 실패했습니다." });
  }
}
