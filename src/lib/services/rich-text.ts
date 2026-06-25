import api from "./axios";

/**
 * API service for page content documents (e.g. "About Us", "Contact Us").
 *
 * ARCHITECTURE
 * ------------
 * All calls go through the existing authenticated `api` instance (./axios.ts),
 * the same one used by print-templates.ts and everything else in this app.
 *
 * `backend_url` (stored in localStorage after SSO handoff) resolves to
 * e.g. https://mistnove-auth.vercel.app/api, so Axios will call:
 *   GET  https://mistnove-auth.vercel.app/api/page-contents/
 *   GET  https://mistnove-auth.vercel.app/api/page-contents/about-us
 *   POST https://mistnove-auth.vercel.app/api/page-contents/
 *   etc.
 *
 * Documents are identified by a human-readable `slug` (e.g. "about-us")
 * rather than an opaque id, since non-devs will be creating named pages
 * and the customer app needs a stable, predictable key to fetch by.
 *
 * Routing convention (matches print-templates.ts):
 * - Root collection route ends WITH a trailing slash.
 * - Item-level routes do NOT end with a trailing slash.
 */

const API_BASE = "/page-contents/";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageContent = {
  id: string;
  /** Stable, URL-safe key, e.g. "about-us" */
  slug: string;
  title: string;
  /** Tiptap JSON document (ProseMirror schema) — canonical stored format */
  content: Record<string, unknown>;
  /** Rendered HTML snapshot — what the customer app renders */
  content_html: string;
  created_at?: string;
  updated_at?: string;
};

export type CreatePageContentPayload = {
  slug: string;
  title: string;
  content: Record<string, unknown>;
  content_html: string;
};

export type UpdatePageContentPayload = Partial<
  Omit<CreatePageContentPayload, "slug">
>;

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * List all page content documents.
 * GET /page-contents/  (trailing slash — root collection route)
 */
export async function listPageContents(): Promise<PageContent[]> {
  const res = await api.get(API_BASE);
  return res.data;
}

/**
 * Fetch a single page content document by slug.
 * GET /page-contents/:slug  (no trailing slash)
 */
export async function getPageContent(slug: string): Promise<PageContent> {
  const res = await api.get(`${API_BASE}${slug}`);
  return res.data;
}

/**
 * Create a new page content document.
 * POST /page-contents/  (trailing slash — root collection route)
 */
export async function createPageContent(
  payload: CreatePageContentPayload
): Promise<PageContent> {
  const res = await api.post(API_BASE, payload);
  return res.data;
}

/**
 * Update (save) an existing page content document.
 * PUT /page-contents/:slug  (no trailing slash)
 */
export async function updatePageContent(
  slug: string,
  payload: UpdatePageContentPayload
): Promise<PageContent> {
  const res = await api.put(`${API_BASE}${slug}`, payload);
  return res.data;
}

/**
 * Delete a page content document.
 * DELETE /page-contents/:slug  (no trailing slash)
 */
export async function deletePageContent(slug: string): Promise<void> {
  await api.delete(`${API_BASE}${slug}`);
}
