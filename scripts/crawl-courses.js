/**
 * 고려대학교 개설과목 크롤링 스크립트 (다학기 버전)
 *
 * 사용법:
 * 1. https://sugang.korea.ac.kr 에 로그인
 * 2. 개설과목 조회 페이지로 이동
 * 3. F12 → Console 탭 열기
 * 4. 이 스크립트 전체를 복사하여 콘솔에 붙여넣기 후 Enter
 * 5. 완료되면 JSON 파일이 자동 다운로드됨
 */

(function() {
  var terms = [
    { year: "2024", term: "1R", label: "2024-1학기" },
    { year: "2024", term: "2R", label: "2024-2학기" },
    { year: "2025", term: "1R", label: "2025-1학기" },
    { year: "2025", term: "2R", label: "2025-2학기" },
    { year: "2026", term: "1R", label: "2026-1학기" }
  ];

  var allCourses = [];
  var idx = 0;

  function fetchTerm() {
    if (idx >= terms.length) {
      finalize();
      return;
    }
    var t = terms[idx];
    console.log("== [" + (idx + 1) + "/" + terms.length + "] " + t.label + " 크롤링 중... ==");

    var url = "/view?attribute=lectHakbuData&lang=KOR&fake=" + Date.now();
    var opts = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: "pYear=" + t.year + "&pTerm=" + t.term + "&pCampus=1&pGradCd=0136&pCourDiv=&pCol=0140&pDept=&pCredit=&pDay=&pStartTime=&pEndTime=&pProf=&pCourCd=&pCourNm=&strYear=" + t.year + "&strTerm=" + t.term + "&strUserType=&strChasu="
    };

    fetch(url, opts).then(function(r) {
      return r.json();
    }).then(function(d) {
      var count = d.data ? d.data.length : 0;
      console.log("  " + t.label + ": " + count + "개 과목");

      if (d.data && Array.isArray(d.data)) {
        d.data.forEach(function(item) {
          allCourses.push({
            courseName: item.cour_nm || "",
            courseCode: item.cour_cd || "",
            classSection: item.cour_cls || "",
            professor: (item.prof_nm || "").replace(/\r/g, ""),
            department: item.department || "",
            departmentCode: item.dept_cd || "",
            credit: item.credit || 0,
            category: item.isu_nm || "",
            courseDiv: item.cour_div || "",
            year: item.year || t.year,
            term: t.term,
            campus: item.campus || "",
            schedule: (item.time_room || "").replace(/<br>\n?/g, " / "),
            isEnglish: item.eng100 === "Y",
            isMooc: item.mooc_yn === "Y"
          });
        });
      }

      idx++;
      setTimeout(fetchTerm, 1000);
    }).catch(function(err) {
      console.error("  " + t.label + " 에러:", err.message);
      idx++;
      setTimeout(fetchTerm, 1000);
    });
  }

  function finalize() {
    console.log("\n========== 크롤링 완료 ==========");
    console.log("전체 수집: " + allCourses.length + "개");

    // 중복 제거 (같은 과목코드 + 분반 + 교수 + 학기)
    var seen = {};
    var unique = [];
    allCourses.forEach(function(c) {
      var key = c.courseCode + "_" + c.classSection + "_" + c.professor + "_" + c.year + c.term;
      if (!seen[key]) {
        seen[key] = true;
        unique.push(c);
      }
    });

    console.log("중복 제거 후: " + unique.length + "개");

    // 학기별 통계
    var termStats = {};
    unique.forEach(function(c) {
      var k = c.year + "-" + c.term;
      termStats[k] = (termStats[k] || 0) + 1;
    });
    Object.keys(termStats).sort().forEach(function(k) {
      console.log("  " + k + ": " + termStats[k] + "개");
    });

    // JSON 다운로드
    var result = {
      crawledAt: new Date().toISOString(),
      terms: terms.map(function(t) { return t.year + "-" + t.term; }),
      totalCourses: unique.length,
      courses: unique
    };

    var blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    var blobUrl = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = blobUrl;
    a.download = "korea-univ-courses-all.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    console.log("== Download: korea-univ-courses-all.json ==");
  }

  fetchTerm();
})();
