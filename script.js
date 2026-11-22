/* =========================================================
   RIVER OF WISHES — พฤติกรรมเว็บไซต์
   1) เริ่มต้นทดลองได้โดยไม่ต้องมีฐานข้อมูล
   2) เมื่อตั้งค่า Supabase แล้ว จะบันทึกและรับกระทงแบบ Real-time
   ========================================================= */

// ====== ตั้งค่า Supabase ตรงนี้เมื่อพร้อมใช้งานจริง ======
// สร้างโปรเจกต์ที่ https://supabase.com แล้วนำ Project URL และ anon/publishable key มาใส่
// ถ้ายังเว้นว่าง เว็บไซต์จะทำงานในโหมดทดลอง (เก็บข้อมูลเฉพาะเบราว์เซอร์นี้)
const SUPABASE_URL = "https://lyxttevuhafchvrhwbdj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Xp6YKnmsDcFVuiB3wzvbCg_vdlk3xE7"; // publishable key: ใส่ในหน้าเว็บได้ (ห้ามใส่ secret/service_role)

// ====== ค่าที่ปรับแต่งได้ ======
const MAX_MESSAGE_LENGTH = 180;
const MAX_NAME_LENGTH = 24;
const MAX_VISIBLE_KRATHONGS = 12;
const MIN_SECONDS_BETWEEN_SUBMITS = 8;
// ความเร็วกระทง: ใช้เวลาข้ามจอนานขึ้น 10%-40% จากเดิม (เดิม 17-30 วินาที) อยากให้ช้าลงอีกก็เพิ่มตัวเลข
const SLOWDOWN_MIN = 1.1;
const SLOWDOWN_MAX = 1.4;

// ตัวกรองเบื้องต้นเท่านั้น ควรเพิ่ม/ปรับคำตามบริบท และใช้ระบบฝั่ง server เพิ่มเมื่อเปิดจริง
const BLOCKED_WORDS = ["เหี้ย", "เชี่ย", "สัส", "สัตว์", "ควาย", "แรด", "ช้างเย็ด", "เหี้ยเอ๊ย", "ไอ้สัส","ไอ้เหี้ย", "อีเหี้ย", "อีสัส", "อีควาย", "อีดอก", "อีดอกทอง", "อีร่าน", "อีตอแหล", "ตอแหล", "หน้าด้าน","หน้าหี", "หน้าควย", "หน้าตัวเมีย", "หน้าส้นตีน", "ส้นตีน", "สถุน", "สวะ", "เดรัจฉาน", "บรรลัย", "พินาศ", "ตายห่า", "ห่า","ห่าเอ๊ย", "ห่าราก", "ไอ้ควาย", "ไอ้เบื๊อก", "ไอ้ทึ่ม", "ไอ้เซ่อ", "สมองหมา","ปากหมา", "ปากเสีย", "ปากดี", "เสือก", "สอดรู้", "ขี้ข้า", "ทาส", "ไพร่","สถุล", "กุ๊ย", "อันธพาล", "ขยะ", "ขยะสังคม", "ตัวซวย", "ตัวภาระ", "มารศาสนา", "ขายตัว", "กะหรี่","โสเภณี", "ลูกกะหรี่", "พ่อมึงตาย", "แม่มึงตาย", "เย็ด", "เย็ดแม่", "ควย", "หี", "แตด"];

const COLORS = {
  gold: "#f0d18b",
  pink: "#eaa4bd",
  violet: "#b8a0dc",
  green: "#a9bd83"
};

const form = document.querySelector("#wishForm");
const nameInput = document.querySelector("#wishName");
const messageInput = document.querySelector("#wishMessage");
const charCount = document.querySelector("#charCount");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const riverStage = document.querySelector("#riverStage");
const riverEmpty = document.querySelector("#riverEmpty");
const countElement = document.querySelector("#krathongCount");
const liveStatus = document.querySelector("#liveStatus");
const previewKrathong = document.querySelector("#previewKrathong");
const wishModal = document.querySelector("#wishModal");
const allWishesModal = document.querySelector("#allWishesModal");

