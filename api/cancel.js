import { postToSheet, validName, validLast4, validDate, validTime, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "허용되지 않은 요청입니다." });

  const payload = req.body || {};
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = String(payload.phoneLast4 || "");
  const originalDate = String(payload.originalDate || "");
  const originalTime = String(payload.originalTime || "");

  if (!validName(patientName) || !validLast4(phoneLast4) || !validDate(originalDate) || !validTime(originalTime)) {
    return res.status(400).json({ error: "예약 정보를 다시 확인해 주세요." });
  }

  try {
    const { data } = await postToSheet({
      action: "cancel",
      patientName,
      phoneLast4,
      originalDate,
      originalTime,
    });

    if (data.error === "not_found") return res.status(404).json({ error: "취소할 예약을 확인하지 못했습니다." });
    if (data.ok !== true) throw new Error(data.error || "예약을 취소하지 못했습니다.");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "예약을 취소하지 못했습니다." });
  }
}
