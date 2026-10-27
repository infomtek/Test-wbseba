export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "API key not configured"
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: {
          "x-goog-api-key": apiKey
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: "Unable to retrieve models",
        upstreamStatus: response.status
      });
    }

    const models = (data.models || [])
      .filter(model =>
        (model.supportedGenerationMethods || [])
          .includes("generateContent")
      )
      .map(model => model.name);

    return res.status(200).json({ models });

  } catch {
    return res.status(503).json({
      error: "Model lookup unavailable"
    });
  }
}
