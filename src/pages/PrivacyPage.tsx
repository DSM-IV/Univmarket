import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import PrivacyContent from "@/components/legal/PrivacyContent";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-gray-900">개인정보처리방침</h1>
        <p className="mt-1 text-sm text-gray-400">시행일: 2026년 4월 4일 | 버전: v1.1</p>

        <Separator className="my-6" />

        <PrivacyContent />

        <Separator className="my-6" />

        <div className="flex gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/terms">이용약관</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/report">저작권 침해 신고</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
