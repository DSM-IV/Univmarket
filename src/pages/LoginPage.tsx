import { useState } from "react";
import { Link } from "react-router-dom";
import "./LoginPage.css";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    university: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(isSignUp ? "회원가입 완료! (데모)" : "로그인 완료! (데모)");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" className="login-logo">
          <span className="login-logo-icon">U</span>
          <span>UniVmarket</span>
        </Link>

        <h1>{isSignUp ? "회원가입" : "로그인"}</h1>
        <p className="login-subtitle">
          {isSignUp
            ? "UniVmarket에 가입하고 자료를 거래하세요"
            : "계정에 로그인하세요"}
        </p>

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
            />
          </div>

          <button type="submit" className="btn-login">
            {isSignUp ? "가입하기" : "로그인"}
          </button>
        </form>

        <p className="login-toggle">
          {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}{" "}
          <button onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "로그인" : "회원가입"}
          </button>
        </p>
      </div>
    </div>
  );
}
