import assert from "node:assert/strict";
import { test } from "node:test";
import { groupPvlRows, parseNativePvlPdf, parsePvlReportLayout, type PvlTextItem } from "@/lib/game-extractor";

/** One player row: jersey and name runs plus an optional Pts cell (undefined = blank). */
function playerRow(side: "left" | "right", y: number, jersey: string, name: string, pts?: string, extra: PvlTextItem[] = []): PvlTextItem[] {
  const base = side === "left" ? 20 : 320;
  const ptsX = side === "left" ? 285 : 556;
  const row: PvlTextItem[] = [
    { str: jersey, x: base, y },
    { str: name, x: base + 18, y: y + 0.6 }, // slight baseline jitter within ±2
    ...extra,
  ];
  if (pts !== undefined) row.push({ str: pts, x: ptsX, y: y - 0.4 });
  return row;
}

const sheet: PvlTextItem[] = [
  // Set score band (y 705..725): code and sets won side by side.
  { str: "HSH", x: 120, y: 715 }, { str: "3", x: 250, y: 715 },
  { str: "1", x: 350, y: 714.2 }, { str: "CMF", x: 470, y: 715 },
  // Team headers.
  { str: "HSH • PLDT HIGH SPEED HITTERS", x: 20, y: 640 },
  { str: "CMF • CHOCO MUCHO FLYING TITANS", x: 320, y: 640 },
  { str: "Pts", x: 285, y: 625 }, { str: "Pts", x: 556, y: 625 },
  // Left team.
  ...playerRow("left", 610, "1", "Ma. Cristina CABANLIT", "12"),
  ...playerRow("left", 598, "4", "Shiela MaeL KIAD", undefined), // libero glued to name, blank Pts
  ...playerRow("left", 586, "7", "Fiola CEBALLOS", "0"),
  ...playerRow("left", 574, "9", "Mika DE LA CRUZ", undefined), // blank Pts must not borrow the next row's 15
  ...playerRow("left", 562, "11", "Dell PALOMATA", "15"),
  ...playerRow("left", 550, "14", "Jessey DE LEON", "4", [{ str: "C", x: 160, y: 550 }]),
  { str: "Coach: Rald RICAFORT", x: 20, y: 520 },
  { str: "Ignored after coach 99", x: 20, y: 500 },
  // Right team.
  ...playerRow("right", 610, "2", "Sisi RONDINA", "20"),
  ...playerRow("right", 598, "5", "Ma. Lourdes DACORON-YU", "3"),
  ...playerRow("right", 586, "8", "Thang PONCE", undefined, [{ str: "L", x: 450, y: 586 }]), // separate libero marker
  ...playerRow("right", 574, "12", "Cherry NUNAG", undefined),
  ...playerRow("right", 562, "16", "Kat TOLENTINO", "9"),
  ...playerRow("right", 550, "18", "Royse TUBINO", "6"),
  { str: "Coach: Dante ALINSUNURIN", x: 320, y: 520 },
];

test("groupPvlRows merges items within ±2 units into one row, top first", () => {
  const rows = groupPvlRows([
    { str: "b", x: 50, y: 100.9 }, { str: "a", x: 10, y: 99.5 }, { str: "top", x: 10, y: 200 }, { str: "low", x: 10, y: 96 },
  ]);
  assert.deepEqual(rows.map(r => r.map(i => i.str)), [["top"], ["a", "b"], ["low"]]);
});

test("parsePvlReportLayout reads both team sections and the set score band", () => {
  const layout = parsePvlReportLayout(sheet);
  assert.ok(layout);
  assert.equal(layout.left.code, "HSH");
  assert.equal(layout.left.name, "PLDT High Speed Hitters");
  assert.equal(layout.right.code, "CMF");
  assert.equal(layout.left.sets, 3);
  assert.equal(layout.right.sets, 1);
  assert.equal(layout.left.players.length, 6);
  assert.equal(layout.right.players.length, 6);
});

test("names keep periods, spaces and hyphens, including Ma.", () => {
  const layout = parsePvlReportLayout(sheet)!;
  assert.equal(layout.left.players[0].name, "Ma. Cristina CABANLIT");
  assert.equal(layout.left.players[0].jersey, 1);
  assert.equal(layout.right.players[1].name, "Ma. Lourdes DACORON-YU");
  assert.equal(layout.left.players[3].name, "Mika DE LA CRUZ");
});

test("libero badges are detected whether attached to the name or separate", () => {
  const layout = parsePvlReportLayout(sheet)!;
  const kiad = layout.left.players[1];
  assert.equal(kiad.name, "Shiela Mae KIAD");
  assert.equal(kiad.isLibero, true);
  const ponce = layout.right.players[2];
  assert.equal(ponce.name, "Thang PONCE");
  assert.equal(ponce.isLibero, true);
  assert.equal(layout.left.players[0].isLibero, false);
  // A captain marker is not part of the name.
  assert.equal(layout.left.players[5].name, "Jessey DE LEON");
});

test("blank Pts cells are 0 and never shift later players' points", () => {
  const layout = parsePvlReportLayout(sheet)!;
  assert.deepEqual(layout.left.players.map(p => p.pts), [12, 0, 0, 0, 15, 4]);
  assert.deepEqual(layout.right.players.map(p => p.pts), [20, 3, 0, 0, 9, 6]);
});

test("parsePvlReportLayout returns null without two team sections", () => {
  assert.equal(parsePvlReportLayout(sheet.filter(i => i.x < 300)), null);
});

/** Builds a one-page PDF placing each item at its exact coordinates (Helvetica, WinAnsi). */
function buildPdf(items: PvlTextItem[]): Uint8Array {
  const winAnsi = (text: string) => text.replace(/[\\()]/g, m => "\\" + m).replace(/•/g, "\\225");
  const content = items.map(i => `BT /F1 8 Tf ${i.x} ${i.y} Td (${winAnsi(i.str)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}

test("parseNativePvlPdf reads rows from positioned PDF text without shifting points", async () => {
  const payload = await parseNativePvlPdf(buildPdf(sheet), "ELIMINATION", "FINAL", "https://dashboard.pvl.ph/PVL2627B-W34-HSH-CMF-P2.pdf");
  assert.ok(payload);
  assert.equal(payload.homeTeam.shortName, "HSH");
  assert.equal(payload.awayTeam.shortName, "CMF");
  assert.equal(payload.homeTeam.score, 3);
  assert.equal(payload.awayTeam.score, 1);
  assert.deepEqual(payload.boxScore.home.map(r => [r.jersey, r.pts]), [[1, 12], [4, 0], [7, 0], [9, 0], [11, 15], [14, 4]]);
  assert.deepEqual(payload.boxScore.away.map(r => r.pts), [20, 3, 0, 0, 9, 6]);
  assert.equal(payload.boxScore.home[0].playerName, "Ma. Cristina Cabanlit");
  assert.equal(payload.boxScore.home[1].playerName, "Shiela Mae Kiad");
  assert.equal(payload.boxScore.away[1].playerName, "Ma. Lourdes Dacoron-Yu");
});
