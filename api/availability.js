export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "허용되지 않은 요청입니다." });
  }

  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const { start, end } = req.query;

  if (!webhook) {
    return res.status(500).json({ error: "구글시트 연결 정보가 없습니다." });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || "")) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(end || ""))) {
    return res.status(400).json({ error: "조회 날짜가 올바르지 않습니다." });
  }

  try {
    const url = new URL(webhook);
    url.searchParams.set("action", "availability");
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);

    const response = await fetch(url, {
      headers: { "Cache-Control": "no-cache" }
    });
    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "availability_failed");
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({
      closedDates: data.closedDates || [],
      bookedSlots: data.bookedSlots || []
    });
  } catch (error) {
    return res.status(500).json({
      error: "예약 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}