let selectedColor = "gold";
let wishes = [];
let supabaseClient = null;
let lastSubmitAt = 0;
let animationTimers = new Set();
let totalCount = null; // ยอดรวมจริงจากฐานข้อมูล (null = โหมดทดลอง ใช้จำนวนในเครื่อง)

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.style.color = isError ? "#ffaaa0" : "#f4dfaa";
}

function containsBlockedWord(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  return BLOCKED_WORDS.some(word => word && normalized.includes(word.toLowerCase().replace(/\s+/g, "")));
}

function loadLocalWishes() {
  try {
    return JSON.parse(localStorage.getItem("riverOfWishes") || "[]");
  } catch {
    return [];
  }
}

function saveLocalWishes() {
  try {
    localStorage.setItem("riverOfWishes", JSON.stringify(wishes.slice(0, 100)));
  } catch {
    setStatus("พื้นที่จัดเก็บในเบราว์เซอร์เต็ม กรุณาลองใหม่", true);
  }
}

function updateCount() {
  countElement.textContent = String(totalCount ?? wishes.length);
  riverEmpty.hidden = wishes.length > 0;
}

function openWish(wish) {
  document.querySelector("#modalMessage").textContent = wish.message;
  document.querySelector("#modalAuthor").textContent = wish.name ? `— ${wish.name}` : "— ผู้ลอยกระทง";
  wishModal.classList.add("open");
  wishModal.setAttribute("aria-hidden", "false");
}

function closeWish() {
  wishModal.classList.remove("open");
  wishModal.setAttribute("aria-hidden", "true");
}

function createFloatingKrathong(wish, mine = false, spread = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "floating-krathong";
  button.setAttribute("aria-label", `คำอธิษฐานของ ${wish.name || "ผู้ลอยกระทง"}: ${wish.message}`);
  button.style.top = `${14 + Math.random() * 46}%`;
  button.style.setProperty("--duration", `${(17 + Math.random() * 13) * (SLOWDOWN_MIN + Math.random() * (SLOWDOWN_MAX - SLOWDOWN_MIN))}s`);
  button.style.setProperty("--float-color", COLORS[wish.color] || COLORS.gold);
  const dur = parseFloat(button.style.getPropertyValue("--duration"));
  // spread = กระทงชุดแรกตอนเปิดเว็บ ให้กระจายอยู่ทั่วแม่น้ำ ไม่กองรวมที่ขอบซ้าย
  button.style.animationDelay = spread ? `-${Math.random() * dur * 0.9}s` : `${Math.random() * 1.5}s`;
  button.innerHTML = `
    <span class="kr-body">
      <span class="float-leaf"></span><span class="float-base"></span>
      <span class="float-flower">✿</span><span class="float-flower f2">✿</span><span class="float-flower f3">✿</span>
      <span class="float-candle"></span><span class="float-flame"></span>
    </span>`;
  // ป้ายชื่อ + ข้อความ (ใช้ textContent เพื่อกัน XSS) ข้อความจะโชว์เมื่อเอาเมาส์ชี้
  const tag = document.createElement("span");
  tag.className = "float-tag";
  const who = document.createElement("b");
  who.textContent = wish.name || "ผู้ลอยกระทง";
  const msg = document.createElement("span");
  msg.className = "msg";
  msg.textContent = wish.message;
  tag.append(who, msg);
  button.prepend(tag);
  button.dataset.wishId = wish.id;
  if (mine) button.classList.add("mine");
  button.addEventListener("animationend", () => {
    button.remove();
    // ลอยพ้นจอแล้ว ปล่อยกระทงใบอื่นแบบสุ่มลงมาแทน แม่น้ำจะได้ไม่ว่าง
    const t = setTimeout(spawnRandomWish, 800 + Math.random() * 2500);
    animationTimers.add(t);
  });
  riverStage.appendChild(button);
  return button;
}

