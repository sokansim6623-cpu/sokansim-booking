const RESERVATION_SHEET = "오지혜원장님 외래예약";
const CLOSED_DATE_SHEET = "휴진일";
const TIME_ZONE = "Asia/Seoul";
const KOREAN_HOLIDAY_CALENDAR = "ko.south_korea#holiday@group.v.calendar.google.com";
const RESERVATION_HEADERS = [
  "차트번호",
  "환자명",
  "휴대폰 뒷자리",
  "예약날짜",
  "예약시간",
  "메모",
  "상태",
  "비고",
];

function setupSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  spreadsheet.setSpreadsheetTimeZone(TIME_ZONE);

  let reservationSheet = spreadsheet.getSheetByName(RESERVATION_SHEET);
  if (!reservationSheet) reservationSheet = spreadsheet.insertSheet(RESERVATION_SHEET, 0);

  const migratedRows = readAndMigrateRows_(reservationSheet);
  if (!migratedRows.length) {
    const legacySheet = spreadsheet.getSheetByName("예약신청");
    if (legacySheet) migratedRows.push.apply(migratedRows, readLegacyRows_(legacySheet));
  }

  writeReservationSheet_(reservationSheet, migratedRows);
  setupClosedDateSheet_(spreadsheet);
  syncMonthlySheets_();

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty("WEBHOOK_KEY")) {
    properties.setProperty("WEBHOOK_KEY", Utilities.getUuid().replace(/-/g, ""));
  }
  if (!properties.getProperty("AVAILABILITY_VERSION")) properties.setProperty("AVAILABILITY_VERSION", "1");
  bumpAvailabilityVersion_();
  Logger.log("연동 키: " + properties.getProperty("WEBHOOK_KEY"));
}

