export function getWebhook() {
  const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhook) throw new Error("구글시트 연결 정보가 없습니다.");
  return webhook;
}

export async function postToSheet(payload) {
  const webhook = getWebhook();
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("구글시트 응답을 확인하지 못했습니다.");
  }
  return { response, data };
}

export function validName(value) {
  return /^[가-힣a-zA-Z\s]{2,20}$/.test(String(value || "").trim());
}
export function validLast4(value) {
  return /^\d{4}$/.test(String(value || ""));
}
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}
export function validTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}
export function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
}
