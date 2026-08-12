// Vercel serverless function: POST /api/ask { question: "..." }
// Runs on Vercel's server, not in the browser - this is the only place your
// ANTHROPIC_API_KEY ever touches the network, so it stays out of the page's
// JavaScript (where anyone could otherwise view-source and steal it).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { question } = req.body || {};
  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "Missing question" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      answer:
        "I don't have a brain connected yet. The site owner needs to set ANTHROPIC_API_KEY in the Vercel project settings.",
    });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system:
          "You are JARVIS, a helpful voice assistant. Keep answers short and conversational (1-3 sentences) since they'll be read aloud.",
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      res.status(200).json({ answer: "I had trouble reaching my brain just now." });
      return;
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text ?? "I didn't get a clear answer back.";
    res.status(200).json({ answer });
  } catch (e) {
    console.error("Request to Anthropic failed:", e);
    res.status(200).json({ answer: "I had trouble reaching my brain just now." });
  }
}
