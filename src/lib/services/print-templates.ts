"use client";
import api from "./axios";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TemplateDefinition {
  [key: string]: unknown;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  name: string;
  invoice_type: string;
  paper_size: string;
  definition: TemplateDefinition;
  is_latest: boolean;
  is_published: boolean;
  change_summary: string | null;
  created_by: string;
  created_at: string;
}

export interface TemplateListItem {
  template_id: string;
  name: string;
  invoice_type: string;
  paper_size: string;
  version_number: number;
  is_published: boolean;
  created_at: string;
}

export interface ResolvedTemplate {
  template_id: string;
  version_number: number;
  name: string;
  invoice_type: string;
  paper_size: string;
  definition: TemplateDefinition;
  is_published: boolean;
  source:
    | "outlet_override_pinned"
    | "outlet_override_latest"
    | "global"
    | "pg_fallback";
}

export interface TemplateAssignment {
  id: string;
  outlet_id: string;
  template_id: string;
  pinned_version_id: string | null;
  assigned_at: string;
}

export interface Pagination {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  msg: string;
  data: T;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}

// ─── Request Payloads ───────────────────────────────────────────────────────

export interface CreateTemplatePayload {
  name: string;
  invoice_type: string;
  paper_size: string;
  definition: TemplateDefinition;
  change_summary?: string;
}

export interface CreateVersionPayload {
  definition: TemplateDefinition;
  change_summary?: string;
}

export interface AssignTemplatePayload {
  outlet_id: string;
  template_id: string;
  pinned_version_id?: string;
}

export interface UnassignTemplatePayload {
  outlet_id: string;
  template_id: string;
}

export interface ListTemplatesParams {
  invoice_type?: string;
  paper_size?: string;
  page?: number;
  page_size?: number;
}

export interface VersionHistoryParams {
  page?: number;
  page_size?: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────

// NOTE: per the backend's registered swagger routes, the collection root
// (GET and POST on /print-templates) is registered WITH a trailing slash
// (/api/print-templates/) and 404s without it. Sub-routes (/resolve,
// /assign, /{templateId}/versions, /versions/{id}/publish) do NOT use a
// trailing slash. BASE intentionally has no trailing slash so it composes
// cleanly into both forms below.
const BASE = "/print-templates";

/** Create a new print template (version 1, unpublished). */
export async function createTemplate(payload: CreateTemplatePayload) {
  const res = await api.post<ApiResponse<TemplateVersion>>(`${BASE}/`, payload);
  return res.data;
}

/** Create a new version of an existing template. */
export async function createTemplateVersion(
  templateId: string,
  payload: CreateVersionPayload,
) {
  const res = await api.post<ApiResponse<TemplateVersion>>(
    `${BASE}/${templateId}/versions`,
    payload,
  );
  return res.data;
}

/** Publish a specific template version. */
export async function publishVersion(versionId: string) {
  const res = await api.put<ApiResponse<TemplateVersion>>(
    `${BASE}/versions/${versionId}/publish`,
  );
  return res.data;
}

/** Resolve the correct template for an outlet and invoice type. */
export async function resolveTemplate(outletId: string, invoiceType: string) {
  const res = await api.get<ApiResponse<ResolvedTemplate>>(`${BASE}/resolve`, {
    params: { outlet_id: outletId, invoice_type: invoiceType },
  });
  return res.data;
}

/** List all template groups (latest version metadata). */
export async function listTemplates(params?: ListTemplatesParams) {
  const res = await api.get<PaginatedResponse<TemplateListItem>>(`${BASE}/`, {
    params,
  });
  return res.data;
}

/** Get version history for a template group. */
export async function getVersionHistory(
  templateId: string,
  params?: VersionHistoryParams,
) {
  const res = await api.get<PaginatedResponse<TemplateVersion>>(
    `${BASE}/${templateId}/versions`,
    { params },
  );
  return res.data;
}

/** Assign a template to an outlet. */
export async function assignTemplate(payload: AssignTemplatePayload) {
  const res = await api.post<ApiResponse<TemplateAssignment>>(
    `${BASE}/assign`,
    payload,
  );
  return res.data;
}

/** Unassign a template from an outlet (reverts to global default). */
export async function unassignTemplate(payload: UnassignTemplatePayload) {
  const res = await api.delete<
    ApiResponse<{ outlet_id: string; template_id: string }>
  >(`${BASE}/assign`, { data: payload });
  return res.data;
}