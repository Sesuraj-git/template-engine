import Link from "next/link";
import styles from "./rich-text.module.css";

const PAGES = [
  { title: "About Us", slug: "about-us" },
  { title: "Contact Us", slug: "contact-us" },
  { title: "Privacy Policy", slug: "privacy-policy" },
  { title: "Payment & Refund Policy", slug: "payment-refund-policy" },
  { title: "Terms & Conditions (Customer)", slug: "terms-conditions-customer" },
  { title: "Terms & Conditions (Vendor)", slug: "terms-conditions-vendor" },
  { title: "Content Policy", slug: "content-policy" },
];

export default function RichTextDashboardPage() {
  return (
    <main className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Rich Text Pages</h1>
      </div>

      <ul className={styles.list}>
        {PAGES.map((page) => (
          <li key={page.slug} className={styles.listItem}>
            <Link
              href={`/rich-text/${page.slug}`}
              className={styles.listItemButton}
              style={{ textDecoration: "none" }}
            >
              <span className={styles.docTitle}>📄 {page.title}</span>
              <span className={styles.docMeta}>Edit →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
