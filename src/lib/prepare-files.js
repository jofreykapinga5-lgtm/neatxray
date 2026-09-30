// Browser-only helpers: turn whatever the doctor picks (photo, HEIC, PDF, TIFF...)
// into compressed JPEGs small enough to upload and for the AI models to read.

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.88;
const MAX_PDF_PAGES = 8;

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", JPEG_QUALITY)
  );
}

async function drawableToJpeg(source, width, height) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

async function blobToJpeg(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    return await drawableToJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close?.();
  }
}

async function pdfToJpegs(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const out = [];
  for (let n = 1; n <= pages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, MAX_EDGE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push({
      blob: await canvasToBlob(canvas),
      name: `${file.name.replace(/\.pdf$/i, "")}-page-${n}.jpg`,
    });
  }
  return { images: out, truncated: pdf.numPages > pages, totalPages: pdf.numPages };
}

function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

// Returns { images: [{ blob, name }], notes: string[] } - everything as JPEG.
export async function prepareFiles(files) {
  const images = [];
  const notes = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();
    try {
      if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
        const result = await pdfToJpegs(file);
        images.push(...result.images);
        if (result.truncated) {
          notes.push(`${file.name}: only the first ${result.images.length} of ${result.totalPages} pages were used.`);
        }
      } else if (lower.endsWith(".dcm") || file.type === "application/dicom") {
        notes.push(`${file.name}: DICOM files are not supported yet. Export the image as JPG or PNG.`);
      } else if (isHeic(file)) {
        const { default: heic2any } = await import("heic2any");
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        images.push({ blob: await blobToJpeg(blob), name: file.name.replace(/\.[^.]+$/, "") + ".jpg" });
      } else if (/\.tiff?$/i.test(lower) || file.type === "image/tiff") {
        notes.push(`${file.name}: TIFF is not supported by this browser. Export it as JPG or PNG.`);
      } else if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(lower)) {
        images.push({ blob: await blobToJpeg(file), name: file.name.replace(/\.[^.]+$/, "") + ".jpg" });
      } else {
        notes.push(`${file.name}: unsupported file type.`);
      }
    } catch (err) {
      console.error(err);
      notes.push(`${file.name}: could not be read.`);
    }
  }
  return { images, notes };
}
