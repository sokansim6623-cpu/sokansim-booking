const $ = id => document.getElementById(id);

const form = $("reservationForm");
const nameInput = $("patientName");
const birthInput = $("birthDate");
const phoneInput = $("phoneNumber");
const dateInput = $("appointmentDate");
const dateGuide = $("dateGuide");
const timeArea = $("timeArea");
const privacyInput = $("privacyConsent");
const submitButton = $("submitButton");
const errorMessage = $("errorMessage");
const existingScreen = $("existingScreen");
const existingSummary = $("existingSummary");
const changeButton = $("changeButton");
const cancelButton = $("cancelButton");
const backButton = $("backButton");
const manageError = $("manageError");
const successScreen = $("successScreen");
const successTitle = $("successTitle");
const successGuide = $("successGuide");
const reservationSummary = $("reservationSummary");
const homeButton = $("homeButton");
const calendarTitle = $("calendarTitle");
const calendarDays = $("calendarDays");
const previousMonthButton = $("previousMonth");
const nextMonthButton = $("nextMonth");

const morning = ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
const afternoon = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

let selectedTime = "";
let closedDates = new Set();
let bookedSlots = new Set();
let calendarMonth = new Date();
let requestMode = "reservation";
let activeReservation = null;

calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);

const pad = number => String(number).padStart(2, "0");
const toKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date, days) => {
  const changed = new Date(date);
  changed.setDate(changed.getDate() + days);
  return changed;
};
const parseDate = key => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const formatDate = key => {
  const date = parseDate(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
};
const formatAppointment = appointment => {
  const match = String(appointment || "").match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (!match) return String(appointment || "");
  return `${formatDate(match[1])}<br>${match[2] < "13:00" ? "오전" : "오후"} ${match[2]}`;
};

function bookingRange() {
  const today = new Date();
  const minimum = addDays(today, 1);
  const maximum = addDays(today, 90);
  return { minimum, maximum, start: toKey(minimum), end: toKey(maximum) };
}

function showError(message, target = errorMessage) {
  target.textContent = message;
  target.classList.add("show");
}

function clearError(target = errorMessage) {
  target.textContent = "";
  target.classList.remove("show");
}

function isDisabledDate(date) {
  const range = bookingRange();
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const minimum = new Date(range.minimum.getFullYear(), range.minimum.getMonth(), range.minimum.getDate());
  const maximum = new Date(range.maximum.getFullYear(), range.maximum.getMonth(), range.maximum.getDate());
  return value < minimum || value > maximum || date.getDay() === 0 || date.getDay() === 6 || closedDates.has(toKey(date));
}

function renderCalendar() {
  calendarDays.innerHTML = "";
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  calendarTitle.textContent = `${year}년 ${month + 1}월`;

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    const empty = document.createElement("span");
    empty.className = "day empty-day";
    calendarDays.appendChild(empty);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const date = new Date(year, month, day);
    const key = toKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = day;
    button.className = "day";

    if (key === dateInput.value) button.classList.add("selected");

    if (isDisabledDate(date)) {
      button.disabled = true;
      button.classList.add("disabled");
    } else {
      button.addEventListener("click", () => selectDate(key, button));
    }

    calendarDays.appendChild(button);
  }

  const range = bookingRange();
  previousMonthButton.disabled = new Date(year, month, 0) < range.minimum;
  nextMonthButton.disabled = new Date(year, month + 1, 1) > range.maximum;
}

function selectDate(key, button) {
  dateInput.value = key;
  selectedTime = "";
  document.querySelectorAll(".day").forEach(item => item.classList.remove("selected"));
  button.classList.add("selected");
  dateGuide.textContent = `${formatDate(key)} 진료시간을 선택해 주세요.`;
  renderTimes(key);
  clearError();
}

previousMonthButton.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});

function renderTimes(dateKey) {
  selectedTime = "";
  timeArea.innerHTML = "";
  timeArea.className = "time-grid";
  const times = parseDate(dateKey).getDay() === 4 ? [...morning, ...afternoon] : morning;

  times.forEach(time => {
    const button = document.createElement("button");
    const slotKey = `${dateKey} ${time}`;
    const currentSlot = activeReservation && activeReservation.appointment === slotKey;
    const taken = bookedSlots.has(slotKey) && !currentSlot;
    button.type = "button";
    button.className = "time-button";
    button.disabled = taken;
    button.textContent = taken ? `${time} 마감` : time;
    button.addEventListener("click", () => {
      document.querySelectorAll(".time-button").forEach(item => item.classList.remove("selected"));
      selectedTime = time;
      button.classList.add("selected");
      clearError();
    });
    timeArea.appendChild(button);
  });
}

