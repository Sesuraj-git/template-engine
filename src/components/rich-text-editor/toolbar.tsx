"use client";

import { type Editor } from "@tiptap/react";
import { useCallback, useRef } from "react";
import styles from "./rich-text-editor.module.css";

type ToolbarProps = {
  editor: Editor | null;
};

const COLORS = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];

export default function Toolbar({ editor }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !editor) return;

      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "");

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    editor
      ?.chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  if (!editor) return null;

  const Btn = ({
    onClick,
    active,
    disabled,
    label,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    label: string;
    title: string;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.toolButton} ${active ? styles.toolButtonActive : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <Btn
          title="Undo"
          label="↺"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        />
        <Btn
          title="Redo"
          label="↻"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        />
      </div>

      <div className={styles.toolGroup}>
        <select
          className={styles.select}
          title="Paragraph style"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
              ? "h3"
              : "p"
          }
          onChange={(e) => {
            const value = e.target.value;
            if (value === "p") {
              editor.chain().focus().setParagraph().run();
            } else {
              const level = Number(value.replace("h", "")) as 1 | 2 | 3;
              editor.chain().focus().toggleHeading({ level }).run();
            }
          }}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </div>

      <div className={styles.toolGroup}>
        <Btn
          title="Bold"
          label="B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Btn
          title="Italic"
          label="I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Btn
          title="Underline"
          label="U"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <Btn
          title="Strikethrough"
          label="S"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Btn
          title="Code"
          label="</>"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </div>

      <div className={styles.toolGroup}>
        <Btn
          title="Align left"
          label="⬅"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />
        <Btn
          title="Align center"
          label="⬌"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />
        <Btn
          title="Align right"
          label="➡"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />
        <Btn
          title="Justify"
          label="☰"
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        />
      </div>

      <div className={styles.toolGroup}>
        <Btn
          title="Bullet list"
          label="• ―"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Btn
          title="Numbered list"
          label="1. ―"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Btn
          title="Task list"
          label="☑"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
        <Btn
          title="Blockquote"
          label="❝"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <Btn
          title="Code block"
          label="{ }"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <Btn
          title="Horizontal rule"
          label="―"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      <div className={styles.toolGroup}>
        <Btn title="Link" label="🔗" active={editor.isActive("link")} onClick={setLink} />
        <Btn
          title="Insert image"
          label="🖼"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFileInput}
          onChange={handleImageUpload}
        />
        <Btn title="Insert table" label="▦" onClick={insertTable} />
      </div>

      <div className={styles.toolGroup}>
        <span className={styles.swatchLabel}>Text</span>
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            className={styles.swatch}
            style={{ backgroundColor: color }}
            onClick={() => editor.chain().focus().setColor(color).run()}
          />
        ))}
        <Btn
          title="Clear color"
          label="✕"
          onClick={() => editor.chain().focus().unsetColor().run()}
        />
      </div>

      <div className={styles.toolGroup}>
        <span className={styles.swatchLabel}>Highlight</span>
        {HIGHLIGHTS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            className={styles.swatch}
            style={{ backgroundColor: color }}
            onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
          />
        ))}
        <Btn
          title="Clear highlight"
          label="✕"
          onClick={() => editor.chain().focus().unsetHighlight().run()}
        />
      </div>
    </div>
  );
}
