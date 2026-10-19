import { ImageResponse } from "next/og";

export const alt = "Sportsmetric — Philippine sports scores and player statistics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0d1118", color: "#f7f8fa", padding: "65px 75px", borderTop: "12px solid #ed2839" }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#ed2839" }}>SPORTSMETRIC</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 74, fontWeight: 700, lineHeight: 1.1 }}>Philippine sports. Individual excellence.</div>
        <div style={{ display: "flex", fontSize: 29, color: "#b3bfce" }}>Scores · Player statistics · Standings · Sports history</div>
      </div>
      <div style={{ display: "flex", fontSize: 25, color: "#b3bfce" }}>www.sportsmetric.ph</div>
    </div>, size,
  );
}
