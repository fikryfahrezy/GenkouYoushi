export function normalizeSvg(value: string): string {
  const start = value.indexOf("<svg");
  const end = value.lastIndexOf("</svg>");
  if (start < 0 || end < start) {
    throw new Error("The stroke-order service returned an invalid SVG.");
  }

  // KanjiVG files include an XML declaration and an external SVG 1.0
  // DOCTYPE. WebKit can reject those inside an image data URL, so retain
  // only the self-contained SVG document.
  return value.slice(start, end + "</svg>".length);
}

export function svgDataUrl(value: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalizeSvg(value))}`;
}
