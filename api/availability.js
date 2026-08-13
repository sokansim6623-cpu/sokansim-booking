export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "허용되지 않은 요청입니다."
    });
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    return response.status(500).json({
      error: "구글시트 연결 정보가 없습니다."
    });
  }

  const { start, end } = request.query;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start || "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end || "")
  ) {
    return response.status(400).json({
      error: "날짜 범위를 확인해 주세요."
    });
  }

  try {
    const googleUrl = new URL(webhookUrl);

    googleUrl.searchParams.set("action", "availability");
    googleUrl.searchParams.set("start", start);
    googleUrl.searchParams.set("end", end);

    const googleResponse = await fetch(googleUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    const result = await googleResponse.json();

    if (!googleResponse.ok || result.ok === false) {
      throw new Error("일정을 불러오지 못했습니다.");
    }

    response.setHeader("Cache-Control", "no-store");

    return response.status(200).json({
      closedDates: result.closedDates || [],
      specialOpenDates: result.specialOpenDates || [],
      bookedSlots: result.bookedSlots || []
    });
  } catch (error) {
    return response.status(500).json({
      error: "예약 일정을 불러오지 못했습니다."
    });
  }
}