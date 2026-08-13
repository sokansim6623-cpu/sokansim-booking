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

const calendarTitle = document.getElementById("calendarTitle");
const calendarDays = document.getElementById("calendarDays");
const previousMonthButton =
  document.getElementById("previousMonth");
const nextMonthButton =
  document.getElementById("nextMonth");

const morningTimes = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30"
];

const afternoonTimes = [
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30"
];

const weekdays = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토"
];

/*
 * 구글시트 연결이 늦어도 먼저 차단되는
 * 2026년 공휴일·대체공휴일
 */
const fixedClosedDates = new Set([
  "2026-01-01",

  "2026-02-16",
  "2026-02-17",
  "2026-02-18",

  "2026-03-01",
  "2026-03-02",

  "2026-05-05",
  "2026-05-24",
  "2026-05-25",

  "2026-06-03",
  "2026-06-06",

  "2026-07-17",

  "2026-08-15",
  "2026-08-17",

  "2026-09-24",
  "2026-09-25",
  "2026-09-26",

  "2026-10-03",
  "2026-10-05",
  "2026-10-09",

  "2026-12-25"
]);

let selectedTime = "";
let closedDates = new Set(fixedClosedDates);
let bookedSlots = new Set();

let calendarMonth = new Date();

calendarMonth = new Date(
  calendarMonth.getFullYear(),
  calendarMonth.getMonth(),
  1
);

function pad(number) {
  return String(number).padStart(2, "0");
}

function toDateKey(date) {
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
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

/*
 * 다음 날부터 90일까지 예약 가능
 */
function getDateRange() {
  const today = new Date();
  const minimumDate = addDays(today, 1);
  const maximumDate = addDays(today, 90);

  return {
    minimumDate,
    maximumDate,
    start: toDateKey(minimumDate),
    end: toDateKey(maximumDate)
  };
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.remove("show");
}

/*
 * 예약할 수 없는 날짜 확인
 */
function isDisabledDate(date) {
  const range = getDateRange();
  const dateKey = toDateKey(date);
  const day = date.getDay();

  const selectedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const minimumDate = new Date(
    range.minimumDate.getFullYear(),
    range.minimumDate.getMonth(),
    range.minimumDate.getDate()
  );

  const maximumDate = new Date(
    range.maximumDate.getFullYear(),
    range.maximumDate.getMonth(),
    range.maximumDate.getDate()
  );

  return (
    selectedDate < minimumDate ||
    selectedDate > maximumDate ||
    day === 0 ||
    day === 6 ||
    closedDates.has(dateKey)
  );
}

/*
 * 예약 달력 표시
 */
function renderCalendar() {
  calendarDays.innerHTML = "";

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const firstDay = new Date(
    year,
    month,
    1
  );

  const lastDate = new Date(
    year,
    month + 1,
    0
  ).getDate();

  calendarTitle.textContent =
    `${year}년 ${month + 1}월`;

  /*
   * 월 시작 전 빈칸
   */
  for (
    let index = 0;
    index < firstDay.getDay();
    index += 1
  ) {
    const emptyDay =
      document.createElement("span");

    emptyDay.className = "day empty";

    calendarDays.appendChild(emptyDay);
  }

  /*
   * 날짜 버튼
   */
  for (
    let day = 1;
    day <= lastDate;
    day += 1
  ) {
    const date = new Date(
      year,
      month,
      day
    );

    const dateKey = toDateKey(date);

    const button =
      document.createElement("button");

    button.type = "button";
    button.textContent = day;
    button.className = "day";

    if (dateInput.value === dateKey) {
      button.classList.add("selected");
    }

    if (isDisabledDate(date)) {
      button.disabled = true;
      button.classList.add("disabled");
    } else {
      button.addEventListener(
        "click",
        function () {
          dateInput.value = dateKey;
          selectedTime = "";

          document
            .querySelectorAll(".day")
            .forEach(function (calendarButton) {
              calendarButton.classList.remove(
                "selected"
              );
            });

          button.classList.add("selected");

          dateGuide.textContent =
            `${formatDate(dateKey)} ` +
            "진료시간을 선택해 주세요.";

          renderTimes(dateKey);
          clearError();
        }
      );
    }

    calendarDays.appendChild(button);
  }

  /*
   * 이전 달·다음 달 버튼 제한
   */
  const range = getDateRange();

  const previousMonthEnd = new Date(
    year,
    month,
    0
  );

  const nextMonthStart = new Date(
    year,
    month + 1,
    1
  );

  previousMonthButton.disabled =
    previousMonthEnd <
    range.minimumDate;

  nextMonthButton.disabled =
    nextMonthStart >
    range.maximumDate;
}

previousMonthButton.addEventListener(
  "click",
  function () {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() - 1,
      1
    );

    renderCalendar();
  }
);

nextMonthButton.addEventListener(
  "click",
  function () {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      1
    );

    renderCalendar();
  }
);

