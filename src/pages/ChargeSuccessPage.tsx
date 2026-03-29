import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./ChargePage.css";

export default function ChargeSuccessPage() {
  const [searchParams] = useSearchParams();
  const amount = parseInt(searchParams.get("amount") || "0");
  const { userProfile } = useAuth();

  return (
    <div className="charge-success">
      <div className="success-card">
        <div className="success-icon">✓</div>
        <h1>충전 완료!</h1>
        <p>포인트가 성공적으로 충전되었습니다.</p>
        <div className="success-amount">
          +{amount.toLocaleString()}P
        </div>
        <p>현재 잔액: {(userProfile?.points ?? 0).toLocaleString()}P</p>
        <div className="success-links">
          <Link to="/browse">자료 둘러보기</Link>
          <Link to="/charge">추가 충전</Link>
        </div>
      </div>
    </div>
  );
}
