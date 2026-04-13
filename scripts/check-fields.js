var url = "/view?attribute=lectHakbuData&lang=KOR&fake=" + Date.now();
var opts = {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
  body: "pYear=2026&pTerm=1R&pCampus=1&pGradCd=0136&pCourDiv=&pCol=0140&pDept=&pCredit=&pDay=&pStartTime=&pEndTime=&pProf=&pCourCd=&pCourNm=&strYear=2026&strTerm=1R&strUserType=&strChasu="
};
fetch(url, opts).then(function(r) {
  return r.json();
}).then(function(d) {
  console.log("count: " + d.data.length);
  console.log("ALL KEYS: " + Object.keys(d.data[0]).join(", "));
  console.log(JSON.stringify(d.data[0]));
  console.log(JSON.stringify(d.data[1]));
});