function spawnRandomWish() {
  const shown = new Set([...riverStage.querySelectorAll(".floating-krathong")].map(el => el.dataset.wishId));
  const pool = wishes.filter(w => !shown.has(String(w.id)));
  if (pool.length) showWishOnRiver(pool[Math.floor(Math.random() * pool.length)]);
}

function showWishOnRiver(wish, mine = false, spread = false) {
  // แสดงกระทงใหม่ทันที โดยจำกัดจำนวนภาพเคลื่อนไหวที่อยู่พร้อมกัน
  const current = riverStage.querySelectorAll(".floating-krathong");
  if (current.length >= MAX_VISIBLE_KRATHONGS) current[0].remove();
  createFloatingKrathong(wish, mine, spread);
}

function renderInitialWishes() {
  // สุ่มเลือกกระทงมาแสดงบนแม่น้ำ ไม่จำเป็นต้องแสดงทั้งหมดพร้อมกัน
  const shuffled = [...wishes].sort(() => Math.random() - 0.5);
  shuffled.slice(0, MAX_VISIBLE_KRATHONGS).forEach((wish, index) => {
    const timer = setTimeout(() => showWishOnRiver(wish, false, true), index * 150);
    animationTimers.add(timer);
  });
  updateCount();
}

function renderAllWishes() {
  const list = document.querySelector("#wishesList");
  list.replaceChildren();
  if (!wishes.length) {
    const empty = document.createElement("p");
    empty.className = "no-wishes";
    empty.textContent = "ยังไม่มีคำอธิษฐาน ลองสร้างกระทงใบแรกดูสิ";
    list.appendChild(empty);
    return;
  }
  [...wishes].reverse().forEach(wish => {
    const item = document.createElement("article");
    item.className = "wish-item";
    const message = document.createElement("p");
    message.textContent = wish.message;
    const author = document.createElement("small");
    author.textContent = wish.name ? `— ${wish.name}` : "— ผู้ลอยกระทง";
    item.append(message, author);
    list.appendChild(item);
  });
}

function addWishToMemory(wish, shouldAnimate = true, mine = false) {
  if (wishes.some(item => item.id === wish.id)) return;
  wishes.push(wish);
  if (totalCount !== null) totalCount++;
  if (wishes.length > 300) wishes = wishes.slice(-300);
  updateCount();
  if (shouldAnimate) showWishOnRiver(wish, mine);
}

async function setupSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    liveStatus.textContent = "โหมดทดลองบนเครื่อง";
    return;
  }

  try {
    // โหลด Supabase client เฉพาะเมื่อผู้ใช้ใส่ URL และ key แล้ว
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabaseClient
      .from("krathongs")
      .select("id, name, message, color, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    const { count } = await supabaseClient.from("krathongs").select("id", { count: "exact", head: true }).eq("approved", true);
    if (typeof count === "number") totalCount = count;
    wishes = (data || []).reverse().map(row => ({
      id: row.id,
      name: row.name || "",
      message: row.message,
      color: row.color || "gold",
      created_at: row.created_at
    }));
    renderInitialWishes();

    supabaseClient
      .channel("public-krathongs")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "krathongs",
        filter: "approved=eq.true"
      }, payload => {
        const row = payload.new;
        addWishToMemory({
          id: row.id,
          name: row.name || "",
          message: row.message,
          color: row.color || "gold",
          created_at: row.created_at
        }, true, false);
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          liveStatus.textContent = "กำลังลอยแบบ Real-time";
          document.querySelector(".live-indicator").classList.add("is-live");
        }
      });
  } catch (error) {
    console.error("Supabase connection error:", error);
    liveStatus.textContent = "เชื่อมต่อฐานข้อมูลไม่สำเร็จ";
    setStatus("ยังเชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบการตั้งค่า Supabase", true);
  }
}

