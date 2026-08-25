"use client";

import { heicJpegFilename, isHeicPhoto } from "./moments.ts";

export const maxUploadBytes = 4_500_000;
export const displayMaxEdge = 1600;
export const displayJpegQuality = 0.72;

function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function decodePhoto(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await waitWithTimeout(
        createImageBitmap(file),
        8000,
        "Photo preparation timed out. Try a smaller JPG photo.",
      );
      return {
        cleanup: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width,
      };
    } catch {
      // Fall through to Image() so iPhone Safari can still decode HEIC.
    }
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await waitWithTimeout(image.decode(), 8000, "Photo preparation timed out. Try a smaller JPG photo.");
    return {
      cleanup: () => URL.revokeObjectURL(imageUrl),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(imageUrl);
    throw error;
  }
}

async function renderFileAsJpeg(file: File, maxSide: number, quality: number) {
  const decoded = await decodePhoto(file);

  try {
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not convert this photo to JPEG.");
    }

    context.drawImage(decoded.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) {
      throw new Error("Could not convert this photo to JPEG.");
    }

    return new File([blob], heicJpegFilename(file.name), { type: "image/jpeg" });
  } finally {
    decoded.cleanup();
  }
}

async function convertPhonePhotoToJpeg(file: File) {
  return renderFileAsJpeg(file, displayMaxEdge, displayJpegQuality);
}

export async function prepareDisplayPhoto(file: File) {
  try {
    let display = await convertPhonePhotoToJpeg(file);
    if (display.size > maxUploadBytes) {
      display = await renderFileAsJpeg(display, 1280, 0.65);
    }
    return display;
  } catch {
    // iPhone HEIC often cannot decode in Safari. Upload the original File instead
    // of blocking Capture; the server already accepts the raw photo.
    return file;
  }
}

export function shouldKeepOriginal(original: File, display: File) {
  return original !== display && (isHeicPhoto(original) || original.size !== display.size || original.name !== display.name);
}

export async function preparePhotoForUpload(file: File) {
  const original = file;
  const display = await prepareDisplayPhoto(file);
  return { display, original };
}
