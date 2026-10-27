export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY missing"
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
      console.error("Gemini models error:", {
        status: response.status,
        message: data?.error?.message
      });

      return res.status(502).json({
        error: "Model lookup failed",
        upstreamStatus: response.status
      });
    }

    const models = (data.models || [])
      .filter(model =>
        (model.supportedGenerationMethods || [])
          .includes("generateContent")
      )
      .map(model => model.name);

    return res.status(200).json({
      models
    });

  } catch (error) {
    console.error("Model lookup failed:", error.message);

    return res.status(503).json({
      error: "Model lookup unavailable"
    });
  }
}