function doGet(event) {
  if (!isAuthorized_(event)) return json_({ ok: false, error: "unauthorized" });
  if (!event.parameter || event.parameter.action !== "availability") {
    return json_({ ok: true, service: "속안심내과 오지혜 원장님 외래예약" });
  }

  try {
    const startKey = String(event.parameter.start || "");
    const endKey = String(event.parameter.end || "");
    const excludeDate = String(event.parameter.excludeDate || "");
    const excludeTime = String(event.parameter.excludeTime || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey)) {
      return json_({ ok: false, error: "invalid_range" });
    }

    const version = getAvailabilityVersion_();
    const cache = CacheService.getScriptCache();
    const cacheKey = ["availability", version, startKey, endKey, excludeDate, excludeTime].join(":");
    const cached = cache.get(cacheKey);
    if (cached) return json_(JSON.parse(cached));

    const result = {
      ok: true,
      closedDates: getClosedDateKeys_(startKey, endKey),
      bookedSlots: getBookedSlotKeys_(startKey, endKey, excludeDate, excludeTime),
    };
    cache.put(cacheKey, JSON.stringify(result), 20);
    return json_(result);
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doPost(event) {
  if (!isAuthorized_(event)) return json_({ ok: false, error: "unauthorized" });
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const action = String(payload.action || "");
    if (action === "admin_create") return createReservation_(payload);
    if (action === "lookup") return lookupReservations_(payload);
    if (action === "change") return changeReservation_(payload);
    if (action === "cancel") return cancelReservation_(payload);
    return json_({ ok: false, error: "invalid_action" });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function createReservation_(payload) {
  const chartNo = String(payload.chartNo || "").trim();
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = normalizePhoneLast4_(payload.phoneLast4);
  const appointmentDate = String(payload.appointmentDate || "").trim();
  const appointmentTime = String(payload.appointmentTime || "").trim();
  const memo = String(payload.memo || "").trim().slice(0, 300);

  if (
    !chartNo || !patientName || !/^\d{4}$/.test(phoneLast4) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}$/.test(appointmentTime)
  ) {
    return json_({ ok: false, error: "invalid_payload" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getReservationSheet_();
    if (isClosedDate_(appointmentDate)) return json_({ ok: false, error: "closed_date" });
    if (isTimeSlotTaken_(sheet, appointmentDate, appointmentTime, 0)) {
      return json_({ ok: false, error: "slot_taken" });
    }

    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 5).setNumberFormat("@");
    sheet.getRange(newRow, 1, 1, 8).setValues([[chartNo, patientName, phoneLast4, appointmentDate, appointmentTime, memo, "예약", ""]]);
    formatReservationDataRow_(sheet, newRow);
    syncMonthlySheets_();
    bumpAvailabilityVersion_();
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function lookupReservations_(payload) {
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = normalizePhoneLast4_(payload.phoneLast4);
  if (!patientName || !/^\d{4}$/.test(phoneLast4)) return json_({ ok: false, error: "invalid_payload" });

  const sheet = getReservationSheet_();
  if (sheet.getLastRow() < 2) return json_({ ok: false, error: "not_found" });

  const today = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues();
  const matches = rows
    .filter(function (row) {
      return String(row[1]).trim() === patientName &&
        normalizePhoneLast4_(row[2]) === phoneLast4 &&
        normalizeStatus_(row[6]) !== "취소" &&
        String(row[3]).trim() >= today;
    })
    .map(function (row) {
      return {
        patientName: row[1],
        appointmentDate: row[3],
        appointmentTime: row[4],
      };
    })
    .sort(function (a, b) {
      return (a.appointmentDate + " " + a.appointmentTime).localeCompare(b.appointmentDate + " " + b.appointmentTime);
    });

  if (!matches.length) return json_({ ok: false, error: "not_found" });
  return json_({ ok: true, reservations: matches });
}

function changeReservation_(payload) {
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = normalizePhoneLast4_(payload.phoneLast4);
  const originalDate = String(payload.originalDate || "").trim();
  const originalTime = String(payload.originalTime || "").trim();
  const appointmentDate = String(payload.appointmentDate || "").trim();
  const appointmentTime = String(payload.appointmentTime || "").trim();

  if (
    !patientName || !/^\d{4}$/.test(phoneLast4) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(originalDate) || !/^\d{2}:\d{2}$/.test(originalTime) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}$/.test(appointmentTime)
  ) {
    return json_({ ok: false, error: "invalid_payload" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getReservationSheet_();
    const row = findReservationRow_(sheet, patientName, phoneLast4, originalDate, originalTime);
    if (!row) return json_({ ok: false, error: "not_found" });
    if (isClosedDate_(appointmentDate)) return json_({ ok: false, error: "closed_date" });
    if (isTimeSlotTaken_(sheet, appointmentDate, appointmentTime, row)) {
      return json_({ ok: false, error: "slot_taken" });
    }

    if (originalDate !== appointmentDate || originalTime !== appointmentTime) {
      const currentRemark = String(sheet.getRange(row, 8).getDisplayValue() || "").trim();
      const changeText = "변경: " + originalDate + " " + originalTime + " → " + appointmentDate + " " + appointmentTime;
      sheet.getRange(row, 4, 1, 2).setValues([[appointmentDate, appointmentTime]]);
      sheet.getRange(row, 7).setValue("예약");
      sheet.getRange(row, 8).setValue(appendRemark_(currentRemark, changeText));
      formatReservationDataRow_(sheet, row);
      syncMonthlySheets_();
      bumpAvailabilityVersion_();
    }

    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function cancelReservation_(payload) {
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = normalizePhoneLast4_(payload.phoneLast4);
  const originalDate = String(payload.originalDate || "").trim();
  const originalTime = String(payload.originalTime || "").trim();

  if (
    !patientName || !/^\d{4}$/.test(phoneLast4) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(originalDate) || !/^\d{2}:\d{2}$/.test(originalTime)
  ) {
    return json_({ ok: false, error: "invalid_payload" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getReservationSheet_();
    const row = findReservationRow_(sheet, patientName, phoneLast4, originalDate, originalTime);
    if (!row) return json_({ ok: false, error: "not_found" });

    sheet.getRange(row, 7).setValue("취소");
    sheet.getRange(row, 8).setValue("취소");
    formatReservationDataRow_(sheet, row);
    syncMonthlySheets_();
    bumpAvailabilityVersion_();
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function findReservationRow_(sheet, patientName, phoneLast4, appointmentDate, appointmentTime) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (
      String(row[1]).trim() === patientName &&
      normalizePhoneLast4_(row[2]) === phoneLast4 &&
      String(row[3]).trim() === appointmentDate &&
      String(row[4]).trim() === appointmentTime &&
      normalizeStatus_(row[6]) !== "취소"
    ) return i + 2;
  }
  return 0;
}

function getBookedSlotKeys_(startKey, endKey, excludeDate, excludeTime) {
  const sheet = getReservationSheet_();
  if (sheet.getLastRow() < 2) return [];
  const excludeSlot = /^\d{4}-\d{2}-\d{2}$/.test(excludeDate) && /^\d{2}:\d{2}$/.test(excludeTime)
    ? excludeDate + " " + excludeTime
    : "";

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues()
    .filter(function (row) {
      const date = String(row[3] || "").trim();
      const time = String(row[4] || "").trim();
      const status = normalizeStatus_(row[6]);
      const slot = date + " " + time;
      return date >= startKey && date <= endKey && status !== "취소" && slot !== excludeSlot;
    })
    .map(function (row) {
      return String(row[3]).trim() + " " + String(row[4]).trim();
    });
}

function isTimeSlotTaken_(sheet, dateKey, time, excludeRow) {
  if (!sheet || sheet.getLastRow() < 2) return false;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    const sheetRow = i + 2;
    if (excludeRow && sheetRow === excludeRow) continue;
    const row = rows[i];
    if (
      String(row[3] || "").trim() === dateKey &&
      String(row[4] || "").trim() === time &&
      normalizeStatus_(row[6]) !== "취소"
    ) return true;
  }
  return false;
}

function appendRemark_(existing, nextText) {
  const base = String(existing || "").trim();
  if (!base) return nextText;
  if (base.split(" / ").indexOf(nextText) !== -1) return base;
  return base + " / " + nextText;
}

function normalizeStatus_(value) {
  const status = String(value || "").trim();
  return status === "취소" ? "취소" : "예약";
}

function readAndMigrateRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (v) { return String(v || "").trim(); });
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();
  const displayRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getDisplayValues();
  const hasMemoHeader = headers.indexOf("메모") !== -1;

  function idx(names) {
    for (let i = 0; i < names.length; i++) {
      const found = headers.indexOf(names[i]);
      if (found !== -1) return found;
    }
    return -1;
  }

  const chartIdx = idx(["차트번호"]);
  const nameIdx = idx(["환자명"]);
  const phoneIdx = idx(["휴대폰 뒷자리", "연락처 뒤 4자리"]);
  const dateIdx = idx(["예약날짜"]);
  const timeIdx = idx(["예약시간"]);
  const memoIdx = hasMemoHeader ? idx(["메모"]) : idx(["비고"]);
  const statusIdx = idx(["상태", "예약확정"]);
  const remarkIdx = hasMemoHeader ? idx(["비고"]) : -1;

  const migrated = [];
  rows.forEach(function (row, rowIndex) {
    const display = displayRows[rowIndex];
    const patientName = nameIdx >= 0 ? String(display[nameIdx] || "").trim() : "";
    const phoneLast4 = phoneIdx >= 0 ? normalizePhoneLast4_(display[phoneIdx]) : "";
    let appointmentDate = dateIdx >= 0 ? normalizeDateCell_(row[dateIdx], display[dateIdx]) : "";
    let appointmentTime = timeIdx >= 0 ? normalizeTimeCell_(row[timeIdx], display[timeIdx]) : "";

    if (appointmentDate.indexOf(" ") > 0 && !appointmentTime) {
      const parts = appointmentDate.split(/\s+/);
      appointmentDate = parts[0] || "";
      appointmentTime = parts[1] || "";
    }

    if (!patientName || !appointmentDate) return;
    const status = statusIdx >= 0 ? normalizeStatus_(display[statusIdx]) : "예약";
    let remark = remarkIdx >= 0 ? String(display[remarkIdx] || "").trim() : "";
    if (status === "취소" && remark.indexOf("취소") === -1) remark = appendRemark_(remark, "취소");

    migrated.push([
      chartIdx >= 0 ? String(display[chartIdx] || "").trim() : "",
      patientName,
      phoneLast4,
      appointmentDate,
      appointmentTime,
      memoIdx >= 0 ? String(display[memoIdx] || "").trim() : "",
      status,
      remark,
    ]);
  });

  return migrated;
}

function readLegacyRows_(legacySheet) {
  if (!legacySheet || legacySheet.getLastRow() < 2) return [];
  const rows = legacySheet.getRange(2, 1, legacySheet.getLastRow() - 1, Math.min(6, legacySheet.getLastColumn())).getDisplayValues();
  return rows.map(function (row) {
    const appointment = String(row[3] || "").trim();
    const matched = appointment.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
    const status = normalizeStatus_(row[4]);
    return ["", String(row[1] || "").trim(), normalizePhoneLast4_(row[2]), matched ? matched[1] : "", matched ? matched[2] : "", String(row[5] || "").trim(), status, status === "취소" ? "취소" : ""];
  }).filter(function (row) { return row[1] && row[3]; });
}

function normalizePhoneLast4_(value) {
  const digits = String(value == null ? "" : value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-4).padStart(4, "0");
}

function normalizeDateCell_(value, displayValue) {
  if (value instanceof Date) return Utilities.formatDate(value, TIME_ZONE, "yyyy-MM-dd");
  const text = String(displayValue || value || "").trim();
  const direct = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s+.*)?$/);
  if (!direct) return text;
  return direct[1] + "-" + String(direct[2]).padStart(2, "0") + "-" + String(direct[3]).padStart(2, "0") + (text.indexOf(" ") > 0 ? " " + text.split(/\s+/).slice(1).join(" ") : "");
}

function normalizeTimeCell_(value, displayValue) {
  if (value instanceof Date) return Utilities.formatDate(value, TIME_ZONE, "HH:mm");
  const text = String(displayValue || value || "").trim();
  const matched = text.match(/(\d{1,2}):(\d{2})/);
  return matched ? String(matched[1]).padStart(2, "0") + ":" + matched[2] : text;
}

function writeReservationSheet_(sheet, rows) {
  const filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.clear();
  sheet.getRange(1, 1, 1, 8).setValues([RESERVATION_HEADERS]);

  const cleaned = rows.filter(function (row) { return row[1] && row[3]; });
  cleaned.forEach(function (row) { row[2] = normalizePhoneLast4_(row[2]); });
  cleaned.sort(function (a, b) { return (a[3] + " " + a[4]).localeCompare(b[3] + " " + b[4]); });
  if (cleaned.length) {
    sheet.getRange(2, 1, cleaned.length, 5).setNumberFormat("@");
    sheet.getRange(2, 1, cleaned.length, 8).setValues(cleaned);
  }
  formatReservationSheet_(sheet);
}

function formatReservationSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 8).setBackground("#163f59").setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange("A:E").setNumberFormat("@");
  sheet.setColumnWidth(1, 105);
  sheet.setColumnWidth(2, 105);
  sheet.setColumnWidth(3, 125);
  sheet.setColumnWidth(4, 115);
  sheet.setColumnWidth(5, 95);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 90);
  sheet.setColumnWidth(8, 360);
  sheet.setRowHeight(1, 36);
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 8).setVerticalAlignment("middle");
    sheet.getRange("G2:G").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(["예약", "취소"], true).setAllowInvalid(false).build()
    );
  }
  if (sheet.getMaxRows() >= 2) sheet.getRange(1, 1, sheet.getMaxRows(), 8).createFilter();
}

