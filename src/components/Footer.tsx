import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="max-w-[1140px] mx-auto px-6 pt-12 pb-8">
        {/* Brand */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 bg-primary text-white rounded-md flex items-center justify-center font-extrabold text-sm">
              K
            </span>
            <span className="font-bold text-[15px]">KU market</span>
          </div>
          <p className="text-sm text-muted-foreground">
            대학생을 위한 공부자료 마켓플레이스
          </p>
        </div>

        {/* Links */}
        <div className="grid grid-cols-3 gap-8 pb-8 max-sm:grid-cols-1 max-sm:gap-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-3">서비스</h4>
            <div className="flex flex-col gap-1">
              <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">자료 찾기</Link>
              <Link to="/upload" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">자료 판매하기</Link>
              <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">인기 자료</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-3">고객지원</h4>
            <div className="flex flex-col gap-1">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">자주 묻는 질문</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">1:1 문의</a>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">이용약관</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-3">회사</h4>
            <div className="flex flex-col gap-1">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">소개</a>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">개인정보처리방침</Link>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">공지사항</a>
            </div>
          </div>
        </div>

        <Separator />

        <p className="text-center text-xs text-muted-foreground pt-6">
          &copy; 2026 KU market. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
