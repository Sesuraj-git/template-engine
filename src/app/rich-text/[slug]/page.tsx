"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { type JSONContent } from "@tiptap/react";
import RichTextEditor from "@/components/rich-text-editor/rich-text-editor";
import {
  getPageContent,
  updatePageContent,
  type PageContent,
} from "@/lib/services/rich-text";
import styles from "../rich-text.module.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ContentDocumentEditorPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [document, setDocument] = useState<PageContent | null>(null);
  const [title, setTitle] = useState("");
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
          setTitle(doc.title);
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
    async (overrides?: { title?: string }) => {
      if (!slug) return;
      setSaveStatus("saving");
      try {
        await updatePageContent(slug, {
          title: overrides?.title ?? title,
          content: pendingContent.current?.json,
          content_html: pendingContent.current?.html,
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

  function handleTitleBlur() {
    persist({ title });
  }

  if (isLoading) {
    return (
      <main className={styles.container}>
        <p className={styles.muted}>Loading document...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className={styles.container}>
        <div className={styles.errorBanner}>{loadError}</div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.headerRow}>
        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Untitled document"
        />
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
    </main>
  );
}
