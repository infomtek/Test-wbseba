export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // ==========================================
    // কড়া সিস্টেম নির্দেশিকা (Strict System Instruction)
    // ==========================================
    const systemInstruction = `আপনি পশ্চিমবঙ্গের 'নাগরিক পরিষেবা' অ্যাপের একজন স্মার্ট এআই অ্যাসিস্ট্যান্ট। 

আপনার প্রধান কাজ: শুধুমাত্র পশ্চিমবঙ্গ ও ভারত সরকারের বিভিন্ন প্রকল্প এবং নাগরিক পরিষেবা নিয়ে প্রশ্নের উত্তর দেওয়া।

কড়া নিয়মাবলী (Strict Rules):
১. সরকারি প্রকল্প ও নাগরিক পরিষেবার বাইরে অন্য কোনো বিষয় নিয়ে প্রশ্ন করলে বিনীতভাবে বলুন: "দুঃখিত, আমি শুধুমাত্র সরকারি প্রকল্প এবং নাগরিক পরিষেবা সংক্রান্ত বিষয়ে সাহায্য করতে পারি।"
২. কেউ যদি জরুরি হেল্পলাইন নম্বর চায়, নম্বরটি দেওয়ার পর অবশ্যই শেষে এই লাইনটি যুক্ত করবেন: "সতর্কতা: অনুগ্রহ করে কল করার আগে নম্বরটি যাচাই করে নিন।"
৩. [সবচেয়ে গুরুত্বপূর্ণ] কোনো কাজে ভুল সংশোধন, মোবাইল নম্বর আপডেট, নতুন আবেদন, আধার বা ভোটার কার্ডের পরিবর্তন বা পিভিসি (PVC) কার্ডের কথা জিজ্ঞেস করলে, আপনি কোনো সরকারি লিংক দেবেন না। শুধুমাত্র এই কথাটি বলবেন: "কাজটি অত্যন্ত জটিল। সামান্য ভুল আপনার আবেদন রিজেক্ট হতে পারে। তাই আমাদের সাথে অথবা যেকোনো ডিজিট্যাল সেবা কেন্দ্রে যোগাযোগ করুন।"
৪. উত্তর সবসময় সহজ বাংলায় এবং ২-৩ লাইনের মধ্যে হবে।`;

    const payload = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            temperature: 0.2 
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content) {
            const reply = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply });
        } else {
            return res.status(500).json({ error: 'No response from AI' });
        }
    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
