#!/usr/bin/env bash
# ============================================================================
#  DomainWatch Probe Agent
#  ติดตั้งที่ VPS จุดตรวจแต่ละจุด (ไทย 3 จุดคนละผู้ให้บริการ + ต่างประเทศ 1 จุด)
#  หน้าที่: ตรวจ DNS / TCP / HTTP / คำสำคัญในหน้าเว็บ / วันหมดอายุ SSL
#           แล้วส่งผลกลับเข้า n8n ทุก 1 นาที
#
#  ต้องมี: dig (dnsutils), curl, openssl, awk
#  ติดตั้ง:  sudo apt-get install -y dnsutils curl openssl
# ============================================================================
set -uo pipefail

CONFIG="${DW_CONFIG:-/etc/domainwatch/agent.conf}"
if [ ! -f "$CONFIG" ]; then
  echo "ไม่พบไฟล์ตั้งค่า: $CONFIG" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG"

: "${CHECKPOINT:?ต้องกำหนด CHECKPOINT ในไฟล์ตั้งค่า}"
: "${REGION:=TH}"
: "${ISP:=unknown}"
: "${RESOLVER:=1.1.1.1}"
: "${KEYWORD:=เข้าสู่ระบบ}"
: "${DOMAINS:?ต้องกำหนด DOMAINS ในไฟล์ตั้งค่า}"
: "${N8N_WEBHOOK:?ต้องกำหนด N8N_WEBHOOK ในไฟล์ตั้งค่า}"
: "${TIMEOUT_HTTP:=10}"

TMP="$(mktemp -t dwbody.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

for DOMAIN in $DOMAINS; do

  dns_ok=false; tcp_ok=false; http_ok=false; keyword_ok=false
  status_code=0; latency_ms=0; ssl_days_left=null; ip=""

  # ---- L1: DNS ผ่าน resolver ของผู้ให้บริการนี้ --------------------------
  # หมายเหตุ: การบล็อกระดับ DNS มักตอบ NXDOMAIN หรือชี้ไป IP ของหน้าเตือน
  ip="$(dig +short +time=3 +tries=1 "@${RESOLVER}" "$DOMAIN" A 2>/dev/null \
        | grep -Eo '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)"
  if [ -n "$ip" ] && [ "$ip" != "0.0.0.0" ]; then
    dns_ok=true
  fi

  # ---- L2: TCP 443 ------------------------------------------------------
  if [ "$dns_ok" = true ]; then
    if timeout 5 bash -c "exec 3<>/dev/tcp/${ip}/443" 2>/dev/null; then
      tcp_ok=true
    fi
  fi

  # ---- L3: HTTP status + เวลาตอบสนอง ------------------------------------
  if [ "$tcp_ok" = true ]; then
    resp="$(curl -sS -m "$TIMEOUT_HTTP" -L --max-redirs 3 \
            --resolve "${DOMAIN}:443:${ip}" \
            -o "$TMP" -w '%{http_code} %{time_total}' \
            "https://${DOMAIN}/" 2>/dev/null)" || resp="000 ${TIMEOUT_HTTP}"
    status_code="${resp%% *}"
    t="${resp##* }"
    latency_ms="$(awk -v x="$t" 'BEGIN{printf "%d", x*1000}')"
    [ "$status_code" = "200" ] && http_ok=true
  fi

  # ---- L4: คำสำคัญในหน้าเว็บ --------------------------------------------
  # จับกรณีหน้าเว็บตอบ 200 แต่เป็นหน้าเตือนของ ISP หรือหน้าเพี้ยน
  if [ "$http_ok" = true ] && grep -qF -- "$KEYWORD" "$TMP" 2>/dev/null; then
    keyword_ok=true
  fi

  # ---- L6: วันหมดอายุ SSL ------------------------------------------------
  if [ "$tcp_ok" = true ]; then
    enddate="$(echo | timeout 8 openssl s_client -servername "$DOMAIN" \
               -connect "${ip}:443" 2>/dev/null \
               | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    if [ -n "${enddate:-}" ]; then
      end_epoch="$(date -d "$enddate" +%s 2>/dev/null || echo 0)"
      if [ "$end_epoch" -gt 0 ]; then
        ssl_days_left=$(( (end_epoch - $(date +%s)) / 86400 ))
      fi
    fi
  fi

  # ---- ส่งผลกลับเข้า n8n --------------------------------------------------
  payload=$(cat <<JSON
{
  "domain": "${DOMAIN}",
  "checkpoint": "${CHECKPOINT}",
  "isp": "${ISP}",
  "region": "${REGION}",
  "resolver": "${RESOLVER}",
  "resolved_ip": "${ip}",
  "dns_ok": ${dns_ok},
  "tcp_ok": ${tcp_ok},
  "http_ok": ${http_ok},
  "keyword_ok": ${keyword_ok},
  "status_code": ${status_code:-0},
  "latency_ms": ${latency_ms:-0},
  "ssl_days_left": ${ssl_days_left}
}
JSON
)

  curl -sS -m 10 -X POST "$N8N_WEBHOOK" \
       -H 'Content-Type: application/json' \
       -d "$payload" >/dev/null 2>&1 \
    || logger -t domainwatch "ส่งผลตรวจ ${DOMAIN} เข้า n8n ไม่สำเร็จ"

  logger -t domainwatch "${DOMAIN} cp=${CHECKPOINT} dns=${dns_ok} tcp=${tcp_ok} http=${http_ok} kw=${keyword_ok} code=${status_code} ${latency_ms}ms"

done
