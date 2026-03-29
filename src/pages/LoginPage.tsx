import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    university: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { logIn, signUp, logInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(formData.email, formData.password, formData.name, formData.university);
      } else {
        await logIn(formData.email, formData.password);
      }
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await logInWithGoogle();
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" className="login-logo">
          <span className="login-logo-icon">U</span>
          <span>Univmarket</span>
        </Link>

        <h1>{isSignUp ? "회원가입" : "로그인"}</h1>
        <p className="login-subtitle">
          {isSignUp
            ? "Univmarket에 가입하고 자료를 거래하세요"
            : "계정에 로그인하세요"}
        </p>

        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <div className="form-group">
                <label htmlFor="name">이름</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="이름을 입력하세요"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="university">대학교</label>
                <input
                  type="text"
                  id="university"
                  name="university"
                  placeholder="대학교를 입력하세요"
                  value={formData.university}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="이메일을 입력하세요"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="비밀번호를 입력하세요"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "처리 중..." : isSignUp ? "가입하기" : "로그인"}
          </button>
        </form>

        <div className="login-divider">
          <span>또는</span>
        </div>

        <button
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Google로 계속하기
        </button>

        <p className="login-toggle">
          {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}{" "}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }}>
            {isSignUp ? "로그인" : "회원가입"}
          </button>
        </p>
      </div>
    </div>
  );
}

function getErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code;
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":
      return "유효하지 않은 이메일 형식입니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 합니다.";
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/too-many-requests":
      return "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
    case "auth/popup-closed-by-user":
      return "로그인 팝업이 닫혔습니다.";
    default:
      return "오류가 발생했습니다. 다시 시도해주세요.";
  }
}