/*
 * 목요일은 오전·오후
 * 그 외 평일은 오전
 */
function getTimesForDate(dateKey) {
  const date = parseDate(dateKey);

  if (date.getDay() === 4) {
    return [
      ...morningTimes,
      ...afternoonTimes
    ];
  }

  return morningTimes;
}

/*
 * 시간대 버튼 표시
 */
function renderTimes(dateKey) {
  selectedTime = "";

  timeArea.innerHTML = "";
  timeArea.className = "time-grid";

  const times = getTimesForDate(dateKey);

  times.forEach(function (time) {
    const button =
      document.createElement("button");

    const slotKey =
      `${dateKey} ${time}`;

    const isBooked =
      bookedSlots.has(slotKey);

    button.type = "button";
    button.className = "time-button";
    button.disabled = isBooked;

    button.textContent =
      isBooked
        ? `${time} 마감`
        : time;

    button.addEventListener(
      "click",
      function () {
        document
          .querySelectorAll(".time-button")
          .forEach(function (timeButton) {
            timeButton.classList.remove(
              "selected"
            );
          });

        selectedTime = time;

        button.classList.add("selected");

        clearError();
      }
    );

    timeArea.appendChild(button);
  });
}

/*
 * 달력을 먼저 바로 표시하고
 * 휴진일·예약 마감시간은 뒤에서 불러오기
 */
async function loadAvailability() {
  const range = getDateRange();

  /*
   * 기본 달력 즉시 표시
   */
  closedDates = new Set(
    fixedClosedDates
  );

  renderCalendar();

  try {
    const response = await fetch(
      `/api/availability?start=${range.start}` +
      `&end=${range.end}`
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    /*
     * 구글시트 휴진일 추가
     */
    closedDates = new Set([
      ...fixedClosedDates,
      ...(result.closedDates || [])
    ]);

    /*
     * 이미 예약된 시간 추가
     */
    bookedSlots = new Set(
      result.bookedSlots || []
    );

    /*
     * 휴진일과 마감시간 반영
     */
    renderCalendar();

    if (dateInput.value) {
      renderTimes(dateInput.value);
    }
  } catch (error) {
    showError(
      "휴진일 정보를 불러오지 못했습니다. " +
      "새로고침해 주세요."
    );
  }
}

/*
 * 생년월일은 숫자 8자리만 입력
 */
birthInput.addEventListener(
  "input",
  function () {
    birthInput.value =
      birthInput.value
        .replace(/\D/g, "")
        .slice(0, 8);
  }
);

/*
 * 휴대전화번호는 숫자 4자리만 입력
 */
phoneInput.addEventListener(
  "input",
  function () {
    phoneInput.value =
      phoneInput.value
        .replace(/\D/g, "")
        .slice(0, 4);
  }
);

/*
 * 예약 신청
 */
form.addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    clearError();

    const patientName =
      nameInput.value.trim();

    const birthDate =
      birthInput.value;

    const phoneLast4 =
      phoneInput.value;

    const appointmentDate =
      dateInput.value;

    if (
      !/^[가-힣a-zA-Z\s]{2,20}$/.test(
        patientName
      )
    ) {
      showError(
        "성함을 정확히 입력해 주세요."
      );

      return;
    }

    if (!/^\d{8}$/.test(birthDate)) {
      showError(
        "생년월일 8자리를 확인해 주세요."
      );

      return;
    }

    if (!/^\d{4}$/.test(phoneLast4)) {
      showError(
        "휴대전화번호 뒤 4자리를 확인해 주세요."
      );

      return;
    }

    if (
      !appointmentDate ||
      !selectedTime
    ) {
      showError(
        "예약 희망 날짜와 시간대를 선택해 주세요."
      );

      return;
    }

    if (!privacyInput.checked) {
      showError(
        "개인정보 수집·이용에 동의해 주세요."
      );

      return;
    }

    submitButton.disabled = true;

    submitButton.textContent =
      "신청 중입니다…";

    try {
      const response = await fetch(
        "/api/reservation",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            patientName,
            birthDate,
            phoneLast4,
            appointmentDate,
            appointmentTime:
              selectedTime,
            privacyConsent: true
          })
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error
        );
      }

      reservationSummary.innerHTML =
        `<strong>` +
        `${formatDate(appointmentDate)}` +
        `</strong><br>` +
        `${selectedTime < "13:00"
          ? "오전"
          : "오후"} ` +
        selectedTime;

      form.classList.add("hidden");

      successScreen.classList.remove(
        "hidden"
      );

      successScreen.scrollIntoView({
        behavior: "smooth"
      });
    } catch (error) {
      showError(
        error.message ||
        "예약 신청 중 오류가 발생했습니다."
      );

      submitButton.disabled = false;

      submitButton.innerHTML =
        '예약 신청하기 <span>→</span>';
    }
  }
);

loadAvailability();