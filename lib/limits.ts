// Single source of truth for the per-file upload ceiling.
//
// Vercel serverless functions reject any request body over 4.5MB with a 413
// before our handler runs, so we stay comfortably under it. The client
// (app/page.tsx) uploads one file per request, so this cap applies per file
// and is never reached by the *sum* of a multi-file drop — which is why we can
// sit well above the old 1.25MB without risking a platform-level rejection.
export const MAX_FILE_SIZE_MB = 3.5;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
