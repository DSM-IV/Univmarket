import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white py-8">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-gray-900">개인정보처리방침</h1>
        <p className="mt-1 text-sm text-gray-400">시행일: 2026년 4월 4일 | 버전: v1.1</p>

        <Separator className="my-6" />

        <div className="prose prose-sm prose-gray max-w-none [&_article]:mb-6 [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:mb-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-gray-600 [&_section]:mb-8 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
          <section>
            <p>
              UniFile(이하 "회사")은 귀하의 개인정보보호를 매우 중요시하며,
              「개인정보보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」,
              「통신비밀보호법」, 「전기통신사업법」 등 정보통신서비스제공자가 준수하여야 할
              관련 법령상의 개인정보보호 규정을 준수하고 있습니다.
            </p>
            <p>
              회사는 본 개인정보처리방침을 통하여 귀하께서 제공하시는 개인정보가 어떠한
              용도와 방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한 조치가 취해지고
              있는지 알려 드립니다.
            </p>
          </section>

          <section>
            <h2>제 1 조 (개인정보의 수집범위)</h2>
            <p>
              회사는 회원에게 맞춤형 서비스를 제공하기 위하여 회원서비스(유료 정보 등의 이용,
              그 밖에 향후 제공될 로그인 기반의 서비스) 및 제휴사를 통해 이용자의 정보를
              수집하고 있습니다. 회원제 서비스를 이용하시고자 할 경우 다음의 정보를 입력해주셔야 합니다.
            </p>

            <article>
              <h3>회원 가입 시 수집하는 개인정보의 범위</h3>
              <ul>
                <li><strong>필수항목:</strong> ID, 비밀번호, 닉네임, 학교명, 학교 이메일 주소</li>
                <li>소셜 로그인 이용 시 아이디, 비밀번호를 수집하지 않음</li>
              </ul>
            </article>

            <article>
              <h3>결제서비스 이용 시 수집하는 개인정보</h3>
              <ul>
                <li>회원 가입 시 수집한 정보와 동일</li>
                <li>결제방법에 따라 결제 창에 입력하는 개인정보는 결제대행사에 기록될 뿐 회사에 기록되지 않음</li>
              </ul>
            </article>

            <article>
              <h3>본인인증 시 수집하는 개인정보의 범위</h3>
              <ul>
                <li><strong>필수항목:</strong> 이름(실명), 생년월일, 휴대폰 번호</li>
                <li>최초 출금 시 1회 수집하며, 휴대폰 번호는 마스킹 처리하여 저장</li>
                <li>마지막 출금일로부터 5년 경과 시 재인증 필요</li>
              </ul>
            </article>

            <article>
              <h3>자료 판매금액 출금 시 수집하는 개인정보의 범위</h3>
              <ul>
                <li><strong>필수항목:</strong> 은행명, 계좌번호, 예금주명</li>
                <li>계좌번호는 마스킹 처리하여 저장하며, 원본은 별도 보안 저장소에 암호화 보관</li>
                <li>출금 처리 완료 후 90일 경과 시 원본 계좌 정보 파기</li>
              </ul>
            </article>

            <article>
              <h3>서비스 이용과정에서의 자동생성 정보</h3>
              <ul>
                <li>서비스 이용기록, 접속로그, 쿠키, 접속 IP정보, 결제기록, 이용정지기록</li>
              </ul>
            </article>
          </section>

          <section>
            <h2>제 2 조 (개인정보 수집에 대한 동의)</h2>
            <p>
              회사는 귀하께서 회사의 개인정보처리방침 또는 이용약관의 내용에 대해 「동의한다」
              버튼 또는 「동의하지 않는다」 버튼을 클릭할 수 있는 절차를 마련하여,
              「동의한다」 버튼을 클릭하면 개인정보 수집에 대해 동의한 것으로 봅니다.
            </p>
          </section>

          <section>
            <h2>제 3 조 (개인정보의 수집목적 및 이용목적)</h2>
            <p>회사는 다음과 같은 목적을 위하여 개인정보를 수집하고 있습니다.</p>
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-900">수집 항목</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-900">이용 목적</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-gray-100 [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-gray-600">
                  <tr>
                    <td>아이디, 비밀번호, 닉네임</td>
                    <td>회원제 서비스 이용에 따른 본인 식별 절차에 이용</td>
                  </tr>
                  <tr>
                    <td>학교명, 학교 이메일주소</td>
                    <td>재학생 이용을 위한 본인 인증 절차에 이용</td>
                  </tr>
                  <tr>
                    <td>이름, 생년월일, 휴대폰 번호</td>
                    <td>출금 시 본인인증 확인 (최초 1회)</td>
                  </tr>
                  <tr>
                    <td>은행명, 계좌번호, 예금주명</td>
                    <td>출금 회원에 한하여 입금 처리를 위해 수집 (마스킹 저장)</td>
                  </tr>
                  <tr>
                    <td>서비스 이용기록, 접속로그 등</td>
                    <td>통계학적 특성에 따른 서비스 제공, 서비스의 유효성 확인,
                      접속빈도 파악, 회원의 서비스이용에 대한 통계</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2>제 4 조 (제3자에 대한 제공 및 공유)</h2>
            <p>
              회사는 이용자들의 개인정보를 제3조에서 고지한 범위 내에서 사용하며,
              이용자의 사전 동의 없이는 동 범위를 초과하여 이용하거나 원칙적으로
              이용자의 개인정보를 외부에 공개하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ol>
              <li>
                <strong>이용자가 사전에 동의한 경우</strong>
                <p>
                  서비스의 제공을 위해 별도로 타사와 개인정보를 공유하거나 제공할 상황이
                  발생할 경우, 회사는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 및
                  본 개인정보처리방침에 따라 회원에게 사전에 고지하거나 동의를 받습니다.
                </p>
              </li>
              <li>
                <strong>법령의 규정에 의한 경우</strong>
                <p>
                  법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라
                  수사기관의 요구가 있는 경우
                </p>
              </li>
            </ol>
          </section>

          <section>
            <h2>제 5 조 (개인정보의 열람, 정정)</h2>
            <ol>
              <li>
                귀하는 언제든지 등록되어 있는 귀하의 개인정보를 열람하거나 정정하실 수 있습니다.
                개인정보 열람 및 정정을 하고자 할 경우에는 마이페이지에서 직접 열람 또는
                정정하거나, 개인정보관리책임자에게 서면, 전화 또는 이메일로 연락하시면 조치하겠습니다.
              </li>
              <li>
                귀하가 개인정보의 오류에 대한 정정을 요청한 경우, 정정을 완료하기 전까지
                당해 개인정보를 이용 또는 제공하지 않습니다.
              </li>
              <li>
                잘못된 개인정보를 제3자에게 이미 제공한 경우에는 정정 처리결과를 제3자에게
                지체 없이 통지하여 정정하도록 조치하겠습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2>제 6 조 (개인정보 수집·이용·제공에 대한 동의철회)</h2>
            <ol>
              <li>
                회원가입 등을 통해 개인정보의 수집, 이용, 제공에 대해 귀하께서 동의하신
                내용을 귀하는 언제든지 철회하실 수 있습니다.
              </li>
              <li>
                동의철회는 마이페이지에서 회원탈퇴를 클릭하거나 개인정보관리책임자에게
                이메일 등으로 연락하시면, 회원탈퇴 신청 시점으로부터 90일 동안 재가입
                방지를 위한 개인정보보존 이후 개인정보의 삭제 등 필요한 조치를 하겠습니다.
              </li>
              <li>
                동의 철회를 하고 개인정보를 파기하는 등의 조치를 취한 경우에는 그 사실을
                귀하께 지체 없이 통지하도록 하겠습니다.
              </li>
              <li>
                회사는 개인정보의 수집에 대한 동의철회(회원탈퇴)를 개인정보를 수집하는
                방법보다 쉽게 할 수 있도록 필요한 조치를 취하겠습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2>제 7 조 (개인정보의 보유기간 및 이용기간)</h2>
            <p>
              회원님의 개인정보는 개인정보의 수집목적 또는 제공받은 목적이 달성되면
              지체 없이 파기합니다. 파기 방법은 다음과 같습니다.
            </p>
            <ul>
              <li><strong>종이에 출력된 개인정보:</strong> 분쇄기로 분쇄하거나 소각</li>
              <li><strong>전자적 파일 형태로 저장된 개인정보:</strong> 기록을 재사용할 수 없는 기술적 방법을 사용하여 삭제</li>
            </ul>
            <p>
              단, 관련법령의 규정에 의하여 거래 관련 권리 의무 관계의 확인 등을 이유로
              일정기간 보유하여야 할 필요가 있을 경우에는 다음과 같이 보유합니다.
            </p>
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-900">보유 정보</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-900">보유 기간</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-900">근거</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-gray-100 [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-gray-600">
                  <tr>
                    <td>계약 또는 청약철회 등에 관한 기록</td>
                    <td>5년</td>
                    <td>전자상거래법</td>
                  </tr>
                  <tr>
                    <td>대금결제 및 재화 등의 공급에 관한 기록</td>
                    <td>5년</td>
                    <td>전자상거래법</td>
                  </tr>
                  <tr>
                    <td>소비자의 불만 또는 분쟁처리에 관한 기록</td>
                    <td>3년</td>
                    <td>전자상거래법</td>
                  </tr>
                  <tr>
                    <td>재가입 방지를 위한 가입정보 기록</td>
                    <td>90일</td>
                    <td>내부 정책</td>
                  </tr>
                  <tr>
                    <td>자료 등록 및 판매에 관한 기록</td>
                    <td>180일</td>
                    <td>내부 정책</td>
                  </tr>
                  <tr>
                    <td>접속 로그 기록</td>
                    <td>3개월</td>
                    <td>통신비밀보호법</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              귀하의 동의를 받아 보유하고 있는 거래정보 등을 귀하께서 열람을 요구하는 경우
              회사는 지체 없이 그 열람·확인할 수 있도록 조치합니다.
            </p>
          </section>

          <section>
            <h2>제 8 조 (쿠키에 의한 개인정보 수집)</h2>

            <article>
              <h3>쿠키(cookie)란?</h3>
              <p>
                회사는 귀하에 대한 정보를 저장하고 수시로 찾아내는 '쿠키(cookie)'를 사용합니다.
                쿠키는 웹사이트가 귀하의 컴퓨터 브라우저로 전송하는 소량의 정보입니다.
                쿠키는 귀하의 컴퓨터는 식별하지만 귀하를 개인적으로 식별하지는 않습니다.
                또한 귀하는 쿠키에 대한 선택권이 있습니다.
              </p>
            </article>

            <article>
              <h3>쿠키 사용 목적</h3>
              <p>
                이용자들이 방문한 서비스와 웹 사이트들에 대한 방문 및 이용형태, 인기 검색어,
                보안접속 여부, 이용자 규모 등을 파악하여 이용자에게 최적화된 맞춤형 정보를
                제공하기 위해 사용합니다.
              </p>
            </article>

            <article>
              <h3>쿠키의 설치/운영 및 거부</h3>
              <p>
                이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹브라우저에서 옵션을
                설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나,
                모든 쿠키의 저장을 거부할 수도 있습니다. 다만, 쿠키의 저장을 거부할 경우에는
                로그인이 필요한 일부 서비스는 이용에 어려움이 있을 수 있습니다.
              </p>
            </article>
          </section>

          <section>
            <h2>제 9 조 (개인정보의 기술적/관리적 보호 대책)</h2>
            <p>
              회사는 이용자들의 개인정보를 처리함에 있어 개인정보가 분실, 도난, 유출, 변조 또는
              훼손되지 않도록 안전성 확보를 위하여 다음과 같은 기술적/관리적 대책을 강구하고 있습니다.
            </p>

            <article>
              <h3>비밀번호 암호화</h3>
              <p>
                회원 아이디(ID)의 비밀번호는 암호화되어 저장 및 관리되고 있어 본인만이 알고 있으며,
                개인정보의 확인 및 변경도 비밀번호를 알고 있는 본인에 의해서만 가능합니다.
              </p>
            </article>

            <article>
              <h3>해킹 등에 대비한 대책</h3>
              <p>
                회사는 해킹이나 컴퓨터 바이러스 등에 의해 회원의 개인정보가 유출되거나 훼손되는
                것을 막기 위해 최선을 다하고 있습니다. 개인정보의 훼손에 대비해서 자료를 수시로
                백업하고 있고, 최신 백신프로그램을 이용하여 이용자들의 개인정보나 자료가 유출되거나
                손상되지 않도록 방지하고 있으며, 암호화통신 등을 통하여 네트워크상에서 개인정보를
                안전하게 전송할 수 있도록 하고 있습니다.
              </p>
            </article>

            <article>
              <h3>처리 직원의 최소화 및 교육</h3>
              <p>
                회사의 개인정보관련 처리 직원은 담당자에 한정시키고 있고 이를 위한 별도의
                비밀번호를 부여하여 정기적으로 갱신하고 있으며, 담당자에 대한 수시 교육을
                통하여 개인정보처리방침의 준수를 항상 강조하고 있습니다.
              </p>
            </article>

            <article>
              <h3>개인정보보호전담기구의 운영</h3>
              <p>
                사내 개인정보보호전담기구 등을 통하여 개인정보처리방침의 이행사항 및 담당자의
                준수여부를 확인하여 문제가 발견될 경우 즉시 수정하고 바로 잡을 수 있도록
                노력하고 있습니다. 단, 회사가 개인정보보호 의무를 다하였음에도 불구하고
                이용자 본인의 부주의나 회사가 관리하지 않는 영역에서의 사고 등 회사의
                귀책에 기인하지 않은 손해에 대해서는 회사는 일체의 책임을 지지 않습니다.
              </p>
            </article>
          </section>

          <section>
            <h2>제 10 조 (게시물)</h2>
            <p>
              회사는 귀하의 게시물을 소중하게 생각하며 변조, 훼손, 삭제되지 않도록 최선을
              다하여 보호합니다. 그러나 다음의 경우는 그러하지 아니합니다.
            </p>
            <ul>
              <li>스팸(spam)성 게시물 (예: 행운의 편지, 특정사이트 광고 등)</li>
              <li>타인을 비방할 목적으로 허위 사실을 유포하여 타인의 명예를 훼손하는 글</li>
              <li>동의 없는 타인의 신상공개, 회사의 저작권, 제3자의 저작권 등 권리를 침해하는 내용</li>
              <li>기타 게시판 주제와 다른 내용의 게시물</li>
            </ul>
            <p>
              근본적으로 게시물에 관련된 제반 권리와 책임은 작성자 개인에게 있습니다.
              또한 게시물을 통해 자발적으로 공개된 정보는 보호받기 어려우므로
              정보 공개 전에 심사숙고하시기 바랍니다.
            </p>
          </section>

          <section>
            <h2>제 11 조 (의견수렴 및 불만처리)</h2>
            <p>
              회사는 귀하의 의견을 소중하게 생각하며, 귀하는 의문사항으로부터 언제나
              성실한 답변을 받을 권리가 있습니다.
            </p>
            <div className="my-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm not-prose">
              <p className="font-semibold text-gray-900">고객센터</p>
              <p className="mt-1 text-gray-600">이메일: unifileservice@gmail.com</p>
              <p className="mt-0.5 text-gray-600">고객센터를 이용한 상담은 접수 후 24시간 내에 성실하게 답변 드리겠습니다.</p>
            </div>
            <p>
              기타 개인정보에 관한 상담이 필요한 경우에는 아래 기관에 문의하실 수 있습니다.
            </p>
            <ul className="text-gray-500">
              <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
              <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
              <li>대검찰청: (국번없이) 1301 (www.spo.go.kr)</li>
              <li>경찰청: (국번없이) 182 (ecrm.cyber.go.kr)</li>
            </ul>
          </section>

          <section>
            <h2>제 12 조 (개인정보관리책임자)</h2>
            <p>
              회사는 귀하가 좋은 정보를 안전하게 이용할 수 있도록 최선을 다하고 있습니다.
              개인정보를 보호하는데 있어 귀하께 고지한 사항들에 반하는 사고가 발생할 시에
              개인정보관리책임자가 모든 책임을 집니다. 그러나 기술적인 보완조치를 했음에도
              불구하고, 해킹 등 기본적인 네트워크상의 위험성에 의해 발생하는 예기치 못한
              사고로 인한 정보의 훼손 및 방문자가 작성한 게시물에 의한 각종 분쟁에 관해서는
              책임이 없습니다.
            </p>
            <div className="my-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm not-prose">
              <p className="font-semibold text-gray-900">개인정보관리책임자</p>
              <p className="mt-1 text-gray-600">이메일: unifileservice@gmail.com</p>
              <p className="mt-0.5 text-gray-600">개인정보 관련 문의사항에 신속하고 성실하게 답변해 드리고 있습니다.</p>
            </div>
          </section>

          <section>
            <h2>제 13 조 (고지의 의무)</h2>
            <p>
              현 개인정보처리방침은 2026년 4월 1일에 제정되었으며, 정부의 정책 또는
              보안기술의 변경에 따라 내용의 추가, 삭제 및 수정이 있을 시에는 개정
              최소 10일 전부터 홈페이지의 공지란을 통해 고지할 것입니다.
            </p>
            <ul>
              <li>개인정보처리방침 버전번호: v1.1</li>
              <li>개인정보처리방침 시행일자: 2026-04-04</li>
            </ul>
          </section>
        </div>

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
