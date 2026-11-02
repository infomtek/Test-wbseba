const WEBRISK_THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE"
];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ code: "method_not_allowed" });
  }

  const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!rawUrl || rawUrl.length > 2048) {
    return res.status(400).json({ code: "invalid_url" });
  }

  let checkedUrl;
  try {
    checkedUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ code: "invalid_url" });
  }

  if (!['http:', 'https:'].includes(checkedUrl.protocol) || checkedUrl.username || checkedUrl.password) {
    return res.status(400).json({ code: "invalid_url" });
  }

  const apiKey = process.env.WEBRISK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ code: "lookup_unavailable" });
  }

  const endpoint = new URL("https://webrisk.googleapis.com/v1/uris:search");
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("uri", checkedUrl.href);
  WEBRISK_THREAT_TYPES.forEach(type => endpoint.searchParams.append("threatTypes", type));

  try {
    const upstream = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });

    if (!upstream.ok) {
      // Do not log the submitted URL, query string, or API key.
      console.error("Web Risk lookup failed", { status: upstream.status });
      return res.status(502).json({ code: "lookup_unavailable" });
    }

    const data = await upstream.json();
    const threatTypes = Array.isArray(data?.threat?.threatTypes)
      ? data.threat.threatTypes.filter(type => WEBRISK_THREAT_TYPES.includes(type))
      : [];

    return res.status(200).json({
      checked: true,
      threatDetected: threatTypes.length > 0,
      threatTypes
    });
  } catch {
    return res.status(503).json({ code: "lookup_unavailable" });
  }
}
