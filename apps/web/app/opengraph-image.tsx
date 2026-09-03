import { ImageResponse } from "next/og";
export const alt = "Ravex — Ideas engineered for impact";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() { return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 70, color: "#f2f0e9", background: "radial-gradient(circle at 80% 20%, #27483d, #07110f 55%)", fontFamily: "sans-serif" }}><div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, letterSpacing: 7 }}><span style={{ display: "flex", width: 46, height: 46, border: "2px solid #b8f343", borderRadius: "50%", alignItems: "center", justifyContent: "center", letterSpacing: 0 }}>R</span>RAVEX</div><div style={{ display: "flex", fontSize: 88, letterSpacing: -5, lineHeight: 1 }}>Ideas engineered<br/>for impact<span style={{ color: "#b8f343" }}>.</span></div><div style={{ color: "#93a19b", fontSize: 21 }}>FINTECH · AI · PEOPLE TECHNOLOGY</div></div>, size); }

