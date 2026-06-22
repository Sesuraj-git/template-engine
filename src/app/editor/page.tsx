"use client";

import {
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createTemplate as apiCreateTemplate,
  createTemplateVersion,
  publishVersion,
  getVersionHistory,
} from "@/lib/services/print-templates";
import styles from "../page.module.css";

type InvoiceType = "kot" | "orderBill" | "paymentReceipt";
type ElementType = "text" | "variable" | "table" | "line" | "image";
type PaperKey = "thermal58" | "thermal80" | "a5" | "a4";

type TemplateElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  variableKey?: string;
  fontSize: number;
  fontWeight?: "400" | "500" | "600" | "700";
  align?: "left" | "center" | "right";
};

type TemplateDefinition = {
  id: string;
  name: string;
  invoiceType: InvoiceType;
  paper: PaperKey;
  width: number;
  height: number;
  elements: TemplateElement[];
};

type DragState =
  | {
      mode: "move";
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      mode: "resize";
      id: string;
      startX: number;
      startY: number;
      originWidth: number;
      originHeight: number;
    };

const paperSizes: Record<
  PaperKey,
  { label: string; width: number; height: number }
> = {
  thermal58: { label: "Thermal 58mm", width: 236, height: 760 },
  thermal80: { label: "Thermal 80mm", width: 326, height: 860 },
  a5: { label: "A5", width: 560, height: 794 },
  a4: { label: "A4", width: 794, height: 1123 },
};

const sampleData = {
  kot: {
    kot_number: "KOT-1042",
    order_id: "ORD-78214",
    table_number: "T-12",
    order_type: "dine-in",
    payment_status: "unpaid",
    order_time: "13 May 2026, 04:45 AM",
    outlet_name: "Mistnove Bistro",
    outlet_image_icon: "https://dummyimage.com/96x96/101828/ffffff.png&text=MB",
    order_items: [
      {
        product_name: "Paneer Tikka",
        variant_name: "Regular",
        quantity: 2,
        notes: "Less spicy",
      },
      {
        product_name: "Masala Dosa",
        variant_name: "Ghee roast",
        quantity: 1,
        notes: "Extra chutney",
      },
    ],
  },
  orderBill: {
    bill_number: "BILL-5521",
    order_id: "ORD-78214",
    table_number: "T-12",
    order_type: "dine-in",
    subtotal: "780.00",
    tax: "39.00",
    discount: "40.00",
    grand_total: "779.00",
    payment_status: "paid",
    outlet_name: "Mistnove Bistro",
    order_items: [
      {
        product_name: "Paneer Tikka",
        variant_name: "Regular",
        quantity: 2,
        price: "520.00",
      },
      {
        product_name: "Masala Dosa",
        variant_name: "Ghee roast",
        quantity: 1,
        price: "260.00",
      },
    ],
  },
  paymentReceipt: {
    receipt_number: "RCPT-3328",
    order_id: "ORD-78214",
    payment_method: "UPI",
    transaction_id: "TXN-9088172",
    paid_amount: "779.00",
    paid_at: "13 May 2026, 04:50 AM",
    outlet_name: "Mistnove Bistro",
    cashier_name: "A. Sharma",
  },
};

const variableLabels: Record<InvoiceType, { key: string; label: string }[]> = {
  kot: [
    { key: "kot_number", label: "KOT number" },
    { key: "order_id", label: "Order ID" },
    { key: "table_number", label: "Table number" },
    { key: "order_type", label: "Order type" },
    { key: "payment_status", label: "Payment status" },
    { key: "order_time", label: "Order time" },
    { key: "outlet_name", label: "Outlet name" },
    { key: "outlet_image_icon", label: "Outlet icon URL" },
    { key: "order_items", label: "Order items" },
  ],
  orderBill: [
    { key: "bill_number", label: "Bill number" },
    { key: "order_id", label: "Order ID" },
    { key: "table_number", label: "Table number" },
    { key: "order_type", label: "Order type" },
    { key: "subtotal", label: "Subtotal" },
    { key: "tax", label: "Tax" },
    { key: "discount", label: "Discount" },
    { key: "grand_total", label: "Grand total" },
    { key: "payment_status", label: "Payment status" },
    { key: "outlet_name", label: "Outlet name" },
    { key: "order_items", label: "Order items" },
  ],
  paymentReceipt: [
    { key: "receipt_number", label: "Receipt number" },
    { key: "order_id", label: "Order ID" },
    { key: "payment_method", label: "Payment method" },
    { key: "transaction_id", label: "Transaction ID" },
    { key: "paid_amount", label: "Paid amount" },
    { key: "paid_at", label: "Paid at" },
    { key: "outlet_name", label: "Outlet name" },
    { key: "cashier_name", label: "Cashier name" },
  ],
};

