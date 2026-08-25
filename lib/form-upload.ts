export function isUploadBlob(value: FormDataEntryValue | null): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob && value.size > 0;
}

export function uploadFilename(file: Blob, fallback: string) {
  return file instanceof File && file.name.trim() ? file.name : fallback;
}
