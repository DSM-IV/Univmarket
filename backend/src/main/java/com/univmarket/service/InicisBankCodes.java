package com.univmarket.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 은행명 → 이니시스 지급대행 2자리 은행코드 매핑.
 *
 * 이 코드값은 실제 송금 계좌 라우팅에 쓰이므로, 소개서에서 확정된 값만 채우고
 * 나머지는 null(미확정)로 둔다. 미확정 은행 계좌는 지급파일 생성 대상에서 제외된다.
 * 임의 추정 금지 — 미확정 코드는 이니시스 계좌정보 일괄처리 가이드로 확정한다.
 */
public final class InicisBankCodes {

    private InicisBankCodes() {}

    /** 은행명 → 코드 (null = 미확정). 선택 UI 노출 순서를 위해 순서 유지. */
    private static final Map<String, String> CODES;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        // ── 확정 (소개서) ──
        m.put("한국산업은행", "02");
        m.put("기업은행", "03");
        m.put("국민은행", "04");
        m.put("수협", "07");
        m.put("농협", "11");          // NH농협은행
        m.put("단위농협", "12");       // 지역농축협
        m.put("우리은행", "20");
        m.put("광주은행", "34");
        m.put("제주은행", "35");
        m.put("전북은행", "37");
        m.put("경남은행", "39");
        m.put("새마을금고", "45");
        m.put("씨티은행", "53");
        // ── 미확정 (TODO: 계좌정보 일괄처리 가이드로 코드 확정) ──
        m.put("신한은행", null);
        m.put("하나은행", null);
        m.put("카카오뱅크", null);
        m.put("케이뱅크", null);
        m.put("토스뱅크", null);
        m.put("우체국", null);
        m.put("SC제일은행", null);
        m.put("대구은행", null);       // iM뱅크
        m.put("부산은행", null);
        m.put("신협", null);
        CODES = Collections.unmodifiableMap(m);
    }

    /** 목록에 등록된 은행명인지 (코드 확정 여부와 무관). */
    public static boolean isKnownBank(String bankName) {
        return bankName != null && CODES.containsKey(bankName);
    }

    /** 은행명의 지급대행 코드. 미확정/미등록이면 null. */
    public static String codeFor(String bankName) {
        return bankName == null ? null : CODES.get(bankName);
    }

    /** 코드가 확정된 은행인지. */
    public static boolean isCodeConfirmed(String bankName) {
        return codeFor(bankName) != null;
    }

    /** 은행 선택 목록 [{name, codeConfirmed}] (코드값 자체는 노출하지 않음). */
    public static List<Map<String, Object>> bankList() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map.Entry<String, String> e : CODES.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", e.getKey());
            item.put("codeConfirmed", e.getValue() != null);
            list.add(item);
        }
        return list;
    }
}
