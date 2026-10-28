const SIZE = 128;
const MAX_CHARS = 150_000; // the database caps a stored photo at 200,000 characters

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
    }
    // a photo that never answers must not hold up everyone else's
    const timer = window.setTimeout(() => reject(new Error("The image took too long.")), 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("The image could not be loaded."));
    };
    img.src = src;
  });
}

/**
 * Makes a small square thumbnail (a data URL) from an image address or data URL, so the photo is saved with the
 * person and never depends on someone else's link. Returns null if it cannot be made.
 */
export async function toThumbnail(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) return null;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; // transparent PNGs would turn black as JPEG
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    const out = canvas.toDataURL("image/jpeg", 0.82);
    return out.length <= MAX_CHARS ? out : null;
  } catch {
    // a photo that cannot be read (for example, blocked from another site) just means the initial is shown instead
    return null;
  }
}
