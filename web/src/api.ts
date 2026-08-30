import { firstKanji, type KanjiCandidate } from "./models";
import { normalizeSvg } from "./svg";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "https://kanji-api.fahrezy.work";

interface KanjiResponse {
  kanji: string;
  stroke_orders: string[];
}

interface OcrResponse {
  candidates: KanjiCandidate[];
}

export type OcrProvider = "tesseract" | "google";

function decodeBase64Utf8(value: string): string {
  const bytes = Uint8Array.from(atob(value), (character) =>
    character.charCodeAt(0),
  );
  return normalizeSvg(new TextDecoder().decode(bytes));
}

export async function lookupKanji(
  character: string,
): Promise<{ character: string; strokeOrderSvgs: string[] }> {
  const normalized = [...character.trim()][0];
  if (!normalized || !firstKanji(normalized)) {
    throw new Error("Enter one kanji character.");
  }

  const response = await fetch(
    `${API_BASE_URL}/kanji/${encodeURIComponent(normalized)}?with_number=false`,
    { headers: { Accept: "application/json" } },
  );

  if (response.status === 404) throw new Error("That character was not found.");
  if (!response.ok)
    throw new Error(`Kanji lookup failed (${response.status}).`);

  const payload = (await response.json()) as KanjiResponse;
  return {
    character: payload.kanji,
    strokeOrderSvgs: payload.stroke_orders.map(decodeBase64Utf8),
  };
}

export async function recognizeKanji(
  image: Blob,
  provider?: OcrProvider,
): Promise<KanjiCandidate[]> {
  const imageBase64 = await blobToBase64(image);
  const response = await fetch(`${API_BASE_URL}/ocr/kanji`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      image: imageBase64,
      mime_type: image.type || "image/jpeg",
      ...(provider ? { provider } : {}),
    }),
  });

  if (response.status === 501) {
    throw new Error("Photo recognition is not configured on this server yet.");
  }
  if (!response.ok) {
    throw new Error(
      await responseError(
        response,
        `Photo recognition failed (${response.status}).`,
      ),
    );
  }

  const payload = (await response.json()) as OcrResponse;
  return payload.candidates.filter((candidate) =>
    firstKanji(candidate.character),
  );
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    return typeof payload.detail === "string" ? payload.detail : fallback;
  } catch {
    return fallback;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      resolve(value.slice(value.indexOf(",") + 1));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the selected image."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImageForOcr(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const maximumEdge = 1_280;
  const scale = Math.min(
    maximumEdge / Math.max(bitmap.width, bitmap.height),
    1,
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not prepare the image.")),
      "image/jpeg",
      0.84,
    );
  });
}