function formatReservationDataRow_(sheet, row) {
  sheet.getRange(row, 1, 1, 8).setVerticalAlignment("middle");
  sheet.getRange(row, 1, 1, 5).setNumberFormat("@");
  sheet.setRowHeight(row, 32);
}

function setupClosedDateSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CLOSED_DATE_SHEET) || spreadsheet.insertSheet(CLOSED_DATE_SHEET);
  if (!String(sheet.getRange(1, 1).getDisplayValue() || "").trim()) {
    sheet.getRange(1, 1, 1, 2).setValues([["날짜", "사유"]]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange("A2:A").setNumberFormat("yyyy-mm-dd");
  sheet.getRange(1, 1, 1, 2).setBackground("#2c7b82").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 260);
}

function syncMonthlySheets_(spreadsheetOverride) {
  const spreadsheet = spreadsheetOverride || getSpreadsheet_();
  const master = spreadsheet.getSheetByName(RESERVATION_SHEET);
  if (!master) return;

  const groups = {};
  if (master.getLastRow() >= 2) {
    const rows = master.getRange(2, 1, master.getLastRow() - 1, 8).getDisplayValues();
    rows.forEach(function (row) {
      const date = String(row[3] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const sheetName = monthSheetName_(date);
      if (!groups[sheetName]) groups[sheetName] = [];
      groups[sheetName].push(row.slice(0, 8));
    });
  }

  const existingMonthly = {};
  spreadsheet.getSheets().forEach(function (sheet) {
    if (/^\d{4}-\d{2}$/.test(sheet.getName())) existingMonthly[sheet.getName()] = sheet;
  });

  Object.keys(existingMonthly).forEach(function (name) {
    writeMonthlySheet_(existingMonthly[name], groups[name] || []);
    delete groups[name];
  });

  Object.keys(groups).sort().forEach(function (name) {
    const sheet = spreadsheet.insertSheet(name);
    writeMonthlySheet_(sheet, groups[name]);
  });
}

function writeMonthlySheet_(sheet, rows) {
  const filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.clear();
  sheet.getRange(1, 1, 1, 8).setValues([RESERVATION_HEADERS]);
  const sorted = rows.slice().map(function (row) {
    const copy = row.slice();
    copy[2] = normalizePhoneLast4_(copy[2]);
    return copy;
  }).sort(function (a, b) { return (a[3] + " " + a[4]).localeCompare(b[3] + " " + b[4]); });
  if (sorted.length) {
    sheet.getRange(2, 1, sorted.length, 5).setNumberFormat("@");
    sheet.getRange(2, 1, sorted.length, 8).setValues(sorted);
  }
  formatReservationSheet_(sheet);
}

function monthSheetName_(dateKey) {
  const matched = String(dateKey || "").match(/^(\d{4})-(\d{2})-/);
  return matched ? matched[1] + "-" + matched[2] : "";
}

function rebuildMonthlySheets() {
  syncMonthlySheets_();
}

function onEdit(event) {
  try {
    if (!event || !event.range) return;
    const sheet = event.range.getSheet();
    const name = sheet.getName();
    if (name === RESERVATION_SHEET && event.range.getRow() > 1) {
      syncMonthlySheets_(event.source);
      bumpAvailabilityVersion_();
    } else if (name === CLOSED_DATE_SHEET && event.range.getRow() > 1) {
      bumpAvailabilityVersion_();
    }
  } catch (error) {
    console.log(error);
  }
}

function normalizeDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TIME_ZONE, "yyyy-MM-dd");
  }

  const text = String(value || "").trim();
  if (!text) return "";

  // 2026-08-28 / 2026.8.28 / 2026/8/28 / 2026년 8월 28일 모두 허용
  const matched = text.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (matched) {
    const y = matched[1];
    const m = String(Number(matched[2])).padStart(2, "0");
    const d = String(Number(matched[3])).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  return text;
}

