#!/bin/bash
# gvenzl/oracle-free의 init.d는 .sql을 SYSDBA로 실행하므로,
# 이 래퍼 셸 스크립트로 APP_USER(UNIVMARKET)로 직접 접속해 schema.sql을 실행한다.
# 그렇게 해야 테이블이 UNIVMARKET 스키마에 생성되어 앱이 조회 가능.

set -euo pipefail

echo "Running schema.sql as ${APP_USER}..."

sqlplus -s -l "${APP_USER}/${APP_USER_PASSWORD}@//localhost:1521/FREEPDB1" <<-EOF
	WHENEVER SQLERROR EXIT FAILURE;
	SET ECHO ON;
	@/opt/univmarket-init/schema.sql
	EXIT;
EOF

echo "schema.sql completed as ${APP_USER}."