const invoiceOptions: { key: InvoiceType; label: string }[] = [
  { key: "kot", label: "KOT" },
  { key: "orderBill", label: "Order bill" },
  { key: "paymentReceipt", label: "Payment receipt" },
];

const newId = () => crypto.randomUUID();

// Maps API invoice_type to local InvoiceType
function mapInvoiceType(apiType: string): InvoiceType {
  const map: Record<string, InvoiceType> = {
    kot: "kot",
    bill: "orderBill",
    receipt: "paymentReceipt",
  };
  return map[apiType] || "kot";
}

// Maps local InvoiceType to API invoice_type
function toApiInvoiceType(local: InvoiceType): string {
  const map: Record<InvoiceType, string> = {
    kot: "kot",
    orderBill: "bill",
    paymentReceipt: "receipt",
  };
  return map[local];
}

// Maps local PaperKey to API paper_size
function toApiPaperSize(local: PaperKey): string {
  const map: Record<PaperKey, string> = {
    thermal58: "thermal58",
    thermal80: "thermal80",
    a5: "a5",
    a4: "a4",
  };
  return map[local];
}

// Maps API paper_size to local PaperKey
function mapPaperSize(apiSize: string): PaperKey {
  const map: Record<string, PaperKey> = {
    thermal58: "thermal58",
    thermal80: "thermal80",
    a5: "a5",
    a4: "a4",
  };
  return map[apiSize] || "thermal80";
}

function buildDefaultTemplate(
  invoiceType: InvoiceType,
  paper: PaperKey,
): TemplateDefinition {
  const size = paperSizes[paper];

  if (invoiceType === "paymentReceipt") {
    return {
      id: newId(),
      name: "Payment receipt",
      invoiceType,
      paper,
      width: size.width,
      height: size.height,
      elements: [
        heading("Payment Receipt", 24, 26, size.width - 48),
        variableEl(
          "receipt_number",
          24,
          88,
          size.width - 48,
          "center",
          16,
          "600",
        ),
        textEl("Order", 24, 142, 110, 28, 13, "600"),
        variableEl("order_id", 148, 142, size.width - 172, "right", 13),
        textEl("Method", 24, 180, 110, 28, 13, "600"),
        variableEl("payment_method", 148, 180, size.width - 172, "right", 13),
        textEl("Amount paid", 24, 230, 130, 32, 16, "700"),
        variableEl(
          "paid_amount",
          162,
          230,
          size.width - 186,
          "right",
          18,
          "700",
        ),
        lineEl(24, 294, size.width - 48),
        variableEl("paid_at", 24, 320, size.width - 48, "center", 12),
        variableEl(
          "outlet_name",
          24,
          360,
          size.width - 48,
          "center",
          14,
          "600",
        ),
      ],
    };
  }

  return {
    id: newId(),
    name: invoiceType === "kot" ? "Kitchen order ticket" : "Order bill",
    invoiceType,
    paper,
    width: size.width,
    height: size.height,
    elements: [
      heading(
        invoiceType === "kot" ? "Kitchen Order Ticket" : "Order Bill",
        20,
        22,
        size.width - 40,
      ),
      variableEl(
        invoiceType === "kot" ? "kot_number" : "bill_number",
        20,
        76,
        size.width - 40,
        "center",
        16,
        "700",
      ),
      textEl("Order", 22, 126, 76, 24, 12, "600"),
      variableEl("order_id", 112, 126, size.width - 134, "right", 12),
      textEl("Table", 22, 158, 76, 24, 12, "600"),
      variableEl("table_number", 112, 158, size.width - 134, "right", 12),
      textEl("Type", 22, 190, 76, 24, 12, "600"),
      variableEl("order_type", 112, 190, size.width - 134, "right", 12),
      lineEl(20, 234, size.width - 40),
      tableEl(20, 258, size.width - 40),
      lineEl(20, 430, size.width - 40),
      variableEl(
        "payment_status",
        20,
        462,
        size.width - 40,
        "center",
        13,
        "600",
      ),
      variableEl("order_time", 20, 500, size.width - 40, "center", 12),
      variableEl("outlet_name", 20, 542, size.width - 40, "center", 13, "700"),
    ],
  };
}

