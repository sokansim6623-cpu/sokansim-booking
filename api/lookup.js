import { getFromSheet, validName, validLast4, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "허용되지 않은 요청입니다." });

  const payload = req.body || {};
  const patientName = String(payload.patientName || "").trim();
  const phoneLast4 = String(payload.phoneLast4 || "");

  if (!validName(patientName)) return res.status(400).json({ error: "성함을 정확히 입력해 주세요." });
  if (!validLast4(phoneLast4)) return res.status(400).json({ error: "휴대전화번호 뒤 4자리를 확인해 주세요." });

  try {
    // 조회는 Apps Script GET으로 연결해 POST 리다이렉트 지연/응답 오류를 피합니다.
    const { data } = await getFromSheet({ action: "lookup", patientName, phoneLast4 });
    if (data.error === "not_found") {
      return res.status(404).json({ error: "확인되는 예약이 없습니다. 지난 예약은 표시되지 않습니다." });
    }
    if (data.ok !== true || !Array.isArray(data.reservations)) {
      throw new Error(data.error || "예약을 확인하지 못했습니다.");
    }
    return res.status(200).json({ ok: true, reservations: data.reservations });
  } catch (error) {
    return res.status(500).json({ error: error.message || "예약을 확인하지 못했습니다." });
  }
}
