# Audit AI Reconciliation - Architecture

## System Overview

```mermaid
flowchart LR
  A["Email กลาง / Upload"] --> B["File Intake Service"]
  B --> C["Raw File Storage"]
  B --> D["Completeness Checker"]
  D --> E["Parser & Normalizer"]
  E --> F["Bank Rule Engine"]
  F --> G["Reconciliation Engine"]
  G --> H["Exception Queue"]
  H --> I["Clarification Workflow"]
  I --> J["Approval & Damage Register"]
  J --> K["Daily / Monthly Reports"]
  G --> L["Analytics Warehouse"]
  L --> M["Dashboard"]
  L --> N["Talk to Data"]
```

## Core Modules

### File Intake Service

รับไฟล์จาก Email กลางหรือ upload manual แล้วจัดหมวดหมู่ตามวันที่ บริษัท ประเภทไฟล์ และบัญชี

### Completeness Checker

ตรวจว่าข้อมูลประจำวันครบหรือไม่ เช่น STM ฝาก-ถอน, BO, ไฟล์แก้ไขมือ, ไฟล์ชี้แจง และ PM STM

### Parser & Normalizer

แปลงข้อมูลหลายรูปแบบเป็น transaction schema เดียวกัน โดยเก็บ raw text และ normalized fields ควบคู่กัน

### Bank Rule Engine

ทำความสะอาดข้อมูลตามกฎธนาคาร เช่น กรองยอดยกมา, กรองรอบวันที่, ตีความ X1/X2/XB, แยกช่วงข้ามวัน

### Reconciliation Engine

จับคู่ STM กับ BO ด้วย account + time + amount และสร้าง match result / exception result

### Exception Workflow

จัดการ lifecycle ของรายการผิดปกติ ตั้งแต่พบรายการ ส่งชี้แจง รับหลักฐาน ตรวจทาน อนุมัติ และปิดเคส

### Damage Register

เก็บผลกระทบทางการเงิน, ผู้เกี่ยวข้อง, กะ, สาเหตุ, หลักฐาน และสถานะการส่งต่อการเงิน/บุคคล

### Analytics & Talk to Data

สรุป dashboard, trend, KPI และตอบคำถามภาษาไทยจากข้อมูลที่ผ่านการตรวจสอบแล้ว

## Database Schema Draft

```mermaid
erDiagram
  companies ||--o{ bank_accounts : owns
  companies ||--o{ source_files : submits
  source_files ||--o{ raw_transactions : contains
  raw_transactions ||--o| normalized_transactions : normalizes_to
  bank_accounts ||--o{ normalized_transactions : has
  normalized_transactions ||--o{ match_candidates : participates
  match_runs ||--o{ match_candidates : creates
  match_runs ||--o{ exceptions : creates
  exceptions ||--o{ clarification_requests : has
  exceptions ||--o| damage_records : may_create
  users ||--o{ audit_logs : performs
  users ||--o{ clarification_requests : responds
  shifts ||--o{ users : includes

  companies {
    uuid id PK
    string name
    string system_code
    boolean active
  }

  bank_accounts {
    uuid id PK
    uuid company_id FK
    string bank_code
    string account_mask
    string account_type
    boolean is_pm
    boolean active
  }

  source_files {
    uuid id PK
    uuid company_id FK
    date business_date
    string file_type
    string source_channel
    string original_name
    string checksum
    string status
  }

  raw_transactions {
    uuid id PK
    uuid source_file_id FK
    int row_number
    text raw_text
    json raw_payload
  }

  normalized_transactions {
    uuid id PK
    uuid raw_transaction_id FK
    uuid bank_account_id FK
    datetime transaction_time
    decimal amount
    decimal balance
    string direction
    string bank_marker
    string username
    string customer_ref
    string normalized_status
  }

  match_runs {
    uuid id PK
    date business_date
    string run_type
    datetime started_at
    datetime finished_at
    string status
  }

  match_candidates {
    uuid id PK
    uuid match_run_id FK
    uuid stm_transaction_id FK
    uuid bo_transaction_id FK
    int time_diff_seconds
    decimal amount_diff
    decimal score
    string result
  }

  exceptions {
    uuid id PK
    uuid match_run_id FK
    string exception_type
    string severity
    decimal amount_diff
    int time_diff_seconds
    string status
    string assigned_to
  }

  clarification_requests {
    uuid id PK
    uuid exception_id FK
    uuid requester_id FK
    uuid responder_id FK
    text message
    string evidence_url
    string status
  }

  damage_records {
    uuid id PK
    uuid exception_id FK
    decimal damage_amount
    string cause_type
    string employee_username
    string shift_code
    string hr_status
    string finance_status
  }

  shifts {
    uuid id PK
    string code
    string name
    time starts_at
    time ends_at
  }

  users {
    uuid id PK
    string display_name
    string username
    string role
    uuid shift_id FK
  }

  audit_logs {
    uuid id PK
    uuid user_id FK
    string entity_type
    uuid entity_id
    string action
    json before_value
    json after_value
    datetime created_at
  }
```

## Matching Logic Draft

1. เลือก business date และ company
2. ตรวจ source file completeness
3. Normalize STM และ BO
4. Apply bank rules
5. สร้าง candidate ด้วย account และ amount
6. คำนวณ time difference
7. จัดอันดับ candidate จาก amount match, time window, username/customer ref
8. สร้าง matched result หาก score ผ่าน threshold
9. สร้าง exception หาก missing, amount diff, time diff, duplicated, cross-day, หรือ manual correction
10. ส่ง exception เข้า workflow

## Security Model

- ไม่ login mobile banking โดย bot
- ingest จาก email/export/upload เท่านั้น
- จำกัด role ตามหน้าที่
- ทุกการเปลี่ยน note, status, evidence, approval ต้องบันทึก audit log
- raw file ต้องเก็บ checksum เพื่อพิสูจน์ว่าไม่ได้ถูกแก้ไข
- report สำหรับ Finance/HR ต้องดึงจาก damage record ที่ปิดรอบแล้วเท่านั้น
