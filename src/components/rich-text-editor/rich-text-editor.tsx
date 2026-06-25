"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import Toolbar from "./toolbar";
import styles from "./rich-text-editor.module.css";

export type RichTextEditorProps = {
  /** Initial Tiptap/ProseMirror JSON content. Pass null/undefined for a blank document. */
  initialContent?: JSONContent | null;
  /** Called on every content change with the latest JSON + rendered HTML. */
  onChange?: (payload: { json: JSONContent; html: string }) => void;
  /** Disables editing (e.g. while saving, or for a read-only preview). */
  readOnly?: boolean;
  placeholder?: string;
};

export default function RichTextEditor({
  initialContent,
  onChange,
  readOnly = false,
  placeholder = "Start typing...",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Link is added separately below with custom config
        link: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent ?? "",
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.({
        json: editor.getJSON(),
        html: editor.getHTML(),
      });
    },
  });

  // Keep editable state in sync if readOnly toggles after mount
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className={styles.wrapper}>
      {!readOnly && <Toolbar editor={editor} />}
      <div className={styles.contentArea}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
