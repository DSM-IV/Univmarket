import { Link } from "react-router-dom";
import "./NotFoundPage.css";

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <h1 className="not-found-heading">페이지를 찾을 수 없습니다</h1>
      <p className="not-found-desc">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <Link to="/" className="not-found-link">홈으로 돌아가기</Link>
    </div>
  );
}
