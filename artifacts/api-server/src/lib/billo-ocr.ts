import OpenAI from "openai";
import type { ReceiptDraft } from "@workspace/api-zod";
import { BillError, requireThat } from "./billo-domain";
import { receiptExtractionPrompt } from "./billo-ocr-prompt";
import { normalizeReceiptExtraction } from "./billo-ocr-normalize";

export async function extractReceipt(dataUrl: string, fallbackTitle?: string): Promise<ReceiptDraft> {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  requireThat(match, "Upload a JPEG, PNG or WebP image.");
  const bytes = Buffer.from(match[2]!, "base64");
  requireThat(bytes.length <= 8 * 1024 * 1024 && bytes.length > 20, "Use an image under 8 MB.");
  const valid = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216
    : match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  requireThat(valid, "The file is not a valid image of the selected type.");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) throw new BillError(503, "Receipt scanning is unavailable. Please enter the receipt manually.");
  const client = new OpenAI({ apiKey, baseURL, timeout: 60000, maxRetries: 1 });
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: receiptExtractionPrompt },
        { role: "user", content: [{ type: "text", text: "Read this receipt. Return the extraction for human review." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
      ],
    });
    return normalizeReceiptExtraction(JSON.parse(completion.choices[0]?.message.content ?? "{}"), fallbackTitle);
  } catch (error) {
    if (error instanceof BillError) throw error;
    throw new BillError(502, "Receipt scanning failed. Try a clearer image or enter the receipt manually.");
  }
}
