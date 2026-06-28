"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { type JSONContent } from "@tiptap/react";
import RichTextEditor from "./rich-text-editor";
import {
  getPageContent,
  updatePageContent,
  type PageContent,
} from "@/lib/services/rich-text";
import styles from "@/app/rich-text/rich-text.module.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface RichTextEditorWrapperProps {
  slug: string;
  title: string;
}

export default function RichTextEditorWrapper({ slug, title }: RichTextEditorWrapperProps) {
  const [document, setDocument] = useState<PageContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const pendingContent = useRef<{ json: JSONContent; html: string } | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    (async () => {
      try {
        const doc = await getPageContent(slug);
        if (isMounted) {
          setDocument(doc);
        }
      } catch (err) {
        console.error("Failed to load page content:", err);
        if (isMounted) {
          setLoadError(
            "Could not load this document. Check that the backend is reachable and the slug exists."
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const persist = useCallback(
    async () => {
      if (!slug) return;
      setSaveStatus("saving");
      try {
        await updatePageContent(slug, {
          title,
          content: pendingContent.current?.json ?? {},
          content_html: pendingContent.current?.html ?? "",
        });
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save page content:", err);
        setSaveStatus("error");
      }
    },
    [slug, title]
  );

  // Debounced autosave whenever editor content changes
  const handleEditorChange = useCallback(
    (payload: { json: JSONContent; html: string }) => {
      pendingContent.current = payload;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        persist();
      }, 1200);
    },
    [persist]
  );

  // Title is now passed via props, no need to update on blur

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.muted}>Loading document...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBanner}>{loadError}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.saveStatus}>
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed — check API connection"}
        </span>
      </div>

      <p className={styles.muted} style={{ marginBottom: 16 }}>
        Slug: <code>{slug}</code> — the customer app will fetch this document
        using this slug.
      </p>

      <RichTextEditor
        initialContent={document?.content as JSONContent | undefined}
        onChange={handleEditorChange}
      />
    </div>
  );
}
