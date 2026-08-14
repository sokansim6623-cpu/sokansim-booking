const NAME_PATTERN = /^[가-힣a-zA-Z\s]{2,20}$/;
const BIRTH_PATTERN = /^\d{8}$/;
const PHONE_PATTERN = /^01[016789]-\d{3,4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "허용되지 않은 요청입니다." });
  }

  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhook) {
    return res.status(500).json({ error: "구글시트 연결 정보가 없습니다." });
  }

  const payload = req.body || {};
  const action = String(payload.action || "reservation");
  const patientName = String(payload.patientName || "").trim();
  const birthDate = String(payload.birthDate || "").replace(/\D/g, "");
  const phoneNumber = formatPhone(String(payload.phoneNumber || ""));

  if (!NAME_PATTERN.test(patientName)) {
    return res.status(400).json({ error: "성함을 정확히 입력해 주세요." });
  }
  if (!BIRTH_PATTERN.test(birthDate)) {
    return res.status(400).json({ error: "생년월일 8자리를 확인해 주세요." });
  }
  if (!PHONE_PATTERN.test(phoneNumber)) {
    return res.status(400).json({ error: "휴대전화번호를 확인해 주세요." });
  }
  if (action === "reservation" && payload.privacyConsent !== true) {
    return res.status(400).json({ error: "개인정보 수집·이용에 동의해 주세요." });
  }

  if (action === "reservation" || action === "change") {
    if (!DATE_PATTERN.test(String(payload.appointmentDate || "")) ||
        !TIME_PATTERN.test(String(payload.appointmentTime || ""))) {
      return res.status(400).json({ error: "예약 날짜와 시간을 확인해 주세요." });
    }
  }

  if ((action === "change" || action === "cancel") &&
      !String(payload.reservationId || "").trim()) {
    return res.status(400).json({ error: "예약 정보를 다시 확인해 주세요." });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        patientName,
        birthDate,
        phoneNumber,
        appointmentDate: String(payload.appointmentDate || ""),
        appointmentTime: String(payload.appointmentTime || ""),
        reservationId: String(payload.reservationId || "")
      })
    });

    const data = await response.json();

    if (data.error === "existing_reservation") {
      return res.status(409).json({
        code: "existing_reservation",
        error: "이미 신청된 예약이 있습니다.",
        reservation: data.reservation
      });
    }
    if (data.error === "slot_taken") {
      return res.status(409).json({
        code: "slot_taken",
        error: "해당 시간은 이미 예약되었습니다. 다른 시간대를 선택해 주세요."
      });
    }
    if (data.error === "closed_date") {
      return res.status(409).json({
        code: "closed_date",
        error: "회색 날짜는 예약할 수 없습니다."
      });
    }
    if (data.error === "reservation_not_found") {
      return res.status(404).json({
        code: "reservation_not_found",
        error: "예약 정보를 찾을 수 없습니다. 처음부터 다시 확인해 주세요."
      });
    }
    if (action === "lookup" && data.ok === true && data.reservation) {
      return res.status(200).json({ ok: true, reservation: data.reservation });
    }
    if (!response.ok || data.ok !== true) {
      throw new Error(data.error || "request_failed");
    }

    return res.status(action === "reservation" ? 201 : 200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  return value.trim();
}
