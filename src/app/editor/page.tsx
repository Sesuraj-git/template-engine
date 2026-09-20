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
    outlet_address: "123, MG Road, Indiranagar, Bengaluru, Karnataka 560038",
    outlet_gstin: "29AAAAA0000A1Z5",
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
    outlet_address: "123, MG Road, Indiranagar, Bengaluru, Karnataka 560038",
    outlet_gstin: "29AAAAA0000A1Z5",
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
    { key: "outlet_address", label: "Outlet address" },
    { key: "outlet_gstin", label: "GSTIN" },
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
    { key: "outlet_address", label: "Outlet address" },
    { key: "outlet_gstin", label: "GSTIN" },
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

// Shared left margin + row rhythm for every default layout: tight enough
// that thermal paper (billed by length) isn't wasted, generous enough to
// stay legible at 203dpi.
const MARGIN = 18;
const ROW = 22;

function buildDefaultTemplate(
  invoiceType: InvoiceType,
  paper: PaperKey,
): TemplateDefinition {
  const size = paperSizes[paper];
  const contentWidth = size.width - MARGIN * 2;

  if (invoiceType === "kot") {
    const elements: TemplateElement[] = [];
    let y = MARGIN;

    elements.push(imageEl("outlet_image_icon", MARGIN, y, 32));
    elements.push(heading("Kitchen Order Ticket", MARGIN, y, contentWidth));
    y += 40;

    elements.push(
      variableEl("kot_number", MARGIN, y, contentWidth, "center", 15, "700"),
    );
    y += ROW + 4;

    elements.push(lineEl(MARGIN, y, contentWidth));
    y += 10;

    y = labelValueRow(elements, y, contentWidth, "Order", "order_id");
    y = labelValueRow(elements, y, contentWidth, "Table", "table_number");
    y = labelValueRow(elements, y, contentWidth, "Type", "order_type");
    y += 4;

    elements.push(lineEl(MARGIN, y, contentWidth));
    y += 10;

    const tableHeight = 160;
    elements.push(tableEl(MARGIN, y, contentWidth, tableHeight));
    y += tableHeight + 10;

    elements.push(lineEl(MARGIN, y, contentWidth));
    y += 10;

    elements.push(
      variableEl(
        "payment_status",
        MARGIN,
        y,
        contentWidth,
        "center",
        12,
        "600",
      ),
    );
    y += ROW - 2;
    elements.push(
      variableEl("order_time", MARGIN, y, contentWidth, "center", 11),
    );
    y += ROW - 2;
    elements.push(
      variableEl("outlet_name", MARGIN, y, contentWidth, "center", 12, "700"),
    );
    y += ROW;

    return {
      id: newId(),
      name: "Kitchen order ticket",
      invoiceType,
      paper,
      width: size.width,
      height: Math.max(size.height, y + MARGIN),
      elements,
    };
  }

  if (invoiceType === "paymentReceipt") {
    const elements: TemplateElement[] = [];
    let y = MARGIN;

    elements.push(heading("Payment Receipt", MARGIN, y, contentWidth));
    y += 36;

    elements.push(
      variableEl(
        "receipt_number",
        MARGIN,
        y,
        contentWidth,
        "center",
        15,
        "700",
      ),
    );
    y += ROW + 4;

    elements.push(lineEl(MARGIN, y, contentWidth));
    y += 10;

    y = labelValueRow(elements, y, contentWidth, "Order", "order_id");
    y = labelValueRow(elements, y, contentWidth, "Method", "payment_method");
    y = labelValueRow(elements, y, contentWidth, "Txn ID", "transaction_id");
    y += 8;

    elements.push(lineEl(MARGIN, y, contentWidth));
    y += 10;

    elements.push(textEl("Amount paid", MARGIN, y, 150, 30, 15, "700"));
    elements.push(
      variableEl(
        "paid_amount",
        MARGIN + 150,
        y,
        contentWidth - 150,
        "right",
        17,
        "700",
      ),
    );
    y += 36;

    elements.push(lineEl(MARGIN, y, contentWidth));
    y += 10;

    elements.push(variableEl("paid_at", MARGIN, y, contentWidth, "center", 11));
    y += ROW - 2;
    elements.push(
      variableEl("cashier_name", MARGIN, y, contentWidth, "center", 11),
    );
    y += ROW - 2;
    y = outletFooter(elements, y, contentWidth);

    return {
      id: newId(),
      name: "Payment receipt",
      invoiceType,
      paper,
      width: size.width,
      height: Math.max(size.height, y + MARGIN),
      elements,
    };
  }

  // Order bill — pinned to the hand-tuned layout below rather than
  // generated, so it stays exactly as designed instead of drifting on
  // every code change.
  return {
    id: newId(),
    name: "Order bill",
    invoiceType,
    paper,
    width: size.width,
    height: size.height,
    elements: buildOrderBillElements(paper),
  };
}

