const $ = (id) => document.getElementById(id);
const lookupForm = $("lookupForm");
const nameInput = $("patientName");
const phoneInput = $("phoneLast4");
const lookupButton = $("lookupButton");
const lookupError = $("lookupError");
const reservationCard = $("reservationCard");
const reservationList = $("reservationList");
const changeCard = $("changeCard");
const cancelCard = $("cancelCard");
const successCard = $("successCard");
const changeCloseButton = $("changeCloseButton");
const cancelCloseButton = $("cancelCloseButton");
const changeSubmitButton = $("changeSubmitButton");
const cancelSubmitButton = $("cancelSubmitButton");
const changeError = $("changeError");
const cancelError = $("cancelError");
const dateInput = $("appointmentDate");
const dateGuide = $("dateGuide");
const timeArea = $("timeArea");
const calendarTitle = $("calendarTitle");
const calendarDays = $("calendarDays");
const previousMonthButton = $("previousMonth");
const nextMonthButton = $("nextMonth");
const changeCurrentSummary = $("changeCurrentSummary");
const cancelSummary = $("cancelSummary");
const successTitle = $("successTitle");
const successSummary = $("successSummary");
const restartButton = $("restartButton");

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
let reservations = [];
let currentReservation = null;
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

lookupForm.onsubmit = async (event) => {
  event.preventDefault();
  clearError(lookupError);
  const patientName = nameInput.value.trim();
  const phoneLast4 = phoneInput.value;

  if (!/^[가-힣a-zA-Z\s]{2,20}$/.test(patientName)) return showError(lookupError, "성함을 정확히 입력해 주세요.");
  if (!/^\d{4}$/.test(phoneLast4)) return showError(lookupError, "휴대전화번호 뒤 4자리를 확인해 주세요.");

  lookupButton.disabled = true;
  lookupButton.textContent = "확인 중입니다…";
  try {
    const response = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientName, phoneLast4 }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "예약을 확인하지 못했습니다.");

    reservations = Array.isArray(result.reservations) ? result.reservations : [];
    if (!reservations.length) throw new Error("확인되는 예약이 없습니다.");
    renderReservations();
  } catch (error) {
    reservationCard.classList.add("hidden");
    showError(lookupError, error.message || "예약을 확인하지 못했습니다.");
  } finally {
    lookupButton.disabled = false;
    lookupButton.innerHTML = '예약 확인하기 <span>→</span>';
  }
};

