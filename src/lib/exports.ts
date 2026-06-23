import { toast } from "sonner";

type Cell = string | number | boolean | null | undefined;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  toast.success(`${filename} downloaded`);
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function chunkLines(title: string, rows: Cell[][]) {
  const lines = [
    title,
    "",
    ...rows.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")),
  ];
  const wrapped: string[] = [];
  for (const line of lines) {
    if (line.length <= 95) wrapped.push(line);
    else {
      for (let i = 0; i < line.length; i += 95) wrapped.push(line.slice(i, i + 95));
    }
  }
  return wrapped;
}

export function downloadSimplePdf(filename: string, title: string, rows: Cell[][]) {
  const lines = chunkLines(title, rows);
  const pageSize = 42;
  const pages = Math.max(1, Math.ceil(lines.length / pageSize));
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages} >>`,
  );

  for (let page = 0; page < pages; page += 1) {
    const pageObject = 3 + page * 2;
    const contentObject = pageObject + 1;
    const pageLines = lines.slice(page * pageSize, page * pageSize + pageSize);
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 760 Td",
      ...pageLines.map(
        (line, index) => `${index === 0 ? "" : "0 -16 Td "}(${escapePdfText(line)}) Tj`,
      ),
      "ET",
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObject} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  downloadBlob(filename, new Blob([pdf], { type: "application/pdf" }));
  toast.success(`${filename} downloaded`);
}
