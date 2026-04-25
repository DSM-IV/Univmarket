import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import DetailPage from "./pages/DetailPage";
import UploadPage from "./pages/UploadPage";
import LoginPage from "./pages/LoginPage";
import ChargePage from "./pages/ChargePage";
import ChargeSuccessPage from "./pages/ChargeSuccessPage";
import CartPage from "./pages/CartPage";
import MyPage from "./pages/MyPage";
import ReportPage from "./pages/ReportPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import TransactionPage from "./pages/TransactionPage";
import AdminPage from "./pages/AdminPage";
import WithdrawPage from "./pages/WithdrawPage";
import KoreaUnivPage from "./pages/KoreaUnivPage";
import SnuPage from "./pages/SnuPage";
import YonseiPage from "./pages/YonseiPage";
import SogangPage from "./pages/SogangPage";
import SkkuPage from "./pages/SkkuPage";
import HanyangPage from "./pages/HanyangPage";
import CauPage from "./pages/CauPage";
import KhuPage from "./pages/KhuPage";
import HufsPage from "./pages/HufsPage";
import UosPage from "./pages/UosPage";
import NotFoundPage from "./pages/NotFoundPage";
import EventsPage from "./pages/EventsPage";
import EventRafflePage from "./pages/EventRafflePage";
import NoticesPage from "./pages/NoticesPage";
import SellerPage from "./pages/SellerPage";
import RequestDetailPage from "./pages/RequestDetailPage";

function SuspensionBanner() {
  const { userProfile } = useAuth();
  if (!userProfile?.suspended) return null;

  const until = userProfile.suspendedUntil
    ? new Date(userProfile.suspendedUntil).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="bg-amber-500 text-white text-center py-3 px-4 text-sm font-semibold">
      <p>
        계정이 일시 정지되었습니다.
        {userProfile.suspendReason && <> 사유: {userProfile.suspendReason}</>}
        {until && <> (해제 예정: {until})</>}
      </p>
      <p className="text-amber-100 text-xs mt-1">
        정지 기간 동안 자료 판매 및 일부 기능이 제한됩니다.
      </p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <SuspensionBanner />
          <Navbar />
          <ErrorBoundary>
            <Routes>
            <Route path="/" element={<KoreaUnivPage />} />
            {/* 클로즈드 베타 종료 후 복원 */}
            <Route path="/home" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/material/:id" element={<DetailPage />} />
            <Route path="/seller/:authorId" element={<SellerPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/charge" element={<ChargePage />} />
            <Route path="/charge/success" element={<ChargeSuccessPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/transactions" element={<TransactionPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/univ/korea" element={<KoreaUnivPage />} />
            <Route path="/univ/snu" element={<SnuPage />} />
            <Route path="/univ/yonsei" element={<YonseiPage />} />
            <Route path="/univ/sogang" element={<SogangPage />} />
            <Route path="/univ/skku" element={<SkkuPage />} />
            <Route path="/univ/hanyang" element={<HanyangPage />} />
            <Route path="/univ/cau" element={<CauPage />} />
            <Route path="/univ/khu" element={<KhuPage />} />
            <Route path="/univ/hufs" element={<HufsPage />} />
            <Route path="/univ/uos" element={<UosPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/request/:id" element={<RequestDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/closed-beta-raffle" element={<EventRafflePage />} />
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