function getManualClosedDates_(startKey, endKey) {
  const sheet = getSpreadsheet_().getSheetByName(CLOSED_DATE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(function (row) { return normalizeDateKey_(row[0]); })
    .filter(function (dateKey) {
      return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey >= startKey && dateKey <= endKey;
    });
}

function getClosedDateKeys_(startKey, endKey) {
  const closed = new Set(getHolidayDates_(startKey, endKey));
  getManualClosedDates_(startKey, endKey).forEach(function (dateKey) { closed.add(dateKey); });
  return Array.from(closed).sort();
}

function isClosedDate_(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return true;
  const date = new Date(dateKey + "T12:00:00+09:00");
  if (date.getDay() === 0 || date.getDay() === 6) return true;
  return getClosedDateKeys_(dateKey, dateKey).indexOf(dateKey) !== -1;
}

function getHolidayDates_(startKey, endKey) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "holiday:" + startKey + ":" + endKey;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const calendar = CalendarApp.getCalendarById(KOREAN_HOLIDAY_CALENDAR);
  if (!calendar) return [];
  const start = new Date(startKey + "T00:00:00+09:00");
  const end = new Date(endKey + "T23:59:59+09:00");
  const closed = new Set();
  calendar.getEvents(start, end).forEach(function (holiday) {
    closed.add(Utilities.formatDate(holiday.getStartTime(), TIME_ZONE, "yyyy-MM-dd"));
  });
  const result = Array.from(closed);
  cache.put(cacheKey, JSON.stringify(result), 21600);
  return result;
}

function getAvailabilityVersion_() {
  const properties = PropertiesService.getScriptProperties();
  return properties.getProperty("AVAILABILITY_VERSION") || "1";
}

function bumpAvailabilityVersion_() {
  const properties = PropertiesService.getScriptProperties();
  const current = Number(properties.getProperty("AVAILABILITY_VERSION") || "1");
  properties.setProperty("AVAILABILITY_VERSION", String(current + 1));
}

function getReservationSheet_() {
  const sheet = getSpreadsheet_().getSheetByName(RESERVATION_SHEET);
  if (!sheet) throw new Error("setupSheets 함수를 먼저 실행해 주세요.");
  return sheet;
}

function isAuthorized_(event) {
  const savedKey = PropertiesService.getScriptProperties().getProperty("WEBHOOK_KEY");
  return Boolean(savedKey && event.parameter && event.parameter.key === savedKey);
}

let SPREADSHEET_CACHE_ = null;
function getSpreadsheet_() {
  if (SPREADSHEET_CACHE_) return SPREADSHEET_CACHE_;
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("setupSheets 함수를 먼저 실행해 주세요.");
  SPREADSHEET_CACHE_ = SpreadsheetApp.openById(spreadsheetId);
  return SPREADSHEET_CACHE_;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
