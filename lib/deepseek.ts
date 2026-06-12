import Anthropic from "@anthropic-ai/sdk"

let cached: Anthropic | null = null

function getDeepseekClient(): Anthropic {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY manquante — configurez-la dans .env.local ou les variables d'environnement Vercel.",
    )
  }
  if (!cached) {
    cached = new Anthropic({
      baseURL: "https://api.deepseek.com/anthropic",
      apiKey,
    })
  }
  return cached
}

/**
 * Client DeepSeek via SDK Anthropic (initialisation paresseuse).
 * DeepSeek expose une API compatible Anthropic — on garde le même SDK.
 *
 * Modèles :
 * - "deepseek-v4-pro"   → équivalent Claude Sonnet (~30x moins cher)
 * - "deepseek-v4-flash" → équivalent Claude Haiku (~100x moins cher)
 */
export const deepseek: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const client = getDeepseekClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})
