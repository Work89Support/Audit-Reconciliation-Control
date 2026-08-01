const exceptions = [
  {
    time: "09:14:22",
    account: "SCB-2048",
    system: "1,000.00",
    bank: "100.00",
    diff: "+900.00",
    owner: "user_morning_03",
    status: "ยอดเงินไม่ตรง",
    tone: "red",
  },
  {
    time: "12:47:03",
    account: "KBANK-7711",
    system: "2,450.00",
    bank: "-",
    diff: "Missing",
    owner: "user_mid_01",
    status: "รายการหาย",
    tone: "amber",
  },
  {
    time: "18:22:51",
    account: "BBL-1180",
    system: "5,000.00",
    bank: "5,000.00",
    diff: "96 sec",
    owner: "user_night_02",
    status: "เวลาเกินเกณฑ์",
    tone: "blue",
  },
  {
    time: "23:08:37",
    account: "SCB-2048",
    system: "740.00",
    bank: "700.00",
    diff: "+40.00",
    owner: "user_night_05",
    status: "ต้องตรวจซ้ำ",
    tone: "amber",
  },
];

const tbody = document.querySelector("#exceptionRows");

tbody.innerHTML = exceptions
  .map(
    (item) => `
      <tr>
        <td>${item.time}</td>
        <td>${item.account}</td>
        <td>${item.system}</td>
        <td>${item.bank}</td>
        <td>${item.diff}</td>
        <td>${item.owner}</td>
        <td><span class="badge ${item.tone}">${item.status}</span></td>
      </tr>
    `,
  )
  .join("");

const form = document.querySelector("#askForm");
const input = document.querySelector("#askInput");
const chatBox = document.querySelector("#chatBox");

const answers = [
  "วันนี้พบ Diff / Missing 2,448 รายการ โดย 61 รายการสำคัญอยู่ในกะดึก และควรตรวจกลุ่มยอดเงินไม่ตรงก่อน",
  "สาเหตุหลักคือการคีย์ยอดผิด, รายการ auto ไม่เข้าแล้วทำ manual, และเวลาระหว่าง bank กับระบบเกิน tolerance",
  "Daily Report สามารถสรุปเป็น matched, missing, amount diff, time diff และ owner ตาม shift เพื่อใช้คำนวณ KPI",
];

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  addMessage(question, "user");
  const answer = answers[Math.floor(Math.random() * answers.length)];
  window.setTimeout(() => addMessage(answer, "system"), 250);
  input.value = "";
});

function addMessage(text, type) {
  const node = document.createElement("div");
  node.className = `message ${type}`;
  node.textContent = text;
  chatBox.appendChild(node);
  chatBox.scrollTop = chatBox.scrollHeight;
}
