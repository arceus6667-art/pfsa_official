function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export async function GET() {
  const lines = [
    "PRAMAAN FORENSICS ACADEMY — WEEKLY TASK BRIEF",
    "",
    "This is a prototype task brief. The academy should replace this content",
    "with the published programme-specific PDF before operational use.",
    "",
    "Week 1: Preserve and document the evidence-handling sequence.",
    "Record assumptions, maintain an examination log, and identify limits.",
    "",
    "Submission: upload supporting work and a minimum 200-word reflection",
    "through the student dashboard. Submissions remain subject to review.",
  ];
  const stream = ["BT", "/F1 14 Tf", "72 735 Td"]
    .concat(lines.flatMap((line, index) => index === 0 ? [`(${escapePdf(line)}) Tj`] : [`0 -24 Td (${escapePdf(line)}) Tj`]))
    .concat(["ET"]).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=pfsa-weekly-task-brief.pdf" } });
}

