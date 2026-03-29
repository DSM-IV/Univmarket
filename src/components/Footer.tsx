import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">U</span>
          <span className="footer-name">UniVmarket</span>
          <p className="footer-desc">대학생을 위한 공부자료 마켓플레이스</p>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <h4>서비스</h4>
            <a href="#">자료 둘러보기</a>
            <a href="#">자료 판매하기</a>
            <a href="#">인기 자료</a>
          </div>
          <div className="footer-col">
            <h4>고객지원</h4>
            <a href="#">자주 묻는 질문</a>
            <a href="#">1:1 문의</a>
            <a href="#">이용약관</a>
          </div>
          <div className="footer-col">
            <h4>회사</h4>
            <a href="#">소개</a>
            <a href="#">개인정보처리방침</a>
            <a href="#">공지사항</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 UniVmarket. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
