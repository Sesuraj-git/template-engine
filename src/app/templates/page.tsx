"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listTemplates,
  type TemplateListItem,
  type Pagination,
} from "@/lib/services/print-templates";
import styles from "./templates.module.css";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const res = await listTemplates({ page, page_size: 20 });
        setTemplates(res.data);
        setPagination(res.pagination);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load templates";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [page]);

  function openEditor(templateId: string) {
    router.push(`/editor?template_id=${templateId}`);
  }

  function createNew() {
    router.push("/editor");
  }

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Print Templates</h1>
          <p className={styles.subtitle}>
            Manage invoice templates for KOT, bills, and receipts
          </p>
        </div>
        <button
          className={styles.createButton}
          onClick={createNew}
          type="button"
        >
          + New Template
        </button>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No templates found</p>
          <button
            className={styles.createButton}
            onClick={createNew}
            type="button"
          >
            Create your first template
          </button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {templates.map((t) => (
              <button
                className={styles.card}
                key={t.template_id}
                onClick={() => openEditor(t.template_id)}
                type="button"
              >
                <div className={styles.cardHeader}>
                  <span className={styles.invoiceBadge}>{t.invoice_type}</span>
                  <span className={styles.paperBadge}>{t.paper_size}</span>
                </div>
                <h2 className={styles.cardTitle}>{t.name}</h2>
                <div className={styles.cardMeta}>
                  <span>v{t.version_number}</span>
                  <span
                    className={t.is_published ? styles.published : styles.draft}
                  >
                    {t.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                <time className={styles.cardDate}>
                  {new Date(t.created_at).toLocaleDateString()}
                </time>
              </button>
            ))}
          </div>

          {pagination && pagination.total_pages > 1 && (
            <div className={styles.pagination}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <button
                disabled={page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
