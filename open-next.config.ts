import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Dummy/in-memory incremental cache on purpose: Capture already uses the Drive
// warehouse, and this path must not require R2, Vercel Blob, or a CF dashboard
// bucket before the first deploy.
export default defineCloudflareConfig({});
