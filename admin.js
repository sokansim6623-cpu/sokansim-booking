const $ = (id) => document.getElementById(id);
const form = $("adminForm");
const chartInput = $("chartNo");
const nameInput = $("patientName");
const phoneInput = $("phoneLast4");
const memoInput = $("memo");
const dateInput = $("appointmentDate");
const dateGuide = $("dateGuide");
const timeArea = $("timeArea");
const submitButton = $("submitButton");
const adminError = $("adminError");
const calendarTitle = $("calendarTitle");
const calendarDays = $("calendarDays");
const previousMonthButton = $("previousMonth");
const nextMonthButton = $("nextMonth");
const successScreen = $("successScreen");
const reservationSummary = $("reservationSummary");
const newReservationButton = $("newReservationButton");

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
let selectedTime = "";
let closedDates = new Set();
let bookedSlots = new Set();
let schedule = {};
let calendarMonth = new Date();
calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);

const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parse = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
const format = (key) => { const d = parse(key); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`; };

function range() {
  const today = new Date();
  return { min: today, max: addDays(today, 180), start: toKey(today), end: toKey(addDays(today, 180)) };
}
function showError(element, message) { element.textContent = message; element.classList.add("show"); }
function clearError(element) { element.textContent = ""; element.classList.remove("show"); }
function isDisabled(date) {
  const r = range();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const min = new Date(r.min.getFullYear(), r.min.getMonth(), r.min.getDate());
  const max = new Date(r.max.getFullYear(), r.max.getMonth(), r.max.getDate());
  const daySchedule = schedule[String(date.getDay())] || [];
  return target < min || target > max || daySchedule.length === 0 || closedDates.has(toKey(date));
}

phoneInput.oninput = () => { phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 4); };
chartInput.oninput = () => { chartInput.value = chartInput.value.replace(/\s/g, "").slice(0, 20); };

function renderCalendar() {
  calendarDays.innerHTML = "";
  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0).getDate();
  calendarTitle.textContent = `${y}년 ${m + 1}월`;

  for (let i = 0; i < first.getDay(); i++) {
    const empty = document.createElement("span");
    empty.className = "day empty";
    calendarDays.appendChild(empty);
  }

  for (let n = 1; n <= last; n++) {
    const date = new Date(y, m, n);
    const key = toKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = n;
    button.className = "day";
    if (key === dateInput.value) button.classList.add("selected");

    if (isDisabled(date)) {
      button.disabled = true;
      button.classList.add("disabled");
    } else {
      button.onclick = () => {
        dateInput.value = key;
        selectedTime = "";
        document.querySelectorAll(".day").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        dateGuide.textContent = `${format(key)} 예약 시간을 선택해 주세요.`;
        renderTimes(key);
        clearError(adminError);
      };
    }
    calendarDays.appendChild(button);
  }

  const r = range();
  previousMonthButton.disabled = new Date(y, m, 0) < new Date(r.min.getFullYear(), r.min.getMonth(), 1);
  nextMonthButton.disabled = new Date(y, m + 1, 1) > r.max;
}

previousMonthButton.onclick = () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
};
nextMonthButton.onclick = () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
};

function renderTimes(key) {
  selectedTime = "";
  timeArea.innerHTML = "";
  const times = schedule[String(parse(key).getDay())] || [];
  if (!times.length) {
    timeArea.className = "empty";
    timeArea.textContent = "예약 가능한 시간이 없습니다.";
    return;
  }

  timeArea.className = "time-grid";
  times.forEach((time) => {
    const button = document.createElement("button");
    const taken = bookedSlots.has(`${key} ${time}`);
    button.type = "button";
    button.className = "time-button";
    button.disabled = taken;
    button.textContent = taken ? `${time} 마감` : time;
    button.onclick = () => {
      document.querySelectorAll(".time-button").forEach((item) => item.classList.remove("selected"));
      selectedTime = time;
      button.classList.add("selected");
      clearError(adminError);
    };
    timeArea.appendChild(button);
  });
}

async function loadAvailability() {
  const r = range();
  closedDates = new Set();
  bookedSlots = new Set();
  schedule = {};
  try {
    const response = await fetch(`/api/availability?start=${r.start}&end=${r.end}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "예약 일정을 불러오지 못했습니다.");
    if (!result.schedule || Object.keys(result.schedule).length === 0) throw new Error("진료 일정을 불러오지 못했습니다.");
    closedDates = new Set(result.closedDates || []);
    bookedSlots = new Set(result.bookedSlots || []);
    schedule = result.schedule;
    renderCalendar();
  } catch (error) {
    calendarTitle.textContent = "일정 확인 필요";
    calendarDays.innerHTML = '<div style="grid-column:1/-1;padding:24px 8px;text-align:center;color:#c94b3f;">예약 일정을 불러오지 못했습니다.<br>잠시 후 새로고침해 주세요.</div>';
    showError(adminError, error.message || "예약 일정을 불러오지 못했습니다.");
  }
}

form.onsubmit = async (event) => {
  event.preventDefault();
  clearError(adminError);

  const chartNo = chartInput.value.trim();
  const patientName = nameInput.value.trim();
  const phoneLast4 = phoneInput.value;
  const appointmentDate = dateInput.value;
  const memo = memoInput.value.trim();

  if (!chartNo) return showError(adminError, "차트번호를 입력해 주세요.");
  if (!/^[가-힣a-zA-Z\s]{2,20}$/.test(patientName)) return showError(adminError, "환자명을 정확히 입력해 주세요.");
  if (!/^\d{4}$/.test(phoneLast4)) return showError(adminError, "휴대폰번호 뒷자리 4자리를 확인해 주세요.");
  if (!appointmentDate || !selectedTime) return showError(adminError, "예약 날짜와 시간을 선택해 주세요.");

  submitButton.disabled = true;
  submitButton.textContent = "등록 중입니다…";
  try {
    const response = await fetch("/api/admin-reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chartNo, patientName, phoneLast4, appointmentDate, appointmentTime: selectedTime, memo }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "예약을 등록하지 못했습니다.");

    reservationSummary.innerHTML = `<strong>${patientName}</strong><br>차트번호 ${chartNo}<br>${format(appointmentDate)} ${selectedTime}<br>오지혜 원장님`;
    form.classList.add("hidden");
    successScreen.classList.remove("hidden");
    successScreen.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    showError(adminError, error.message || "예약을 등록하지 못했습니다.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = '예약 등록하기 <span>→</span>';
  }
};

newReservationButton.onclick = async () => {
  form.reset();
  dateInput.value = "";
  selectedTime = "";
  timeArea.className = "empty";
  timeArea.textContent = "먼저 예약 날짜를 선택해 주세요.";
  dateGuide.textContent = "회색 날짜는 휴진일 또는 예약 불가일입니다.";
  successScreen.classList.add("hidden");
  form.classList.remove("hidden");
  calendarMonth = new Date();
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  await loadAvailability();
  form.scrollIntoView({ behavior: "smooth" });
};

loadAvailability();
