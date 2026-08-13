const form = document.getElementById("reservationForm");
const nameInput = document.getElementById("patientName");
const birthInput = document.getElementById("birthDate");
const phoneInput = document.getElementById("phoneLast4");
const dateInput = document.getElementById("appointmentDate");
const dateGuide = document.getElementById("dateGuide");
const timeArea = document.getElementById("timeArea");
const privacyInput = document.getElementById("privacyConsent");
const submitButton = document.getElementById("submitButton");
const errorMessage = document.getElementById("errorMessage");
const successScreen = document.getElementById("successScreen");
const reservationSummary = document.getElementById("reservationSummary");

const morningTimes = [
  "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30"
];

const afternoonTimes = [
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30"
];

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

let selectedTime = "";
let closedDates = new Set();
let bookedSlots = new Set();

function pad(number) {
  return String(number).padStart(2, "0");
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(dateKey) {
  const date = parseDate(dateKey);

  return (
    `${date.getFullYear()}년 ` +
    `${date.getMonth() + 1}월 ` +
    `${date.getDate()}일 ` +
    `(${weekdays[date.getDay()]})`
  );
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.remove("show");
}

function setDateRange() {
  const today = new Date();
  const minimumDate = addDays(today, 1);
  const maximumDate = addDays(today, 90);

  dateInput.min = toDateKey(minimumDate);
  dateInput.max = toDateKey(maximumDate);

  return {
    start: toDateKey(minimumDate),
    end: toDateKey(maximumDate)
  };
}

async function loadAvailability() {
  const range = setDateRange();

  try {
    const response = await fetch(
      `/api/availability?start=${range.start}&end=${range.end}`
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    closedDates = new Set(result.closedDates || []);
    bookedSlots = new Set(result.bookedSlots || []);
  } catch (error) {
    showError(
      error.message || "예약 일정을 불러오지 못했습니다."
    );
  }
}

function getTimesForDate(dateKey) {
  const date = parseDate(dateKey);

  if (date.getDay() === 4) {
    return [...morningTimes, ...afternoonTimes];
  }

  return morningTimes;
}

function renderTimes(dateKey) {
  selectedTime = "";
  timeArea.innerHTML = "";
  timeArea.className = "time-grid";

  const times = getTimesForDate(dateKey);

  times.forEach(function (time) {
    const button = document.createElement("button");
    const slotKey = `${dateKey} ${time}`;
    const isBooked = bookedSlots.has(slotKey);

    button.type = "button";
    button.className = "time-button";
    button.disabled = isBooked;
    button.textContent = isBooked ? `${time} 마감` : time;

    button.addEventListener("click", function () {
      document
        .querySelectorAll(".time-button")
        .forEach(function (item) {
          item.classList.remove("selected");
        });

      selectedTime = time;
      button.classList.add("selected");
      clearError();
    });

    timeArea.appendChild(button);
  });
}

dateInput.addEventListener("change", function () {
  clearError();
  selectedTime = "";

  const selectedDate = dateInput.value;

  if (!selectedDate) {
    timeArea.className = "empty-time";
    timeArea.textContent = "먼저 예약 희망일을 선택해 주세요.";
    return;
  }

  const date = parseDate(selectedDate);
  const day = date.getDay();

  if (day === 0 || day === 6) {
    dateInput.value = "";
    timeArea.className = "empty-time";
    timeArea.textContent = "먼저 예약 희망일을 선택해 주세요.";
    dateGuide.textContent =
      "토요일과 일요일은 휴진입니다. 다른 날짜를 선택해 주세요.";
    return;
  }

  if (closedDates.has(selectedDate)) {
    dateInput.value = "";
    timeArea.className = "empty-time";
    timeArea.textContent = "먼저 예약 희망일을 선택해 주세요.";
    dateGuide.textContent =
      "공휴일·대체공휴일 또는 휴진일입니다. 다른 날짜를 선택해 주세요.";
    return;
  }

  dateGuide.textContent =
    "날짜 입력칸을 누르면 달력이 열립니다. 당일 예약은 신청할 수 없습니다.";

  renderTimes(selectedDate);
});

birthInput.addEventListener("input", function () {
  birthInput.value = birthInput.value
    .replace(/\D/g, "")
    .slice(0, 8);
});

phoneInput.addEventListener("input", function () {
  phoneInput.value = phoneInput.value
    .replace(/\D/g, "")
    .slice(0, 4);
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearError();

  const patientName = nameInput.value.trim();
  const birthDate = birthInput.value;
  const phoneLast4 = phoneInput.value;
  const appointmentDate = dateInput.value;

  if (!/^[가-힣a-zA-Z\s]{2,20}$/.test(patientName)) {
    showError("성함을 정확히 입력해 주세요.");
    return;
  }

  if (!/^\d{8}$/.test(birthDate)) {
    showError("생년월일 8자리를 확인해 주세요.");
    return;
  }

  if (!/^\d{4}$/.test(phoneLast4)) {
    showError("휴대전화번호 뒤 4자리를 확인해 주세요.");
    return;
  }

  if (!appointmentDate || !selectedTime) {
    showError("예약 희망 날짜와 시간대를 선택해 주세요.");
    return;
  }

  if (!privacyInput.checked) {
    showError("개인정보 수집·이용에 동의해 주세요.");
    return;
  }

  submitButton.disabled = true;
  submitButton.innerHTML = "신청 중입니다…";

  try {
    const response = await fetch("/api/reservation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patientName,
        birthDate,
        phoneLast4,
        appointmentDate,
        appointmentTime: selectedTime,
        privacyConsent: true
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    reservationSummary.innerHTML =
      `<strong>${formatDate(appointmentDate)}</strong><br>` +
      `${selectedTime < "13:00" ? "오전" : "오후"} ${selectedTime}`;

    form.classList.add("hidden");
    successScreen.classList.remove("hidden");

    window.scrollTo({
      top: successScreen.offsetTop - 20,
      behavior: "smooth"
    });
  } catch (error) {
    showError(
      error.message ||
      "예약 신청 중 오류가 발생했습니다."
    );

    submitButton.disabled = false;
    submitButton.innerHTML =
      "예약 신청하기 <span>→</span>";
  }
});

loadAvailability();