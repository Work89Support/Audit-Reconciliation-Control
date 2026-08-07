#!/usr/bin/env bash
# DomainWatch — สคริปต์เริ่มระบบแบบคำสั่งเดียว (สำหรับ macOS/Linux + Docker)
# วิธีใช้:  bash start.sh
set -e
cd "$(dirname "$0")"

echo "▶  DomainWatch — กำลังเริ่มระบบ"
echo "--------------------------------------"

# 1) ต้องมี Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ ยังไม่ได้ติดตั้ง Node.js — ดาวน์โหลดตัว LTS ที่ https://nodejs.org แล้วรันใหม่"
  exit 1
fi

# 2) ต้องเปิด Docker Desktop
if ! docker info >/dev/null 2>&1; then
  echo "❌ ยังไม่ได้เปิด Docker Desktop (หรือยังไม่ได้ติดตั้ง)"
  echo "   ติดตั้งที่ https://www.docker.com/products/docker-desktop/ แล้วเปิดโปรแกรมไว้ จากนั้นรันสคริปต์นี้อีกครั้ง"
  exit 1
fi

# 3) สร้าง .env จากตัวอย่าง (ถ้ายังไม่มี)
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ สร้างไฟล์ .env จากตัวอย่างแล้ว (ค่า DATABASE_URL ตั้งให้ตรงกับ Docker อยู่แล้ว)"
fi

# 4) ติดตั้ง dependencies (ถ้ายังไม่มี)
if [ ! -d node_modules ]; then
  echo "📦 กำลังติดตั้ง dependencies (ครั้งแรกอาจใช้เวลาสักครู่)..."
  npm install
fi

# 5) เปิด PostgreSQL ผ่าน Docker
echo "🐘 เปิดฐานข้อมูล PostgreSQL ผ่าน Docker..."
docker compose up -d

# 6) รอให้ฐานข้อมูลพร้อม
echo "⏳ รอฐานข้อมูลพร้อมใช้งาน..."
until docker compose exec -T db pg_isready -U domainwatch >/dev/null 2>&1; do
  sleep 1
done
echo "✅ ฐานข้อมูลพร้อมแล้ว"

# 7) สร้างตารางตาม schema
echo "🗂️  สร้างตารางในฐานข้อมูล..."
npm run db:push

# 8) ใส่ข้อมูลตัวอย่าง (seed จะข้ามให้เองถ้ามีข้อมูลอยู่แล้ว)
echo "🌱 ใส่ข้อมูลตัวอย่าง (ถ้ายังว่าง)..."
npm run db:seed || true

# 9) รันเว็บ
echo "--------------------------------------"
echo "🚀 เปิดเว็บได้ที่:  http://localhost:3000"
echo "   (กด Ctrl+C เพื่อหยุด, ปิดฐานข้อมูลด้วย: docker compose down)"
echo "--------------------------------------"
npm run dev
