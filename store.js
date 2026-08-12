/* =============================================================
   Store - การเก็บสถานะข้ามการรีเฟรช + ศูนย์แจ้งเตือน + ตัวตั้งเวลา
   Phase 4 ของ roadmap (ส่วนที่ทำได้ฝั่งเบราว์เซอร์)
   ============================================================= */

const Store = (() => {
  const KEY = "audit-ai-state-v1";
  let mem = {};
  let usable = true;
  try {
    localStorage.setItem("__t", "1");
    localStorage.removeItem("__t");
  } catch (e) {
    usable = false;
  }

  function read() {
    if (!usable) return mem;
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function write(obj) {
    mem = obj;
    if (!usable) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  }

  const defaults = () => ({
    exOverrides: {},
    extraDamages: [],
    auditLog: [],
    settings: null,
    notifications: [],
    notifyRules: {
      fileMissing: true,
      criticalException: true,
      slaBreach: true,
      cycleDue: true,
      channelEmail: true,
      channelTelegram: false,
      channelInApp: true,
    },
    schedule: {
      enabled: false,
      intervalMinutes: 60,
      times: ["09:00", "13:00", "18:00", "23:30"],
      lastRun: null,
      nextRun: null,
      autoIngest: true,
    },
    retention: { months: 12, backupDaily: true, encryptAtRest: true, maskAccount: true },
    lastSavedAt: null,
  });

  let data = Object.assign(defaults(), read());

  function persist() {
    data.lastSavedAt = new Date().toISOString();
    if (data.auditLog.length > 400) data.auditLog = data.auditLog.slice(0, 400);
    if (data.notifications.length > 200) data.notifications = data.notifications.slice(0, 200);
    return write(data);
  }

  function reset() {
    data = defaults();
    if (usable) {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    }
  }

  /* ---------- notifications ---------- */
  function notify(kind, title, detail, link) {
    data.notifications.unshift({
      id: "N" + (data.notifications.length + 1) + "-" + Math.floor(performance.now()),
      at: new Date().toISOString(),
      kind,
      title,
      detail,
      link: link || null,
      read: false,
    });
    persist();
  }
  const unread = () => data.notifications.filter((n) => !n.read).length;
  function markAllRead() {
    data.notifications.forEach((n) => (n.read = true));
    persist();
  }

  return {
    get data() {
      return data;
    },
    persist,
    reset,
    notify,
    unread,
    markAllRead,
    get available() {
      return usable;
    },
  };
})();
