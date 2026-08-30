import * as ort from "onnxruntime-web/wasm";
import { isKanji, type KanjiCandidate } from "./models";

const MODEL_PATH = "models/dakanji/char_classifier.onnx";
const LABELS_PATH = "models/dakanji/char_classifier_labels.txt";
const INPUT_SIZE = 96;
const INK_THRESHOLD = 18;

let sessionPromise: Promise<ort.InferenceSession> | undefined;
let labelsPromise: Promise<string[]> | undefined;

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function loadSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    // A single WASM thread works on iOS/Safari without cross-origin isolation.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = {
      mjs: new URL(
        assetUrl("ort/ort-wasm-simd-threaded.js"),
        window.location.href,
      ).href,
      wasm: new URL(
        assetUrl("ort/ort-wasm-simd-threaded.wasm"),
        window.location.href,
      ).href,
    };
    sessionPromise = ort.InferenceSession.create(assetUrl(MODEL_PATH), {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch((cause) => {
      sessionPromise = undefined;
      throw new Error(
        "The handwriting recognition model could not load. Reload the app and try again.",
        {
          cause,
        },
      );
    });
  }
  return sessionPromise;
}

function loadLabels(): Promise<string[]> {
  if (!labelsPromise) {
    labelsPromise = fetch(assetUrl(LABELS_PATH))
      .then((response) => {
        if (!response.ok)
          throw new Error(
            `Could not load recognition labels (${response.status}).`,
          );
        return response.text();
      })
      .then((value) => [...value.trim()]);
  }
  return labelsPromise;
}

function borderAverage(
  grayscale: Uint8Array,
  width: number,
  height: number,
): number {
  let total = 0;
  let count = 0;
  const border = Math.max(1, Math.round(Math.min(width, height) * 0.04));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        x >= border &&
        x < width - border &&
        y >= border &&
        y < height - border
      )
        continue;
      total += grayscale[y * width + x];
      count += 1;
    }
  }
  return count > 0 ? total / count : 255;
}

async function imageTensor(image: Blob): Promise<ort.Tensor> {
  const bitmap = await createImageBitmap(image, {
    imageOrientation: "from-image",
  });
  const maximumEdge = 512;
  const scale = Math.min(
    maximumEdge / Math.max(bitmap.width, bitmap.height),
    1,
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Image processing is unavailable.");
  sourceContext.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const pixels = sourceContext.getImageData(0, 0, width, height);
  const grayscale = new Uint8Array(width * height);
  let imageAverage = 0;
  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    const alpha = pixels.data[offset + 3] / 255;
    const value =
      (0.299 * pixels.data[offset] +
        0.587 * pixels.data[offset + 1] +
        0.114 * pixels.data[offset + 2]) *
        alpha +
      255 * (1 - alpha);
    grayscale[index] = value;
    imageAverage += value;
  }
  imageAverage /= grayscale.length;

  const background = borderAverage(grayscale, width, height);
  const darkInk = background >= imageAverage;
  const normalized = sourceContext.createImageData(width, height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let peak = 1;

  for (let index = 0; index < grayscale.length; index += 1) {
    const contrast = darkInk
      ? Math.max(0, background - grayscale[index])
      : Math.max(0, grayscale[index] - background);
    peak = Math.max(peak, contrast);
    if (contrast >= INK_THRESHOLD) {
      const x = index % width;
      const y = Math.floor(index / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
    const offset = index * 4;
    normalized.data[offset] = contrast;
    normalized.data[offset + 1] = contrast;
    normalized.data[offset + 2] = contrast;
    normalized.data[offset + 3] = 255;
  }

  if (right < left || bottom < top || peak < INK_THRESHOLD) {
    throw new Error("No character was found. Try a tighter, clearer photo.");
  }

  // The model was trained on light glyphs over a dark background. Crop to the detected
  // character, preserve its aspect ratio, and leave breathing room around the strokes.
  const characterWidth = right - left + 1;
  const characterHeight = bottom - top + 1;
  const side = Math.max(characterWidth, characterHeight) * 1.22;
  const centerX = (left + right + 1) / 2;
  const centerY = (top + bottom + 1) / 2;
  const normalizedCanvas = document.createElement("canvas");
  normalizedCanvas.width = width;
  normalizedCanvas.height = height;
  normalizedCanvas.getContext("2d")?.putImageData(normalized, 0, 0);

  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = INPUT_SIZE;
  inputCanvas.height = INPUT_SIZE;
  const inputContext = inputCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!inputContext) throw new Error("Image processing is unavailable.");
  inputContext.fillStyle = "#000";
  inputContext.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  inputContext.drawImage(
    normalizedCanvas,
    centerX - side / 2,
    centerY - side / 2,
    side,
    side,
    0,
    0,
    INPUT_SIZE,
    INPUT_SIZE,
  );

  const inputPixels = inputContext.getImageData(
    0,
    0,
    INPUT_SIZE,
    INPUT_SIZE,
  ).data;
  const input = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  for (let index = 0; index < input.length; index += 1)
    input[index] = inputPixels[index * 4];
  return new ort.Tensor("float32", input, [1, 1, INPUT_SIZE, INPUT_SIZE]);
}

export async function recognizeKanjiLocally(
  image: Blob,
): Promise<KanjiCandidate[]> {
  const [session, labels, tensor] = await Promise.all([
    loadSession(),
    loadLabels(),
    imageTensor(image),
  ]);
  const output = await session.run({ image: tensor });
  const probabilities = output.probs?.data;
  if (!probabilities || probabilities.length !== labels.length) {
    throw new Error(
      "The local recognition model returned an unexpected result.",
    );
  }

  const candidates: KanjiCandidate[] = [];
  for (let index = 0; index < probabilities.length; index += 1) {
    const character = labels[index];
    if (!isKanji(character)) continue;
    const confidence = Number(probabilities[index]);
    if (candidates.length < 5) {
      candidates.push({ character, confidence });
      candidates.sort((left, right) => right.confidence - left.confidence);
    } else if (confidence > candidates[4].confidence) {
      candidates[4] = { character, confidence };
      candidates.sort((left, right) => right.confidence - left.confidence);
    }
  }
  return candidates;
}
