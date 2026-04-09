import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="max-w-[1140px] mx-auto px-6 pt-12 pb-8">
        {/* Brand */}
        <div className="mb-8">
          <div className="mb-2">
            <span className="font-bold text-[15px]">UniFile</span>
          </div>
          <p className="text-sm text-muted-foreground">
            대학생을 위한 공부자료 마켓플레이스
          </p>
        </div>

        <div className="flex items-center gap-4 pb-8 text-sm">
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">개인정보처리방침</Link>
          <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">이용약관</Link>
          <a href="https://www.instagram.com/unifile.official?igsh=ZWtpcWt3dXh3Ymdh&utm_source=qr" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">1:1 문의</a>
        </div>

        <Separator />

        {/* 사업자 정보 */}
        <div className="pt-6 pb-4 text-xs text-muted-foreground leading-relaxed space-y-1">
          <p>상호: UniFile | 대표: 장찬수 | 사업자등록번호: 883-12-02954</p>
          <p>소재지: 경기도 화성시 병점구 경기대로 1014, 603동 6층 127호(병점동, 병점프라자)</p>
          <p>이메일: UniFileService@gmail.com | 호스팅 서비스: Google Cloud (Firebase)</p>
          <p className="pt-2 text-muted-foreground/80">
            UniFile은 통신판매중개자로서 거래 당사자가 아니며, 판매자가 등록한 자료의 정보 및 거래에 대한 책임은 각 판매자에게 있습니다.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          &copy; 2026 UniFile. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
