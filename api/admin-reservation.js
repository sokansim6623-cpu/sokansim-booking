import { postToSheet, validName, validLast4, validDate, validTime, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "허용되지 않은 요청입니다." });

  const payload = req.body || {};
  const chartNo = String(payload.chartNo || "").trim();
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = String(payload.phoneLast4 || "");
  const appointmentDate = String(payload.appointmentDate || "");
  const appointmentTime = String(payload.appointmentTime || "");
  const memo = String(payload.memo || "").trim().slice(0, 300);

  if (!chartNo) return res.status(400).json({ error: "차트번호를 입력해 주세요." });
  if (!validName(patientName)) return res.status(400).json({ error: "환자명을 정확히 입력해 주세요." });
  if (!validLast4(phoneLast4)) return res.status(400).json({ error: "휴대폰번호 뒷자리 4자리를 확인해 주세요." });
  if (!validDate(appointmentDate) || !validTime(appointmentTime)) return res.status(400).json({ error: "예약 날짜와 시간을 확인해 주세요." });

  try {
    const { data } = await postToSheet({
      action: "admin_create",
      chartNo,
      patientName,
      phoneLast4,
      appointmentDate,
      appointmentTime,
      memo,
    });

    if (data.error === "closed_date") return res.status(409).json({ error: "휴진일에는 예약할 수 없습니다. 다른 날짜를 선택해 주세요." });
    if (data.error === "slot_taken") return res.status(409).json({ error: "해당 시간은 이미 예약되어 있습니다. 다른 시간을 선택해 주세요." });
    if (data.error === "invalid_slot") return res.status(400).json({ error: "해당 날짜에 운영하지 않는 예약 시간입니다." });
    if (data.error === "date_out_of_range") return res.status(400).json({ error: "예약 가능한 날짜 범위를 확인해 주세요." });
    if (data.ok !== true) throw new Error(data.error || "예약을 저장하지 못했습니다.");

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "예약을 저장하지 못했습니다." });
  }
}
