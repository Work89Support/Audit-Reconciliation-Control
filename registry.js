/* =============================================================
   Registry - ทะเบียนบัญชีจริง + mapping "ชื่อไฟล์ -> บัญชี/ช่องทาง"
   ใช้แท็กไฟล์ที่พนักงานส่งเข้า (ชื่อไฟล์ภาษาคน) ให้ตรงบัญชีในทะเบียน
   สร้างจากทะเบียนที่คลีนแล้ว (Google Sheet) - อัปเดตได้โดยแก้ ACCOUNTS
   ============================================================= */
const Registry = (() => {
  const ACCOUNTS = [
{
"subco": "3XB",
"provider": "SYS123",
"bank": "KBANK",
"account": "1968766313",
"accountRaw": "196-8-76631-3",
"name": "นาย นราธิป ขุนอาจ",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB นราธิป ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "SCB",
"account": "5034632277",
"accountRaw": "503-463227-7",
"name": "นางสาว สงกรานต์ สร้อยแก้ว",
"type": "ฝาก+ถอน",
"channel": "ENET",
"source": "bank",
"file": "SCB สงกรานต์ ถอน-ฝากว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "SCB",
"account": "5034625466",
"accountRaw": "503-462546-6",
"name": "นาย ชานิชน์ ชมพิมาย",
"type": "ฝาก+ถอน",
"channel": "ENET",
"source": "bank",
"file": "SCB ชานิชน์ ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "KBANK",
"account": "1998024354",
"accountRaw": "199-8-02435-4",
"name": "นาย สุพจน์ บุญธรรม",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB สุพจน์ ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "KBANK",
"account": "2231661134",
"accountRaw": "223-1-66113-4",
"name": "นาย วายุ บุญสร้าง",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB วายุ ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "KBANK",
"account": "2308381717",
"accountRaw": "230-8-38171-7",
"name": "นาย วีรยุทธ ลายหม้อ",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB วีรยุทธ ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "KBANK",
"account": "1938713800",
"accountRaw": "193-8-71380-0",
"name": "นาย ประวิตร ประวาร",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB ประวิตร ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "KTB",
"account": "6060748201",
"accountRaw": "6060748201",
"name": "นาย นราธิป ขุนอาจ",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "KTB นราธิป ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "3XB",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "3XB ATP ว/ด/ป ถอน.csv"
},
{
"subco": "3XB",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "3XB ATP ว/ด/ป ฝาก.csv"
},
{
"subco": "3XB",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "3XB AZPAY ว/ด/ป ถอน.csv"
},
{
"subco": "3XB",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "3XB AZPAY ว/ด/ป ฝาก.csv"
},
{
"subco": "3XB",
"provider": "12PAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "12PAY",
"source": "pm",
"file": "3XB 12PAY ถอน ว/ด/ป.csv"
},
{
"subco": "3XB",
"provider": "12PAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "12PAY",
"source": "pm",
"file": "3XB 12PAY ฝาก ว/ด/ป.csv"
},
{
"subco": "3XB",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "3XB MYPAY ถอน ว/ด/ป.csv"
},
{
"subco": "3XB",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "3XB MYPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "3XB",
"provider": "SYS123",
"bank": "BBL",
"account": "6517247760",
"accountRaw": "651-7-24776-0",
"name": "นาย จิรายุ แสงย้อย",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "BBL จิรายุ ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "FR8",
"provider": "SYS123",
"bank": "KBANK",
"account": "2273888465",
"accountRaw": "227-3-88846-5",
"name": "น.ส. สุวรรณี สร้อยแก้ว",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB สุวรรณี ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "FR8",
"provider": "SYS123",
"bank": "KBANK",
"account": "1981674096",
"accountRaw": "198-1-67409-6",
"name": "น.ส. จิรภัทร์ เกื้อกูล",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB จิรภัทร์ ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "FR8",
"provider": "SYS123",
"bank": "SCB",
"account": "4142322778",
"accountRaw": "414-232277-8",
"name": "นางสาว สิริพร แซ่โป่ว",
"type": "ฝาก+ถอน",
"channel": "ENET",
"source": "bank",
"file": "SCB สิริพร ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "FR8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "FR8 AUTOPEER ถอน ว/ด/ป.xlsx"
},
{
"subco": "FR8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "FR8 AUTOPEER ฝาก ว/ด/ป.xlsx"
},
{
"subco": "FR8",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "FR8 AZPAY ฝาก ว/ด/ป.xlsx"
},
{
"subco": "FR8",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "FR8 CYBERPLUS ถอน ว/ด/ป.xlsx"
},
{
"subco": "FR8",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "FR8 CYBERPLUS ฝาก ว/ด/ป.xlsx"
},
{
"subco": "AT4",
"provider": "SYS123",
"bank": "BBL",
"account": "6517248040",
"accountRaw": "651-7-24804-0",
"name": "นาย นรวร ผาสุข",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "BBL นรวร ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "AT4",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "AT4 AUTOPEER ถอน ว/ด/ป.xlsx"
},
{
"subco": "AT4",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "AT4 AUTOPEER ฝาก ว/ด/ป.xlsx"
},
{
"subco": "AT4",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "AT4 AZPAY ฝาก ว/ด/ป.xlsx"
},
{
"subco": "AT4",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "AT4 CYBERPLUS ถอน ว/ด/ป.xlsx"
},
{
"subco": "AT4",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "AT4 CYBERPLUS ฝาก ว/ด/ป.xlsx"
},
{
"subco": "SK8",
"provider": "SYS123",
"bank": "BBL",
"account": "6517249394",
"accountRaw": "651-7-24939-4",
"name": "น.ส. ดลยา หอมจันทร์",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "BBL ดลยา ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "SK8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "SK8 AUTOPEER ถอน ว/ด/ป.xlsx"
},
{
"subco": "SK8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "SK8 AUTOPEER ฝาก ว/ด/ป.xlsx"
},
{
"subco": "SK8",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "SK8 AZPAY ฝาก ว/ด/ป.xlsx"
},
{
"subco": "SK8",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "SK8 CYBERPLUS ถอน ว/ด/ป.xlsx"
},
{
"subco": "SK8",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "SK8 CYBERPLUS ฝาก ว/ด/ป.xlsx"
},
{
"subco": "MR9",
"provider": "SYS123",
"bank": "KBANK",
"account": "1998218930",
"accountRaw": "199-8-21893-0",
"name": "น.ส. สิริพร แซ่โป่ว",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB สิริพร ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "MR9",
"provider": "SYS123",
"bank": "KTB",
"account": "6648590203",
"accountRaw": "6648590203",
"name": "นาย มโนชา ชมภู",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "KTB มโนชา ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "MR9",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "MR9 ATP ถอน ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "MR9 ATP ฝาก ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "MR9 AZPAY ถอน ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "MR9 AZPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "MR9 MYPAY ถอน ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "MR9 MYPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "12PAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "12PAY",
"source": "pm",
"file": "MR9 12PAY ถอน ว/ด/ป.csv"
},
{
"subco": "MR9",
"provider": "12PAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "12PAY",
"source": "pm",
"file": "MR9 12PAY ฝาก ว/ด/ป.csv"
},
{
"subco": "MC8",
"provider": "SYS123",
"bank": "SCB",
"account": "4312127429",
"accountRaw": "431-212742-9",
"name": "นางสาว จันทร์ทิวา อินพุ่ม",
"type": "ฝาก+ถอน",
"channel": "ENET",
"source": "bank",
"file": "SCB จันทร์ทิวา ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "MC8",
"provider": "SYS123",
"bank": "KBANK",
"account": "1998545397",
"accountRaw": "199-8-54539-7",
"name": "นาย ทินกร โฉมสะอาด",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB ทินกร ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "MC8",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "MC8 AZPAY ถอน ว/ด/ป.csv"
},
{
"subco": "MC8",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "MC8 AZPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "MC8",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "MC8 MYPAY ถอน ว/ด/ป.csv"
},
{
"subco": "MC8",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "MC8 MYPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "MC8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "MC8 ATP ถอน ว/ด/ป.csv"
},
{
"subco": "MC8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "MC8 ATP ฝาก ว/ด/ป.csv"
},
{
"subco": "UR9",
"provider": "SYS123",
"bank": "KBANK",
"account": "1998227220",
"accountRaw": "199-8-22722-0",
"name": "นาย ชัยยา จันทรโชติ",
"type": "ฝาก+ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB ชัยยา ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "UR9",
"provider": "SYS123",
"bank": "KTB",
"account": "6657497121",
"accountRaw": "6657497121",
"name": "นาย ณัฐพล งามถนอม",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "KTB ณัฐพล ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "UR9",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "Ur9 ATP ถอน ว/ด/ป.csv"
},
{
"subco": "UR9",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "Ur9 ATP ฝาก ว/ด/ป.csv"
},
{
"subco": "UR9",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "Ur9 AZPAY ถอน ว/ด/ป.csv"
},
{
"subco": "UR9",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "Ur9 AZPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "UR9",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "Ur9 MYPAY ถอน ว/ด/ป.csv"
},
{
"subco": "UR9",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "Ur9 MYPAY ถอน ว/ด/ป.csv"
},
{
"subco": "PS8",
"provider": "SYS123",
"bank": "SCB",
"account": "5292894087",
"accountRaw": "529-289408-7",
"name": "นาย นรวร ผาสุข",
"type": "ฝาก+ถอน",
"channel": "ENET",
"source": "bank",
"file": "SCB นรวร ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "PS8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "Ps8 ATP ถอน ว/ด/ป.csv"
},
{
"subco": "PS8",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "Ps8 ATP ฝาก ว/ด/ป.csv"
},
{
"subco": "PS8",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "PS8 AZPAY ถอน ว/ด/ป.csv"
},
{
"subco": "PS8",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "PS8 AZPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "PS8",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "PS8 MYPAY ถอน ว/ด/ป.csv"
},
{
"subco": "PS8",
"provider": "MYPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "MYPAY",
"source": "pm",
"file": "PS8 MYPAY ฝาก ว/ด/ป.csv"
},
{
"subco": "7M",
"provider": "SYS123",
"bank": "KBANK",
"account": "1953167154",
"accountRaw": "195-3-16715-4",
"name": "น.ส. เพ็ญศรี เกิดนิมิตร",
"type": "ถอน",
"channel": "K PLUS",
"source": "bank",
"file": "KB เพ็ญศรี ถอน ว/ด/ป.pdf"
},
{
"subco": "7M",
"provider": "SYS123",
"bank": "TMN",
"account": "0812792075",
"accountRaw": "812792075",
"name": "คุณรุ่งฟ้า แซ่ตั้ง",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "TMN รุ่งฟ้า ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "7M",
"provider": "SYS123",
"bank": "TMN",
"account": "0639274201",
"accountRaw": "639274201",
"name": "คุณสรวิศา อาญาเมือง",
"type": "ฝาก+ถอน",
"channel": "-",
"source": "bank",
"file": "TMN สรวิศา ถอน-ฝาก ว/ด/ป.pdf"
},
{
"subco": "7M",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "รายการถอน ATP PM ว/ด/ป.xlsx"
},
{
"subco": "7M",
"provider": "AUTOPEER",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AUTOPEER",
"source": "pm",
"file": "รายการฝาก ATP PM ว/ด/ป.xlsx"
},
{
"subco": "7M",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "รายการถอน AZ PM ว/ด/ป.xlsx"
},
{
"subco": "7M",
"provider": "AZPAY",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "AZPAY",
"source": "pm",
"file": "รายการฝาก AZ PM ว/ด/ป.xlsx"
},
{
"subco": "7M",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "รายการถอน CBY PM ว/ด/ป.xlsx"
},
{
"subco": "7M",
"provider": "CYBERPLUS",
"bank": "",
"account": "",
"accountRaw": "",
"name": "",
"type": "PM",
"channel": "CYBERPLUS",
"source": "pm",
"file": "รายการฝากCBY PM ว/ด/ป.xlsx"
}
];

  const TITLE_RE = /^(คุณ|นางสาว|นาง|นาย|น\.ส\.|น\.ส|ที่)/;
  const BANK_KW = { scb:"SCB", kb:"KBANK", kbank:"KBANK", ktb:"KTB", bbl:"BBL", gsb:"GSB", tmn:"TMN" };
  const PM_KW = { atp:"AUTOPEER", autopeer:"AUTOPEER", az:"AZPAY", azpay:"AZPAY",
                  cby:"CYBERPLUS", cyberplus:"CYBERPLUS", "12pay":"12PAY", mypay:"MYPAY" };

  function normalizeAccount(s, bank) {
    let d = String(s || "").replace(/\D/g, "");
    if (bank === "TMN" && d.length === 9) d = "0" + d; // เบอร์ทรูมันนี่ตัด 0 หน้า
    return d;
  }
  const norm = (s) => String(s || "").toLowerCase();
  function tokens(s){ return norm(s).replace(/[._/\\()-]/g," ").split(/\s+/).filter(Boolean); }
  function nameWords(name){
    return String(name||"").split(/\s+/).map((w)=>w.replace(TITLE_RE,"")).filter((w)=>w.length>=2);
  }
  function dirOf(fileName){
    const r = norm(fileName);
    if (/ฝาก/.test(r) && /ถอน/.test(r)) return "both";
    if (/ฝาก/.test(r)) return "deposit";
    if (/ถอน/.test(r)) return "withdraw";
    return null;
  }
  // ตรวจ ธนาคาร/ผู้ให้บริการ จากชื่อไฟล์ (รองรับคำที่เขียนติดกัน)
  function detectFromName(fileName){
    const raw = norm(fileName), toks = tokens(fileName);
    let bank=null, pm=null;
    for (const t of toks){ if (BANK_KW[t]){ bank=BANK_KW[t]; break; } }
    for (const t of toks){ if (PM_KW[t]){ pm=PM_KW[t]; break; } }
    if (!pm){ for (const k in PM_KW){ if (k.length>=3 && raw.includes(k)){ pm=PM_KW[k]; break; } } }
    if (!bank){ for (const k in BANK_KW){ if (k.length>=3 && raw.includes(k)){ bank=BANK_KW[k]; break; } } }
    return { bank, pm, toks, raw };
  }

  /* คืนบัญชี/ช่องทางในทะเบียนที่ตรงกับชื่อไฟล์มากที่สุด */
  function matchFile(fileName){
    const { bank, pm, raw } = detectFromName(fileName);
    const direction = dirOf(fileName);
    if (pm){
      // ไฟล์ PM: ผู้ให้บริการ + บริษัทย่อยในชื่อไฟล์ (ยุบ ถอน/ฝาก เป็นบัญชีเดียว)
      const hit = ACCOUNTS.filter((a)=>a.source==="pm" && a.provider===pm && raw.includes(norm(a.subco)));
      if (hit.length){
        const a=hit[0];
        return { match:{subco:a.subco,provider:a.provider,channel:a.channel,source:"pm",account:""}, direction, score:2 };
      }
      // เจอผู้ให้บริการแต่ไม่มีบริษัทย่อยในชื่อไฟล์ -> กำกวม
      const subs=[...new Set(ACCOUNTS.filter((a)=>a.source==="pm"&&a.provider===pm).map((a)=>a.subco))];
      return { match:null, provider:pm, direction, ambiguousSubco:subs, reason:"ไฟล์ PM ไม่มีชื่อบริษัทย่อยในชื่อไฟล์ (เพิ่มบริษัทย่อยในชื่อไฟล์)" };
    }
    if (bank){
      const scored = ACCOUNTS.filter((a)=>a.source==="bank" && a.bank===bank)
        .map((a)=>({a, score: nameWords(a.name).filter((w)=>raw.includes(norm(w))).length}))
        .filter((x)=>x.score>0)
        .sort((x,y)=>y.score-x.score);
      if (!scored.length) return { match:null, bank, direction, reason:"พบธนาคารแต่จับชื่อบัญชีไม่ได้" };
      const top=scored.filter((c)=>c.score===scored[0].score);
      const a=top[0].a;
      const res={ match:{subco:a.subco,provider:a.provider,bank:a.bank,account:a.account,name:a.name,source:"bank"}, direction, score:top[0].score };
      if (top.length>1) res.ambiguous=top.map((c)=>c.a.account);
      return res;
    }
    return { match:null, direction, reason:"ระบุธนาคาร/ผู้ให้บริการจากชื่อไฟล์ไม่ได้" };
  }

  function byAccount(accountDigits){
    const d=normalizeAccount(accountDigits);
    return ACCOUNTS.find((a)=>a.account && (a.account===d || normalizeAccount(a.account)===d)) || null;
  }
  return { ACCOUNTS, normalizeAccount, matchFile, byAccount, detectFromName, dirOf };
})();
if (typeof window !== "undefined") window.Registry = Registry;
