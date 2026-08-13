export default async function handler(request, response) {
  if (request.method !== "POST") {
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

  const {
    patientName,
    birthDate,
    phoneLast4,
    appointmentDate,
    appointmentTime,
    privacyConsent
  } = request.body || {};

  if (!/^[가-힣a-zA-Z\s]{2,20}$/.test(String(patientName || "").trim())) {
    return response.status(400).json({
      error: "성함을 정확히 입력해 주세요."
    });
  }

  if (!/^\d{8}$/.test(String(birthDate || ""))) {
    return response.status(400).json({
      error: "생년월일 8자리를 확인해 주세요."
    });
  }

  if (!/^\d{4}$/.test(String(phoneLast4 || ""))) {
    return response.status(400).json({
      error: "휴대전화번호 뒤 4자리를 확인해 주세요."
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate || ""))) {
    return response.status(400).json({
      error: "예약 날짜를 확인해 주세요."
    });
  }

  if (!/^\d{2}:\d{2}$/.test(String(appointmentTime || ""))) {
    return response.status(400).json({
      error: "예약 시간대를 확인해 주세요."
    });
  }

  if (privacyConsent !== true) {
    return response.status(400).json({
      error: "개인정보 수집·이용에 동의해 주세요."
    });
  }

  try {
    const googleResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "reservation",
        patientName: String(patientName).trim(),
        birthDate: String(birthDate),
        phoneLast4: String(phoneLast4),
        appointmentDate: String(appointmentDate),
        appointmentTime: String(appointmentTime)
      })
    });

    const result = await googleResponse.json();

    if (result.error === "slot_taken") {
      return response.status(409).json({
        error: "해당 시간은 이미 예약되었습니다. 다른 시간대를 선택해 주세요."
      });
    }

    if (!googleResponse.ok || result.ok !== true) {
      throw new Error("구글시트 저장 실패");
    }

    return response.status(201).json({
      ok: true
    });
  } catch (error) {
    return response.status(500).json({
      error: "예약 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}