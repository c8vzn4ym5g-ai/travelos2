import { captureFileMime, isCaptureVideoFile } from "./moments.ts";

const genericContentTypes = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export function isTripPhotoVideo(photo: { mimeType?: string | null; originalFilename?: string | null }) {
  return isCaptureVideoFile({
    name: photo.originalFilename ?? "",
    type: photo.mimeType ?? "",
  });
}

function headerType(value: string | null | undefined) {
  return (value ?? "").split(";")[0].trim();
}

export function tripMediaContentType(input: {
  driveContentType?: string | null;
  filename?: string | null;
  mimeType?: string | null;
}) {
  const drive = headerType(input.driveContentType);
  if (!genericContentTypes.has(drive.toLowerCase())) {
    return drive;
  }

  const mime = headerType(input.mimeType);
  if (!genericContentTypes.has(mime.toLowerCase())) {
    return mime;
  }

  const inferred = captureFileMime({ name: input.filename ?? "", type: "" });
  if (inferred) {
    return inferred;
  }

  return drive || mime || "application/octet-stream";
}
