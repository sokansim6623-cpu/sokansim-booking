import { getFromSheet, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ error: "허용되지 않은 요청입니다." });

  try {
    const { start, end, excludeDate, excludeTime } = req.query;
    const { data } = await getFromSheet({
      action: "availability",
      start: String(start || ""),
      end: String(end || ""),
      excludeDate: excludeDate ? String(excludeDate) : "",
      excludeTime: excludeTime ? String(excludeTime) : "",
    });

    if (data.ok === false) throw new Error(data.error || "예약 일정을 불러오지 못했습니다.");

    return res.status(200).json({
      ok: true,
      closedDates: data.closedDates || [],
      bookedSlots: data.bookedSlots || [],
      schedule: data.schedule || {},
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "예약 일정을 불러오지 못했습니다." });
  }
}
