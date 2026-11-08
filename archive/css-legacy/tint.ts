export type Tint = {
  hex: string;
  rgb: string;
  deep: string;
};

export const FALLBACK_TINT: Tint = {
  hex: "#8FA3B0",
  rgb: "143, 163, 176",
  deep: "#4F6674",
};

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r: number;
  let g: number;
  let b: number;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("avatar tint failed"));
    image.src = url;
  });
}

export async function avatarTint(url: string): Promise<Tint> {
  if (!url) return FALLBACK_TINT;
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return FALLBACK_TINT;
    context.drawImage(image, 0, 0, 32, 32);
    const { data } = context.getImageData(0, 0, 32, 32);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 180) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max > 245 && min > 238) continue;
      if (max < 18) continue;
      r += red;
      g += green;
      b += blue;
      count += 1;
    }
    if (!count) return FALLBACK_TINT;
    r /= count;
    g /= count;
    b /= count;
    const [hue, saturation, lightness] = rgbToHsl(r, g, b);
    const tint = hslToRgb(
      hue,
      Math.max(0.28, Math.min(0.6, saturation)),
      Math.max(0.5, Math.min(0.64, lightness)),
    );
    const deep = hslToRgb(
      hue,
      Math.max(0.32, Math.min(0.58, saturation)),
      0.32,
    );
    return {
      hex: toHex(tint[0], tint[1], tint[2]),
      rgb: tint.map((value) => Math.round(value)).join(", "),
      deep: toHex(deep[0], deep[1], deep[2]),
    };
  } catch {
    return FALLBACK_TINT;
  }
}
