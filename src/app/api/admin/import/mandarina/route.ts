import { createImportRouteHandler } from "@/lib/import/import-handler";

// Import also enumerates every colour of the model (extra page fetches +
// image uploads), so give the function room beyond the default timeout.
export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = createImportRouteHandler("mandarina");