// Base coordinates were authored against thermal80 (326x860); other paper
// sizes reuse the same scale-and-clamp math as switchPaper so the layout
// still fits instead of overflowing a narrower/shorter canvas.
const ORDER_BILL_BASE_PAPER: PaperKey = "thermal80";

const orderBillBaseElements: Omit<TemplateElement, "id">[] = [
  {
    type: "text",
    x: 19,
    y: 15,
    width: 290,
    height: 38,
    content: "Order Invoice",
    fontSize: 18,
    fontWeight: "700",
    align: "center",
  },
  {
    type: "variable",
    variableKey: "bill_number",
    x: 22,
    y: 108,
    width: 290,
    height: 30,
    fontSize: 15,
    fontWeight: "700",
    align: "center",
  },
  { type: "line", x: 22, y: 99, width: 290, height: 1, fontSize: 1 },
  {
    type: "text",
    x: 19,
    y: 141,
    width: 76,
    height: 20,
    content: "Order",
    fontSize: 12,
    fontWeight: "600",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "order_id",
    x: 99,
    y: 139,
    width: 214,
    height: 30,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
  {
    type: "text",
    x: 29,
    y: 740,
    width: 76,
    height: 20,
    content: "Table",
    fontSize: 12,
    fontWeight: "600",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "table_number",
    x: 197,
    y: 165,
    width: 112,
    height: 33,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
  {
    type: "text",
    x: 19,
    y: 167,
    width: 76,
    height: 20,
    content: "Type",
    fontSize: 12,
    fontWeight: "600",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "order_type",
    x: 99,
    y: 167,
    width: 153,
    height: 29,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
  { type: "line", x: 19, y: 204, width: 290, height: 1, fontSize: 1 },
  {
    type: "table",
    variableKey: "order_items",
    x: 19,
    y: 187,
    width: 290,
    height: 150,
    fontSize: 11,
    fontWeight: "400",
    align: "left",
  },
  { type: "line", x: 21, y: 323, width: 290, height: 1, fontSize: 1 },
  {
    type: "text",
    x: 19,
    y: 339,
    width: 110,
    height: 20,
    content: "Subtotal",
    fontSize: 12,
    fontWeight: "500",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "subtotal",
    x: 129,
    y: 341,
    width: 180,
    height: 30,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
  {
    type: "text",
    x: 19,
    y: 368,
    width: 110,
    height: 20,
    content: "Tax",
    fontSize: 12,
    fontWeight: "500",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "tax",
    x: 129,
    y: 367,
    width: 180,
    height: 30,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
  {
    type: "text",
    x: 19,
    y: 398,
    width: 110,
    height: 20,
    content: "Discount",
    fontSize: 12,
    fontWeight: "500",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "discount",
    x: 126,
    y: 397,
    width: 180,
    height: 30,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
  { type: "line", x: 18, y: 432, width: 290, height: 1, fontSize: 1 },
  {
    type: "text",
    x: 19,
    y: 441,
    width: 110,
    height: 26,
    content: "Grand Total",
    fontSize: 14,
    fontWeight: "700",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "grand_total",
    x: 136,
    y: 440,
    width: 180,
    height: 30,
    fontSize: 14,
    fontWeight: "700",
    align: "right",
  },
  { type: "line", x: 25, y: 480, width: 290, height: 1, fontSize: 1 },
  {
    type: "variable",
    variableKey: "payment_status",
    x: 23,
    y: 489,
    width: 290,
    height: 30,
    fontSize: 12,
    fontWeight: "600",
    align: "center",
  },
  {
    type: "variable",
    variableKey: "outlet_name",
    x: 19,
    y: 47,
    width: 290,
    height: 30,
    fontSize: 12,
    fontWeight: "700",
    align: "center",
  },
  {
    type: "variable",
    variableKey: "outlet_address",
    x: 18,
    y: 70,
    width: 290,
    height: 30,
    fontSize: 10,
    fontWeight: "500",
    align: "center",
  },
  {
    type: "text",
    x: 82,
    y: 583,
    width: 131,
    height: 20,
    content: "GSTIN",
    fontSize: 12,
    fontWeight: "600",
    align: "left",
  },
  {
    type: "variable",
    variableKey: "outlet_gstin",
    x: 173,
    y: 17,
    width: 153,
    height: 31,
    fontSize: 12,
    fontWeight: "500",
    align: "right",
  },
];

function buildOrderBillElements(paper: PaperKey): TemplateElement[] {
  const base = paperSizes[ORDER_BILL_BASE_PAPER];
  const target = paperSizes[paper];
  const scaleX = target.width / base.width;
  const scaleY = target.height / base.height;

  return orderBillBaseElements.map((el) => ({
    ...el,
    id: newId(),
    x: Math.round(el.x * scaleX),
    y: Math.round(el.y * scaleY),
    width: Math.max(18, Math.round(el.width * scaleX)),
    height: Math.max(1, Math.round(el.height * scaleY)),
  }));
}

// Pushes a "Label ........ {{value}}" row and returns the next y cursor.
function labelValueRow(
  elements: TemplateElement[],
  y: number,
  contentWidth: number,
  label: string,
  variableKey: string,
): number {
  const labelWidth = 76;
  elements.push(textEl(label, MARGIN, y, labelWidth, ROW - 2, 12, "600"));
  elements.push(
    variableEl(
      variableKey,
      MARGIN + labelWidth,
      y,
      contentWidth - labelWidth,
      "right",
      12,
    ),
  );
  return y + ROW;
}

// Appends the shared outlet-name / address / GSTIN footer block used by the
// order bill and payment receipt — both are tax documents; the KOT skips it.
function outletFooter(
  elements: TemplateElement[],
  y: number,
  contentWidth: number,
): number {
  elements.push(
    variableEl("outlet_name", MARGIN, y, contentWidth, "center", 12, "700"),
  );
  y += ROW - 2;
  elements.push(
    variableEl("outlet_address", MARGIN, y, contentWidth, "center", 10),
  );
  y += ROW - 4;
  return labelValueRow(elements, y, contentWidth, "GSTIN", "outlet_gstin");
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

function tableEl(
  x: number,
  y: number,
  width: number,
  height = 150,
): TemplateElement {
  return {
    id: newId(),
    type: "table",
    variableKey: "order_items",
    x,
    y,
    width,
    height,
    fontSize: 11,
    fontWeight: "400",
    align: "left",
  };
}

function imageEl(
  key: string,
  x: number,
  y: number,
  size: number,
): TemplateElement {
  return {
    id: newId(),
    type: "image",
    variableKey: key,
    x,
    y,
    width: size,
    height: size,
    fontSize: 11,
    align: "center",
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
  // Bill items carry a price, KOT items carry a prep note — the third
  // column reflects whichever the data actually has instead of a fixed
  // "Notes" label that misrepresents order-bill line prices.
  const hasPrice = items.some(
    (item) => (item as Record<string, unknown>).price !== undefined,
  );

  return (
    <table className={styles.itemsTable}>
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>{hasPrice ? "Price" : "Notes"}</th>
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
              <td>{String(row.price ?? row.notes ?? "")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
