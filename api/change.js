import { postToSheet, validName, validLast4, validDate, validTime, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "허용되지 않은 요청입니다." });

  const payload = req.body || {};
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = String(payload.phoneLast4 || "");
  const originalDate = String(payload.originalDate || "");
  const originalTime = String(payload.originalTime || "");
  const appointmentDate = String(payload.appointmentDate || "");
  const appointmentTime = String(payload.appointmentTime || "");

  if (
    !validName(patientName) || !validLast4(phoneLast4) ||
    !validDate(originalDate) || !validTime(originalTime) ||
    !validDate(appointmentDate) || !validTime(appointmentTime)
  ) {
    return res.status(400).json({ error: "예약 정보를 다시 확인해 주세요." });
  }

  try {
    const { data } = await postToSheet({
      action: "change",
      patientName,
      phoneLast4,
      originalDate,
      originalTime,
      appointmentDate,
      appointmentTime,
    });

    if (data.error === "closed_date") return res.status(409).json({ error: "휴진일에는 예약을 변경할 수 없습니다. 다른 날짜를 선택해 주세요." });
    if (data.error === "slot_taken") return res.status(409).json({ error: "해당 시간은 이미 예약되어 있습니다. 다른 시간을 선택해 주세요." });
    if (data.error === "invalid_slot") return res.status(400).json({ error: "해당 날짜에 운영하지 않는 예약 시간입니다." });
    if (data.error === "date_out_of_range") return res.status(400).json({ error: "변경 가능한 날짜 범위를 확인해 주세요." });
    if (data.error === "not_found") return res.status(404).json({ error: "변경할 예약을 확인하지 못했습니다." });
    if (data.ok !== true) throw new Error(data.error || "예약을 변경하지 못했습니다.");

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "예약을 변경하지 못했습니다." });
  }
}