function textEl(
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize = 14,
  fontWeight: TemplateElement["fontWeight"] = "400",
): TemplateElement {
  return {
    id: newId(),
    type: "text",
    x,
    y,
    width,
    height,
    content,
    fontSize,
    fontWeight,
    align: "left",
  };
}

function heading(
  content: string,
  x: number,
  y: number,
  width: number,
): TemplateElement {
  return {
    id: newId(),
    type: "text",
    x,
    y,
    width,
    height: 38,
    content,
    fontSize: 18,
    fontWeight: "700",
    align: "center",
  };
}

function variableEl(
  key: string,
  x: number,
  y: number,
  width: number,
  align: TemplateElement["align"] = "left",
  fontSize = 13,
  fontWeight: TemplateElement["fontWeight"] = "500",
): TemplateElement {
  return {
    id: newId(),
    type: key === "outlet_image_icon" ? "image" : "variable",
    variableKey: key,
    x,
    y,
    width,
    height: 30,
    fontSize,
    fontWeight,
    align,
  };
}

function tableEl(x: number, y: number, width: number): TemplateElement {
  return {
    id: newId(),
    type: "table",
    variableKey: "order_items",
    x,
    y,
    width,
    height: 150,
    fontSize: 11,
    fontWeight: "400",
    align: "left",
  };
}

