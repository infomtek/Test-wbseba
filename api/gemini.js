/* =====================================================
   NAGORIK PORISHEBA — GEMINI API 2.2
   Server-side Vercel Function
   ===================================================== */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  const query = String(req.body?.query || "").trim();

  if (!query) {
    return res.status(400).json({
      error: "Query is required"
    });
  }

  if (query.length > 500) {
    return res.status(400).json({
      error: "Query too long"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");

    return res.status(503).json({
      error: "Service temporarily unavailable"
    });
  }

  const model = "gemini-2.5-flash-lite";

  const apiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const systemInstruction = `
আপনি ভারতের পশ্চিমবঙ্গের "নাগরিক পরিষেবা" অ্যাপের তথ্যসহায়ক।

আপনার কাজ:
১. পশ্চিমবঙ্গ ও ভারত সরকারের সরকারি প্রকল্প, নাগরিক পরিষেবা, সরকারি নথিপত্র, আবেদন, সংশোধন এবং স্ট্যাটাস যাচাই সম্পর্কে সাহায্য করা।
২. হাসপাতাল, পুলিশ, অ্যাম্বুলেন্স, বনদপ্তর, সাইবার প্রতারণা এবং জরুরি নাগরিক সহায়তার বিষয়ে প্রাথমিক নিরাপত্তা নির্দেশ দেওয়া।
৩. ব্যবহারকারীর ভুল বানান, কথ্য বাংলা ও বাংলা-ইংরেজি মিশ্র প্রশ্নের অর্থ বোঝার চেষ্টা করা।

কঠোর নিয়ম:
১. বিষয়বহির্ভূত প্রশ্নে সংক্ষেপে বলুন যে নাগরিক পরিষেবায় শুধু সরকারি ও জরুরি নাগরিক পরিষেবা সম্পর্কে সাহায্য করা হয়।
২. কোনো সরকারি প্রকল্প, যোগ্যতা, আবেদনপদ্ধতি, ফোন নম্বর, ঠিকানা বা ওয়েবসাইটের লিংক অনুমান করে তৈরি করবেন না।
৩. নিশ্চিত সরকারি পোর্টাল জানা থাকলে সেটি জানান। নিশ্চিত না হলে সরকারি দপ্তর বা মূল সরকারি পোর্টাল থেকে যাচাই করতে বলুন।
৪. স্ট্যাটাস যাচাই সাধারণত সরকারি পোর্টালে নিজে করা যায়। এটি করার জন্য কোনো বেসরকারি সহায়তা বাধ্যতামূলক নয়।
৫. নতুন আবেদন বা সংশোধনের ক্ষেত্রেও আগে সরকারি পদ্ধতি জানান। প্রয়োজনে বেসরকারি ডিজিটাল সহায়তা ঐচ্ছিক হতে পারে এবং তার জন্য ফি থাকতে পারে।
৬. জরুরি পরিস্থিতিতে প্রথমে নিরাপত্তা ও চিকিৎসার নির্দেশ দিন। সাপ বা প্রাণীর কামড়ে চিকিৎসা বিলম্ব করতে বলবেন না।
৭. সাপ দেখা এবং সাপে কামড়ানোকে এক ঘটনা মনে করবেন না।
৮. বর্তমান তথ্য নিশ্চিত না হলে তা স্পষ্টভাবে জানান। নিজেকে লাইভ সরকারি ডেটাবেজের সঙ্গে যুক্ত বা সব তথ্য যাচাই করা হয়েছে বলে দাবি করবেন না।
৯. উত্তর সহজ, পরিষ্কার বাংলায়, সাধারণত ৪০–৮০ শব্দে দিন।
১০. ব্যবহারকারীর সামনে API, Gemini বা প্রযুক্তিগত সমস্যা নিয়ে আলোচনা করবেন না।
`;

  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },

    contents: [
      {
        role: "user",
        parts: [{ text: query }]
      }
    ],

    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini upstream error:", {
        status: response.status,
        message: data?.error?.message || "Unknown upstream error"
      });

      return res.status(502).json({
        error: "Answer service unavailable"
      });
    }

    const reply = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned no usable text", {
        finishReason: data?.candidates?.[0]?.finishReason || "unknown"
      });

      return res.status(502).json({
        error: "No usable answer"
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Gemini request failed:", error.message);

    return res.status(503).json({
      error: "Service temporarily unavailable"
    });
  }
}
