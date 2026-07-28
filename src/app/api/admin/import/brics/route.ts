import { createImportRouteHandler } from "@/lib/import/import-handler";

// Import also re-hosts a gallery per colour variant, so give the function room
// beyond the default timeout.
export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createImportRouteHandler("brics");
