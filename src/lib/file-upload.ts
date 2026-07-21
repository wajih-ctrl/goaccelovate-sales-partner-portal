export const STORAGE_BUCKETS = {
  leadAttachments: "lead-attachments",
  partnerDocuments: "partner-documents",
  discoveryCallFiles: "discovery-call-files",
  announcementAttachments: "announcement-attachments",
} as const;

type BucketId = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const MAX_FILE_SIZE: Record<BucketId, number> = {
  "lead-attachments": 50 * 1024 * 1024,
  "partner-documents": 50 * 1024 * 1024,
  "discovery-call-files": 100 * 1024 * 1024,
  "announcement-attachments": 2 * 1024 * 1024,
};

const ALLOWED_TYPES: Record<BucketId, Set<string>> = {
  "lead-attachments": new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  "partner-documents": new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  "discovery-call-files": new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "audio/mpeg",
    "video/mp4",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  "announcement-attachments": new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
};

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

export function validateUploadFile(file: File, bucket: BucketId) {
  if (file.size > MAX_FILE_SIZE[bucket]) {
    return `File is too large. Max size is ${Math.round(MAX_FILE_SIZE[bucket] / 1024 / 1024)}MB.`;
  }

  if (!ALLOWED_TYPES[bucket].has(file.type)) {
    return "Unsupported file type for this upload.";
  }

  return null;
}

export function validateAnnouncementFile(file: File, maxBytes: number) {
  const typeError = validateUploadFile(file, STORAGE_BUCKETS.announcementAttachments);
  if (typeError && !typeError.startsWith("File is too large")) return typeError;
  if (file.size > maxBytes) {
    const megabytes = Math.max(1, Math.round((maxBytes / 1024 / 1024) * 10) / 10);
    return `File is too large. The current announcement limit is ${megabytes}MB.`;
  }
  return null;
}

export function buildStoragePath(userId: string | undefined, scopeId: string, file: File) {
  const owner = userId || "unknown-user";
  return `${owner}/${scopeId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
}