// เปลี่ยนสีตัวอย่างกระทง
document.querySelectorAll(".color-choice").forEach(button => {
  button.addEventListener("click", () => {
    selectedColor = button.dataset.color;
    document.querySelectorAll(".color-choice").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    previewKrathong.dataset.color = selectedColor;
  });
});

// นับจำนวนตัวอักษร
messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length}/${MAX_MESSAGE_LENGTH}`;
});

// ส่งกระทง
form.addEventListener("submit", async event => {
  event.preventDefault();

  // ช่องล่อบอต: ถ้ามีการกรอก แสดงว่าน่าจะเป็นการส่งอัตโนมัติ
  if (document.querySelector("#website").value) return;

  const name = nameInput.value.trim().slice(0, MAX_NAME_LENGTH);
  const message = messageInput.value.trim();

  if (!message) {
    setStatus("กรุณาเขียนคำอธิษฐานก่อนส่ง", true);
    messageInput.focus();
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    setStatus(`ข้อความต้องไม่เกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`, true);
    return;
  }
  if (containsBlockedWord(`${name} ${message}`)) {
    setStatus("ข้อความมีคำที่ไม่อนุญาต กรุณาแก้ไขก่อนส่ง", true);
    return;
  }

  const now = Date.now();
  if (now - lastSubmitAt < MIN_SECONDS_BETWEEN_SUBMITS * 1000) {
    setStatus("กรุณารอสักครู่ก่อนส่งกระทงใบถัดไป", true);
    return;
  }

  const wish = {
    id: makeId(),
    name,
    message,
    color: selectedColor,
    created_at: new Date().toISOString()
  };

  submitButton.disabled = true;
  setStatus("กำลังส่งกระทง...");

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("krathongs")
        .insert({
          name: wish.name,
          message: wish.message,
          color: wish.color,
          approved: true
        })
        .select("id, name, message, color, created_at")
        .single();

      if (error) throw error;
      wish.id = data.id;
      wish.created_at = data.created_at;
      // กระทงของผู้ส่งแสดงทันที ไม่ต้องรอ event realtime ของตัวเอง
      addWishToMemory(wish, true, true);
    } else {
      addWishToMemory(wish, true, true);
      saveLocalWishes();
    }

    lastSubmitAt = now;
    form.reset();
    charCount.textContent = `0/${MAX_MESSAGE_LENGTH}`;
    setStatus(supabaseClient
      ? "ส่งกระทงสำเร็จ กระทงของคุณกำลังลอยอยู่บนสายน้ำ"
      : "ส่งกระทงสำเร็จในโหมดทดลอง ข้อมูลยังอยู่เฉพาะเบราว์เซอร์นี้");
    document.querySelector("#river").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Submit error:", error);
    setStatus("ส่งกระทงไม่สำเร็จ กรุณาลองอีกครั้ง", true);
  } finally {
    submitButton.disabled = false;
  }
});

// เปิด/ปิดหน้าต่างอ่านข้อความ
wishModal.addEventListener("click", event => {
  if (event.target.dataset.close === "true") closeWish();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeWish();
    allWishesModal.classList.remove("open");
    allWishesModal.setAttribute("aria-hidden", "true");
  }
});

// ดูคำอธิษฐานทั้งหมด
document.querySelector("#showWishes").addEventListener("click", () => {
  renderAllWishes();
  allWishesModal.classList.add("open");
  allWishesModal.setAttribute("aria-hidden", "false");
});
allWishesModal.addEventListener("click", event => {
  if (event.target.dataset.closeAll === "true") {
    allWishesModal.classList.remove("open");
    allWishesModal.setAttribute("aria-hidden", "true");
  }
});

// เริ่มต้นเว็บไซต์
wishes = loadLocalWishes();
renderInitialWishes();
setupSupabase();
