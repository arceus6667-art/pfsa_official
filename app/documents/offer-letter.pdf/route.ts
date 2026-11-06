const esc = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export async function GET() {
  const lines = ["PRAMAAN FORENSICS ACADEMY — OFFER LETTER", "", "This prototype offer letter demonstrates the student download workflow.", "The issued letter must be generated from an approved database record before", "operational use and must include the correct candidate, programme and offer ID.", "", "Precision in Science. Integrity in Evidence."];
  const stream = ["BT", "/F1 15 Tf", "72 735 Td", ...lines.flatMap((line, index) => index === 0 ? [`(${esc(line)}) Tj`] : [`0 -25 Td (${esc(line)}) Tj`]), "ET"].join("\n");
  const bodies = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  bodies.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n`; offsets.slice(1).forEach(x => pdf += `${String(x).padStart(10, "0")} 00000 n \n`);
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=pfsa-offer-letter.pdf" } });
}

