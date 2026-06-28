"use client";

import { useRouter } from "next/navigation";
import styles from "./workspace.module.css";

type WorkspaceOption = {
  id: "templates" | "rich-text";
  title: string;
  description: string;
  href: string;
  icon: string;
};

const OPTIONS: WorkspaceOption[] = [
  {
    id: "templates",
    title: "Print Templates",
    description:
      "Design and manage coordinate-based print layouts for KOTs, Bills, and Receipts.",
    href: "/templates",
    icon: "🧾",
  },
  {
    id: "rich-text",
    title: "Rich Text Document",
    description:
      "Create and edit freeform rich text content using a full-featured text editor.",
    href: "/rich-text",
    icon: "📝",
  },
];

export default function WorkspacePage() {
  const router = useRouter();

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>What would you like to work on?</h1>
        <p className={styles.subtitle}>
          Choose a workspace to get started.
        </p>
      </div>

      <div className={styles.grid}>
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.card}
            onClick={() => router.push(option.href)}
          >
            <span className={styles.icon}>{option.icon}</span>
            <span className={styles.cardTitle}>{option.title}</span>
            <span className={styles.cardDescription}>{option.description}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
