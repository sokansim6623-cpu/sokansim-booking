const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyJvOMmkGY690Q6bVRcr_uYgNE0bFRFAzQX0hhCpVUi3KLdIN7399y0_7S9M8J_PKnc/exec?key=6628cad0bbee430ca0ca62e13d6397e8";

const UPSTREAM_TIMEOUT_MS = 12000;

export function getWebhook() {
  // V9은 Vercel 환경변수 설정 오류로 예약/달력이 동시에 막히지 않도록
  // 현재 사용 중인 Apps Script 배포 URL을 서버 코드에서 직접 사용합니다.
  return GOOGLE_APPS_SCRIPT_URL;
}

async function fetchUpstream(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("구글시트 연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new Error("구글시트에 연결하지 못했습니다.");
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonResponse(response) {
  const text = (await response.text()).replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("구글시트에서 빈 응답이 반환되었습니다.");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("구글시트 응답 형식을 확인하지 못했습니다.");
  }
}

export async function getFromSheet(params = {}) {
  const url = new URL(getWebhook());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetchUpstream(url.toString(), { method: "GET" });
  const data = await readJsonResponse(response);
  return { response, data };
}

export async function postToSheet(payload) {
  const response = await fetchUpstream(getWebhook(), {
    method: "POST",
    // Apps Script 웹앱과의 POST 호환성을 위해 단순 텍스트로 JSON 본문을 전달합니다.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const data = await readJsonResponse(response);
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
