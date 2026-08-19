import { getFromSheet, noStore } from "./_common.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  try {
    const { data } = await getFromSheet({ action: "health" });
    if (data.ok !== true) throw new Error(data.error || "upstream_error");
    return res.status(200).json({ ok: true, version: data.version || "9.0" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
