import { getWebhook, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ error: "허용되지 않은 요청입니다." });

  try {
    const webhook = getWebhook();
    const { start, end, excludeDate, excludeTime } = req.query;
    const url = new URL(webhook);
    url.searchParams.set("action", "availability");
    url.searchParams.set("start", String(start || ""));
    url.searchParams.set("end", String(end || ""));
    if (excludeDate) url.searchParams.set("excludeDate", String(excludeDate));
    if (excludeTime) url.searchParams.set("excludeTime", String(excludeTime));

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || "예약 일정을 불러오지 못했습니다.");

    return res.status(200).json({
      closedDates: data.closedDates || [],
      bookedSlots: data.bookedSlots || [],
      schedule: data.schedule || {},
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "예약 일정을 불러오지 못했습니다." });
  }
}
