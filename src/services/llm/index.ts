import { getDB } from "@/services/db";
import type { Settings } from "@/types/settings";
import type { LLMProvider, ChatMessage, LLMOptions } from "./types";
import { APIProvider } from "./api-provider";
import { LocalProvider } from "./local-provider";

export type { ChatMessage, LLMOptions, LLMProvider };

let cachedProvider: LLMProvider | null = null;
let cachedMode: string | null = null;

async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const rows = await db.select<Settings[]>(
    "SELECT * FROM settings WHERE id = 1"
  );
  return rows[0];
}

export async function getLLMProvider(): Promise<LLMProvider> {
  const settings = await getSettings();
  const mode = settings.llm_mode;

  if (cachedProvider && cachedMode === mode) {
    return cachedProvider;
  }

  if (mode === "local") {
    cachedProvider = new LocalProvider();
  } else {
    cachedProvider = new APIProvider(
      settings.llm_api_url,
      settings.llm_api_key,
      settings.llm_model
    );
  }
  cachedMode = mode;
  return cachedProvider;
}

export function resetProvider() {
  cachedProvider = null;
  cachedMode = null;
}

export async function chatWithLLM(
  messages: ChatMessage[],
  options?: LLMOptions
): Promise<string> {
  const provider = await getLLMProvider();
  return provider.chat(messages, options);
}
