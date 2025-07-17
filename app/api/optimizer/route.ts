/**
 * Proxy to Lyzr Studio with retry & back-off.
 * IMPORTANT: set LYZR_API_KEY in your Vercel project environment variables.
 */
import { NextResponse } from "next/server"
import { AbortSignal } from "abort-controller"

const LYZR_URL = "https://agent-prod.studio.lyzr.ai/v3/inference/chat/"

async function fetchWithRetry(
  body: unknown,
  retries = 5,
  baseDelay = 1_000, // 1 s
): Promise<Response> {
  const apiKey = process.env.LYZR_API_KEY
  if (!apiKey) {
    console.error("Server Error: LYZR_API_KEY is not set in environment variables.")
    return new Response(JSON.stringify({ error: "Server configuration error: Lyzr API key missing." }), { status: 500 })
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(LYZR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
        // Add timeout for fetch operations to prevent hanging requests
        signal: AbortSignal.timeout(10000), // 10 seconds timeout
      })

      if (res.status !== 429) {
        if (!res.ok) {
          const errorBody = await res.text() // Read text for logging
          console.error(`Lyzr API non-429 error (Status: ${res.status}, Attempt: ${attempt + 1}): ${errorBody}`)
          return new Response(
            JSON.stringify({
              error: `Lyzr API error: ${res.status}. Details: ${errorBody.substring(0, 100)}${errorBody.length > 100 ? "..." : ""}`,
            }),
            { status: res.status },
          )
        }
        return res // success or non-rate-limit error → return immediately
      }

      console.warn(`Lyzr API returned 429, attempt ${attempt + 1}/${retries + 1}. Retrying...`)

      if (attempt === retries) return res // last attempt → give up

      const retryAfter = Number(res.headers.get("Retry-After")) * 1_000 || baseDelay * 2 ** attempt
      const jitter = retryAfter * 0.25 * Math.random()
      await new Promise((r) => setTimeout(r, retryAfter + jitter))
    } catch (e: any) {
      console.error(`Fetch attempt ${attempt + 1} failed:`, e.message)
      if (attempt === retries || e.name === "AbortError") {
        // Give up on timeout or last retry
        return new Response(
          JSON.stringify({
            error: `Failed to connect to Lyzr API after multiple retries. Network error or timeout. Details: ${e.message}`,
          }),
          { status: 504 },
        ) // Gateway Timeout
      }
      const retryAfter = baseDelay * 2 ** attempt // Exponential backoff for network errors too
      await new Promise((r) => setTimeout(r, retryAfter))
    }
  }
  // Should theoretically not be reached due to previous return statements
  return new Response(null, { status: 500, statusText: "Internal Server Error after retries" })
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    const lyzrBody = {
      user_id: "mythili.ram2000@gmail.com",
      agent_id: "6874deeca4b8a4845fe2feb6",
      session_id: "6874deeca4b8a4845fe2feb6-ryziuszdtg",
      message,
    }

    const res = await fetchWithRetry(lyzrBody)

    // Ensure the response body is always read, even if it's an error
    const data = await res.json().catch((e) => {
      console.error("Failed to parse Lyzr API response JSON:", e)
      return { error: "Could not parse Lyzr API response." }
    })

    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error("Error in API route handler:", error)
    return NextResponse.json(
      { error: "Internal server error during request processing. " + error.message },
      { status: 500 },
    )
  }
}