function renderReservations() {
  reservationList.innerHTML = "";
  reservations.forEach((reservation, index) => {
    const item = document.createElement("article");
    item.className = "reservation-item";

    const box = document.createElement("div");
    box.className = "reservation-box";

    const nameBlock = document.createElement("div");
    const nameLabel = document.createElement("span"); nameLabel.textContent = "환자명";
    const nameValue = document.createElement("strong"); nameValue.textContent = reservation.patientName;
    nameBlock.append(nameLabel, nameValue);

    const doctorBlock = document.createElement("div");
    const doctorLabel = document.createElement("span"); doctorLabel.textContent = "담당 의료진";
    const doctorValue = document.createElement("strong"); doctorValue.textContent = "오지혜 원장님";
    doctorBlock.append(doctorLabel, doctorValue);

    const dateBlock = document.createElement("div");
    dateBlock.className = "wide";
    const dateLabel = document.createElement("span"); dateLabel.textContent = "예약 일시";
    const dateValue = document.createElement("strong"); dateValue.textContent = `${format(reservation.appointmentDate)} ${reservation.appointmentTime}`;
    dateBlock.append(dateLabel, dateValue);
    box.append(nameBlock, doctorBlock, dateBlock);

    const actions = document.createElement("div");
    actions.className = "action-row";
    const changeButton = document.createElement("button");
    changeButton.type = "button";
    changeButton.className = "secondary";
    changeButton.textContent = "예약 변경";
    changeButton.onclick = () => openChange(index);
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "danger-ghost";
    cancelButton.textContent = "예약 취소";
    cancelButton.onclick = () => openCancel(index);
    actions.append(changeButton, cancelButton);

    item.append(box, actions);
    reservationList.appendChild(item);
  });

  reservationCard.classList.remove("hidden");
  changeCard.classList.add("hidden");
  cancelCard.classList.add("hidden");
  successCard.classList.add("hidden");
  reservationCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function openChange(index) {
  currentReservation = reservations[index];
  clearError(changeError);
  changeCard.classList.remove("hidden");
  cancelCard.classList.add("hidden");
  changeCurrentSummary.textContent = `현재 예약: ${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime}`;
  dateInput.value = "";
  selectedTime = "";
  timeArea.className = "empty";
  timeArea.textContent = "먼저 날짜를 선택해 주세요.";
  dateGuide.textContent = "회색 날짜는 휴진일 또는 예약 불가일입니다.";
  calendarMonth = new Date();
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  await loadAvailability();
  changeCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openCancel(index) {
  currentReservation = reservations[index];
  clearError(cancelError);
  cancelCard.classList.remove("hidden");
  changeCard.classList.add("hidden");
  cancelSummary.textContent = `${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime} · 오지혜 원장님`;
  cancelCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

changeCloseButton.onclick = () => changeCard.classList.add("hidden");
cancelCloseButton.onclick = () => cancelCard.classList.add("hidden");

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
        dateGuide.textContent = `${format(key)} 변경 시간을 선택해 주세요.`;
        renderTimes(key);
        clearError(changeError);
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
      clearError(changeError);
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
    const params = new URLSearchParams({ start: r.start, end: r.end });
    if (currentReservation) {
      params.set("excludeDate", currentReservation.appointmentDate);
      params.set("excludeTime", currentReservation.appointmentTime);
    }
    const response = await fetch(`/api/availability?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "예약 일정을 불러오지 못했습니다.");
    if (!result.schedule || Object.keys(result.schedule).length === 0) throw new Error("진료 일정을 불러오지 못했습니다.");
    closedDates = new Set(result.closedDates || []);
    bookedSlots = new Set(result.bookedSlots || []);
    schedule = result.schedule;
    renderCalendar();
  } catch (error) {
    calendarTitle.textContent = "일정 확인 필요";
    calendarDays.innerHTML = '<div style="grid-column:1/-1;padding:24px 8px;text-align:center;color:#c94b3f;">예약 일정을 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.</div>';
    showError(changeError, error.message || "예약 일정을 불러오지 못했습니다.");
  }
}

changeSubmitButton.onclick = async () => {
  clearError(changeError);
  const appointmentDate = dateInput.value;
  if (!currentReservation) return showError(changeError, "변경할 예약을 다시 선택해 주세요.");
  if (!appointmentDate || !selectedTime) return showError(changeError, "변경할 날짜와 시간을 선택해 주세요.");

  changeSubmitButton.disabled = true;
  changeSubmitButton.textContent = "변경 중입니다…";
  try {
    const originalDate = currentReservation.appointmentDate;
    const originalTime = currentReservation.appointmentTime;
    const response = await fetch("/api/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: nameInput.value.trim(),
        phoneLast4: phoneInput.value,
        originalDate,
        originalTime,
        appointmentDate,
        appointmentTime: selectedTime,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "예약을 변경하지 못했습니다.");

    successTitle.textContent = "예약이 변경되었습니다.";
    successSummary.innerHTML = `<strong>${format(appointmentDate)}</strong><br>${selectedTime} · 오지혜 원장님`;
    reservationCard.classList.add("hidden");
    changeCard.classList.add("hidden");
    cancelCard.classList.add("hidden");
    successCard.classList.remove("hidden");
    successCard.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    showError(changeError, error.message || "예약을 변경하지 못했습니다.");
  } finally {
    changeSubmitButton.disabled = false;
    changeSubmitButton.textContent = "변경 확정";
  }
};

cancelSubmitButton.onclick = async () => {
  clearError(cancelError);
  if (!currentReservation) return showError(cancelError, "취소할 예약을 다시 선택해 주세요.");

  cancelSubmitButton.disabled = true;
  cancelSubmitButton.textContent = "취소 중입니다…";
  try {
    const response = await fetch("/api/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: nameInput.value.trim(),
        phoneLast4: phoneInput.value,
        originalDate: currentReservation.appointmentDate,
        originalTime: currentReservation.appointmentTime,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "예약을 취소하지 못했습니다.");

    successTitle.textContent = "예약이 취소되었습니다.";
    successSummary.textContent = `${format(currentReservation.appointmentDate)} ${currentReservation.appointmentTime} 예약이 취소되었습니다.`;
    reservationCard.classList.add("hidden");
    changeCard.classList.add("hidden");
    cancelCard.classList.add("hidden");
    successCard.classList.remove("hidden");
    successCard.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    showError(cancelError, error.message || "예약을 취소하지 못했습니다.");
  } finally {
    cancelSubmitButton.disabled = false;
    cancelSubmitButton.textContent = "예약 취소하기";
  }
};

restartButton.onclick = () => location.reload();