function lineEl(x: number, y: number, width: number): TemplateElement {
  return { id: newId(), type: "line", x, y, width, height: 1, fontSize: 1 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}
        >
          Loading editor…
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template_id");

  const [invoiceType, setInvoiceType] = useState<InvoiceType>("kot");
  const [paper, setPaper] = useState<PaperKey>("thermal80");
  const [template, setTemplate] = useState<TemplateDefinition>(() =>
    buildDefaultTemplate("kot", "thermal80"),
  );
  const [templateName, setTemplateName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"design" | "preview" | "json">("design");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [notice, setNotice] = useState("Ready");
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(!!templateId);
  // Tracks the version row id (for publishing) and whether this is an existing template
  const [versionId, setVersionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = template.elements.find((el) => el.id === selectedId) ?? null;
  const data = sampleData[template.invoiceType];
  const jsonPreview = useMemo(
    () => JSON.stringify(template, null, 2),
    [template],
  );

  // Load existing template from API
  useEffect(() => {
    if (!templateId) return;
    async function loadTemplate() {
      setLoadingTemplate(true);
      try {
        const res = await getVersionHistory(templateId!, {
          page: 1,
          page_size: 1,
        });
        if (res.data.length > 0) {
          const latest = res.data[0];
          const localInvoice = mapInvoiceType(latest.invoice_type);
          const localPaper = mapPaperSize(latest.paper_size);
          const size = paperSizes[localPaper];

          setInvoiceType(localInvoice);
          setPaper(localPaper);
          setTemplateName(latest.name);
          setVersionId(latest.id);

          // If the definition has our editor structure, use it directly
          const def = latest.definition as unknown as TemplateDefinition | null;
          if (def && def.elements && Array.isArray(def.elements)) {
            setTemplate({
              ...def,
              invoiceType: localInvoice,
              paper: localPaper,
              width: size.width,
              height: size.height,
            });
          } else {
            // Definition is raw/foreign — load default layout
            setTemplate(buildDefaultTemplate(localInvoice, localPaper));
          }
          setNotice(`Loaded "${latest.name}" v${latest.version_number}`);
        }
      } catch {
        setNotice("Failed to load template — starting fresh");
      } finally {
        setLoadingTemplate(false);
      }
    }
    loadTemplate();
  }, [templateId]);

  function switchInvoiceType(nextType: InvoiceType) {
    const nextTemplate = buildDefaultTemplate(nextType, template.paper);
    setInvoiceType(nextType);
    setTemplate(nextTemplate);
    setSelectedId(nextTemplate.elements[0]?.id ?? null);
    setMode("design");
    setNotice(`${nextTemplate.name} preset loaded`);
  }

  function switchPaper(nextPaper: PaperKey) {
    const size = paperSizes[nextPaper];
    setPaper(nextPaper);
    setTemplate((current) => {
      const scaleX = size.width / current.width;
      const scaleY = size.height / current.height;
      return {
        ...current,
        paper: nextPaper,
        width: size.width,
        height: size.height,
        elements: current.elements.map((el) => ({
          ...el,
          x: Math.round(el.x * scaleX),
          y: Math.round(el.y * scaleY),
          width: Math.max(18, Math.round(el.width * scaleX)),
          height: Math.max(1, Math.round(el.height * scaleY)),
        })),
      };
    });
    setNotice(`${size.label} selected`);
  }

  function startMove(
    event: PointerEvent<HTMLDivElement>,
    element: TemplateElement,
  ) {
    if (mode !== "design") return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(element.id);
    setDragState({
      mode: "move",
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
    });
  }

  function startResize(
    event: PointerEvent<HTMLButtonElement>,
    element: TemplateElement,
  ) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(element.id);
    setDragState({
      mode: "resize",
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: element.width,
      originHeight: element.height,
    });
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    setTemplate((current) => ({
      ...current,
      elements: current.elements.map((el) => {
        if (el.id !== dragState.id) return el;
        if (dragState.mode === "move") {
          const nextX = dragState.originX + event.clientX - dragState.startX;
          const nextY = dragState.originY + event.clientY - dragState.startY;
          return {
            ...el,
            x: clamp(Math.round(nextX), 0, current.width - el.width),
            y: clamp(Math.round(nextY), 0, current.height - el.height),
          };
        }
        return {
          ...el,
          width: clamp(
            Math.round(
              dragState.originWidth + event.clientX - dragState.startX,
            ),
            24,
            current.width - el.x,
          ),
          height: clamp(
            Math.round(
              dragState.originHeight + event.clientY - dragState.startY,
            ),
            el.type === "line" ? 1 : 20,
            current.height - el.y,
          ),
        };
      }),
    }));
  }

  function dropVariable(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (mode !== "design") return;
    const variableKey = event.dataTransfer.getData("variable-key");
    if (!variableKey || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const x = clamp(
      Math.round(event.clientX - bounds.left),
      0,
      template.width - 120,
    );
    const y = clamp(
      Math.round(event.clientY - bounds.top),
      0,
      template.height - 32,
    );
    const nextElement =
      variableKey === "order_items"
        ? tableEl(x, y, Math.min(300, template.width - x))
        : variableEl(variableKey, x, y, Math.min(220, template.width - x));
    setTemplate((current) => ({
      ...current,
      elements: [...current.elements, nextElement],
    }));
    setSelectedId(nextElement.id);
    setNotice(`${variableKey} added`);
  }

  function addText() {
    const el = textEl(
      "New text",
      28,
      28,
      Math.min(180, template.width - 56),
      30,
      13,
      "500",
    );
    setTemplate((current) => ({
      ...current,
      elements: [...current.elements, el],
    }));
    setSelectedId(el.id);
  }

  function addLine() {
    const el = lineEl(28, 70, template.width - 56);
    setTemplate((current) => ({
      ...current,
      elements: [...current.elements, el],
    }));
    setSelectedId(el.id);
  }

  function updateSelected(patch: Partial<TemplateElement>) {
    if (!selectedId) return;
    setTemplate((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === selectedId ? { ...el, ...patch } : el,
      ),
    }));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setTemplate((current) => ({
      ...current,
      elements: current.elements.filter((el) => el.id !== selectedId),
    }));
    setSelectedId(null);
  }

  async function saveTemplate() {
    setSaving(true);
    setNotice("Saving…");
    try {
      const definition = template as unknown as Record<string, unknown>;
      if (templateId) {
        // Existing template — create a new version
        const res = await createTemplateVersion(templateId, {
          definition,
          change_summary: "Updated from editor",
        });
        setVersionId(res.data.id);
        setNotice(`Saved as v${res.data.version_number}`);
      } else {
        // New template
        const name = templateName || template.name || "Untitled template";
        const res = await apiCreateTemplate({
          name,
          invoice_type: toApiInvoiceType(template.invoiceType),
          paper_size: toApiPaperSize(template.paper),
          definition,
          change_summary: "Initial version",
        });
        setVersionId(res.data.id);
        // Update URL to include template_id for subsequent saves
        router.replace(`/editor?template_id=${res.data.template_id}`);
        setNotice(`Template created — "${name}"`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setNotice(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!versionId) {
      setNotice("Save the template first before publishing");
      return;
    }
    setSaving(true);
    try {
      const res = await publishVersion(versionId);
      setNotice(`Published v${res.data.version_number}`);
    } catch {
      setNotice("Publish failed");
    } finally {
      setSaving(false);
    }
  }

  if (loadingTemplate) {
    return (
      <main className={styles.appShell}>
        <div
          style={{ display: "grid", placeItems: "center", gridColumn: "1/-1" }}
        >
          <p>Loading template…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.appShell}>
      <aside className={styles.leftRail}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark}>TE</span>
          <div>
            <h1>Template Engine</h1>
            <p>Invoice designer</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/templates")}
          style={{
            marginBottom: 14,
            padding: "8px 12px",
            border: "1px solid #cfd7e2",
            borderRadius: 7,
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
          type="button"
        >
          ← Back to Templates
        </button>

        <section className={styles.panel}>
          <h2>Invoice</h2>
          <div className={styles.segmented}>
            {invoiceOptions.map((option) => (
              <button
                className={
                  invoiceType === option.key ? styles.activeSegment : ""
                }
                key={option.key}
                onClick={() => switchInvoiceType(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Variables</h2>
          <div className={styles.variableList}>
            {variableLabels[invoiceType].map((item) => (
              <button
                className={styles.variableChip}
                draggable
                key={item.key}
                onClick={() => {
                  const nextEl =
                    item.key === "order_items"
                      ? tableEl(24, 120, template.width - 48)
                      : variableEl(item.key, 24, 120, template.width - 48);
                  setTemplate((current) => ({
                    ...current,
                    elements: [...current.elements, nextEl],
                  }));
                  setSelectedId(nextEl.id);
                }}
                onDragStart={(e) =>
                  e.dataTransfer.setData("variable-key", item.key)
                }
                type="button"
              >
                <span>{item.label}</span>
                <code>{`{{${item.key}}}`}</code>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className={styles.workbench}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button
              className={styles.iconButton}
              onClick={addText}
              title="Add text"
              type="button"
            >
              T
            </button>
            <button
              className={styles.iconButton}
              onClick={addLine}
              title="Add line"
              type="button"
            >
              -
            </button>
            <button
              className={styles.iconButton}
              disabled={!selectedId}
              onClick={deleteSelected}
              title="Delete selected"
              type="button"
            >
              Del
            </button>
          </div>

          <label className={styles.selectLabel}>
            Paper
            <select
              value={paper}
              onChange={(e) => switchPaper(e.target.value as PaperKey)}
            >
              {Object.entries(paperSizes).map(([key, size]) => (
                <option key={key} value={key}>
                  {size.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.viewSwitch}>
            <button
              className={mode === "design" ? styles.activeView : ""}
              onClick={() => setMode("design")}
              type="button"
            >
              Design
            </button>
            <button
              className={mode === "preview" ? styles.activeView : ""}
              onClick={() => setMode("preview")}
              type="button"
            >
              Preview
            </button>
            <button
              className={mode === "json" ? styles.activeView : ""}
              onClick={() => setMode("json")}
              type="button"
            >
              JSON
            </button>
          </div>

          <button
            className={styles.primaryButton}
            onClick={saveTemplate}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handlePublish}
            disabled={saving || !versionId}
            type="button"
            style={{
              height: 36,
              padding: "0 14px",
              border: "1px solid #059669",
              borderRadius: 7,
              background: "#ecfdf5",
              color: "#059669",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Publish
          </button>
        </header>

        <div className={styles.stageWrap}>
          {mode === "json" ? (
            <div>
              <div
                onClick={() => navigator.clipboard.writeText(jsonPreview)}
                style={{
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                Copy
              </div>
              <pre className={styles.jsonViewer}>{jsonPreview}</pre>
            </div>
          ) : (
            <div
              className={styles.paper}
              onDragOver={(e) => e.preventDefault()}
              onDrop={dropVariable}
              onPointerMove={movePointer}
              onPointerUp={() => setDragState(null)}
              onPointerLeave={() => setDragState(null)}
              ref={canvasRef}
              style={{ width: template.width, height: template.height }}
            >
              {template.elements.map((element) => (
                <TemplateBlock
                  data={data}
                  element={element}
                  isDesign={mode === "design"}
                  isSelected={selectedId === element.id}
                  key={element.id}
                  onPointerDown={startMove}
                  onResizeStart={startResize}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className={styles.rightRail}>
        <section className={styles.panel}>
          <h2>Template Name</h2>
          <input
            type="text"
            value={templateName || template.name}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name"
            style={{
              width: "100%",
              height: 34,
              padding: "0 9px",
              border: "1px solid #cfd7e2",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
        </section>

        <section className={styles.panel}>
          <h2>Inspector</h2>
          {selected ? (
            <div className={styles.inspector}>
              <label>
                X
                <input
                  type="number"
                  value={selected.x}
                  onChange={(e) =>
                    updateSelected({ x: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={selected.y}
                  onChange={(e) =>
                    updateSelected({ y: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                W
                <input
                  type="number"
                  value={selected.width}
                  onChange={(e) =>
                    updateSelected({ width: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                H
                <input
                  type="number"
                  value={selected.height}
                  onChange={(e) =>
                    updateSelected({ height: Number(e.target.value) })
                  }
                />
              </label>
              {selected.type === "text" && (
                <label className={styles.fullField}>
                  Text
                  <textarea
                    value={selected.content ?? ""}
                    onChange={(e) =>
                      updateSelected({ content: e.target.value })
                    }
                  />
                </label>
              )}
              {selected.type !== "line" && (
                <>
                  <label>
                    Size
                    <input
                      type="number"
                      value={selected.fontSize}
                      onChange={(e) =>
                        updateSelected({ fontSize: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Weight
                    <select
                      value={selected.fontWeight ?? "400"}
                      onChange={(e) =>
                        updateSelected({
                          fontWeight: e.target
                            .value as TemplateElement["fontWeight"],
                        })
                      }
                    >
                      <option value="400">Regular</option>
                      <option value="500">Medium</option>
                      <option value="600">Semibold</option>
                      <option value="700">Bold</option>
                    </select>
                  </label>
                  <label className={styles.fullField}>
                    Align
                    <div className={styles.segmented}>
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          className={
                            selected.align === a ? styles.activeSegment : ""
                          }
                          key={a}
                          onClick={() => updateSelected({ align: a })}
                          type="button"
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </label>
                </>
              )}
            </div>
          ) : (
            <p className={styles.emptyState}>Select an element</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Preset data</h2>
          <pre className={styles.dataPreview}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </section>
        <div className={styles.notice}>{notice}</div>
      </aside>
    </main>
  );
}

function TemplateBlock({
  data,
  element,
  isDesign,
  isSelected,
  onPointerDown,
  onResizeStart,
}: {
  data: Record<string, unknown>;
  element: TemplateElement;
  isDesign: boolean;
  isSelected: boolean;
  onPointerDown: (e: PointerEvent<HTMLDivElement>, el: TemplateElement) => void;
  onResizeStart: (
    e: PointerEvent<HTMLButtonElement>,
    el: TemplateElement,
  ) => void;
}) {
  const value = element.variableKey ? data[element.variableKey] : "";
  const style = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    textAlign: element.align,
  } as const;

  return (
    <div
      className={`${styles.templateBlock} ${isDesign ? styles.designBlock : ""} ${isSelected ? styles.selectedBlock : ""}`}
      onPointerDown={(e) => onPointerDown(e, element)}
      style={style}
    >
      {element.type === "table" && (
        <ItemsTable items={Array.isArray(value) ? value : []} />
      )}
      {element.type === "line" && <span className={styles.lineElement} />}
      {element.type === "image" &&
        (isDesign ? (
          <span
            className={styles.imagePlaceholder}
          >{`{{${element.variableKey}}}`}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.templateImage}
            src={String(value ?? "")}
            alt=""
          />
        ))}
      {element.type === "text" && element.content}
      {element.type === "variable" &&
        (isDesign ? `{{${element.variableKey}}}` : String(value ?? ""))}
      {isDesign && isSelected && (
        <button
          className={styles.resizeHandle}
          onPointerDown={(e) => onResizeStart(e, element)}
          title="Resize"
          type="button"
        />
      )}
    </div>
  );
}

function ItemsTable({ items }: { items: unknown[] }) {
  return (
    <table className={styles.itemsTable}>
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const row = item as Record<string, unknown>;
          return (
            <tr key={`${row.product_name}-${i}`}>
              <td>
                <strong>{String(row.product_name ?? "")}</strong>
                <span>{String(row.variant_name ?? "")}</span>
              </td>
              <td>{String(row.quantity ?? "")}</td>
              <td>{String(row.notes ?? row.price ?? "")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