async function loadAvailability() {
  const range = bookingRange();
  try {
    const response = await fetch(`/api/availability?start=${range.start}&end=${range.end}&t=${Date.now()}`, {
      cache: "no-store"
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    closedDates = new Set(result.closedDates || []);
    bookedSlots = new Set(result.bookedSlots || []);
  } catch (error) {
    showError(error.message || "예약 일정을 불러오지 못했습니다.");
  }
  renderCalendar();
}

birthInput.addEventListener("input", () => {
  birthInput.value = birthInput.value.replace(/\D/g, "").slice(0, 8);
});

phoneInput.addEventListener("input", () => {
  const digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) phoneInput.value = digits;
  else if (digits.length <= 7) phoneInput.value = `${digits.slice(0, 3)}-${digits.slice(3)}`;
  else phoneInput.value = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
});

function getPatientData() {
  return {
    patientName: nameInput.value.trim(),
    birthDate: birthInput.value,
    phoneNumber: phoneInput.value
  };
}

function validateForm() {
  const patient = getPatientData();
  if (!/^[가-힣a-zA-Z\s]{2,20}$/.test(patient.patientName)) return "성함을 정확히 입력해 주세요.";
  if (!/^\d{8}$/.test(patient.birthDate)) return "생년월일 8자리를 확인해 주세요.";
  if (!/^01[016789]-\d{3,4}-\d{4}$/.test(patient.phoneNumber)) return "휴대전화번호를 확인해 주세요.";
  if (!dateInput.value || !selectedTime) return "예약 희망 날짜와 시간대를 선택해 주세요.";
  if (!privacyInput.checked) return "개인정보 수집·이용에 동의해 주세요.";
  return "";
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearError();
  const validationError = validateForm();
  if (validationError) return showError(validationError);

  setSubmitting(true);

  try {
    const patient = getPatientData();
    const response = await fetch("/api/reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: requestMode,
        ...patient,
        appointmentDate: dateInput.value,
        appointmentTime: selectedTime,
        reservationId: activeReservation ? activeReservation.reservationId : "",
        privacyConsent: true
      })
    });
    const result = await response.json();

    if (result.code === "existing_reservation") {
      showExistingReservation(result.reservation);
      return;
    }
    if (!response.ok) throw new Error(result.error);

    const title = requestMode === "change" ? "예약이 변경되었습니다." : "예약 신청이 접수되었습니다.";
    showSuccess(title, dateInput.value, selectedTime);
  } catch (error) {
    showError(error.message || "예약 신청 중 오류가 발생했습니다.");
  } finally {
    setSubmitting(false);
  }
});

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.innerHTML = isSubmitting
    ? '<span class="spinner"></span> 예약을 확인하고 있습니다.'
    : requestMode === "change"
      ? '예약 변경하기 <span>→</span>'
      : '예약 신청하기 <span>→</span>';
}

function showExistingReservation(reservation) {
  activeReservation = reservation;
  existingSummary.innerHTML = `<span>예약 환자</span><strong>${escapeHtml(reservation.patientName)}</strong><span>예약 일시</span><strong>${formatAppointment(reservation.appointment)}</strong>`;
  form.classList.add("hidden");
  successScreen.classList.add("hidden");
  existingScreen.classList.remove("hidden");
  existingScreen.scrollIntoView({ behavior: "smooth" });
}

changeButton.addEventListener("click", async () => {
  requestMode = "change";
  existingScreen.classList.add("hidden");
  form.classList.remove("hidden");
  dateInput.value = "";
  selectedTime = "";
  dateGuide.textContent = "변경할 날짜와 시간을 선택해 주세요.";
  timeArea.className = "empty";
  timeArea.textContent = "먼저 변경할 날짜를 선택해 주세요.";
  nameInput.readOnly = true;
  birthInput.readOnly = true;
  phoneInput.readOnly = true;
  privacyInput.checked = true;
  setSubmitting(false);
  await loadAvailability();
  form.scrollIntoView({ behavior: "smooth" });
});

cancelButton.addEventListener("click", async () => {
  if (!activeReservation) return;
  clearError(manageError);
  if (!window.confirm("예약을 취소하시겠습니까?")) return;

  cancelButton.disabled = true;
  cancelButton.textContent = "취소 처리 중…";

  try {
    const response = await fetch("/api/reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel",
        ...getPatientData(),
        reservationId: activeReservation.reservationId
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showSuccess("예약이 취소되었습니다.", "", "");
  } catch (error) {
    showError(error.message || "예약 취소 중 오류가 발생했습니다.", manageError);
  } finally {
    cancelButton.disabled = false;
    cancelButton.textContent = "예약 취소";
  }
});

backButton.addEventListener("click", resetPage);
homeButton.addEventListener("click", resetPage);

function showSuccess(title, dateKey, time) {
  successTitle.textContent = title;
  successGuide.textContent = title.includes("취소")
    ? "취소된 시간은 다시 예약할 수 있습니다."
    : "예약이 완료되면 확정 안내 문자를 보내드리겠습니다.";
  reservationSummary.innerHTML = dateKey
    ? `<strong>${formatDate(dateKey)}</strong><br>${time < "13:00" ? "오전" : "오후"} ${time}`
    : "예약 취소가 정상적으로 처리되었습니다.";
  form.classList.add("hidden");
  existingScreen.classList.add("hidden");
  successScreen.classList.remove("hidden");
  successScreen.scrollIntoView({ behavior: "smooth" });
}

function resetPage() {
  window.location.reload();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

loadAvailability();
