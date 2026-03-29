import { useState } from "react";
import { categories } from "../data/mockData";
import "./UploadPage.css";

export default function UploadPage() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    university: "",
    subject: "",
    price: "",
    fileType: "PDF",
    pages: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("자료가 등록되었습니다! (데모)");
  };

  return (
    <div className="upload">
      <div className="upload-inner">
        <h1 className="upload-title">자료 판매하기</h1>
        <p className="upload-subtitle">
          공부 자료를 올려 다른 학생들에게 판매해 보세요
        </p>

        <form className="upload-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>기본 정보</h2>
            <div className="form-group">
              <label htmlFor="title">자료 제목 *</label>
              <input
                type="text"
                id="title"
                name="title"
                placeholder="예: 운영체제 중간고사 완벽정리 노트"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">자료 설명 *</label>
              <textarea
                id="description"
                name="description"
                placeholder="자료에 대한 상세한 설명을 작성해 주세요"
                rows={5}
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">카테고리 *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">선택하세요</option>
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="fileType">파일 형식 *</label>
                <select
                  id="fileType"
                  name="fileType"
                  value={formData.fileType}
                  onChange={handleChange}
                >
                  <option value="PDF">PDF</option>
                  <option value="PPT">PPT</option>
                  <option value="DOCX">DOCX</option>
                  <option value="HWP">HWP</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>학교 / 과목 정보</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="university">대학교 *</label>
                <input
                  type="text"
                  id="university"
                  name="university"
                  placeholder="예: 서울대학교"
                  value={formData.university}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="subject">과목 분야 *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="예: 컴퓨터공학"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>가격 및 파일</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price">판매 가격 (원) *</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  placeholder="예: 3000"
                  min="0"
                  value={formData.price}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="pages">페이지 수</label>
                <input
                  type="number"
                  id="pages"
                  name="pages"
                  placeholder="예: 42"
                  min="1"
                  value={formData.pages}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>파일 업로드 *</label>
              <div className="file-upload">
                <div className="file-upload-area">
                  <span className="file-icon">📎</span>
                  <p>파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="file-hint">PDF, PPT, DOCX, HWP (최대 50MB)</p>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-submit">
            자료 등록하기
          </button>
        </form>
      </div>
    </div>
  );
}
