import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "crif — transaction legibility engine for Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#070709",
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(251,146,60,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(167,139,250,0.1) 0%, transparent 55%)",
          padding: "72px 80px",
          fontFamily: "ui-monospace, Menlo, monospace",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#a1a1aa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 14,
                height: 14,
                background: "#fb923c",
                borderRadius: 999,
              }}
            />
            <span style={{ color: "#fafafa" }}>crif</span>
          </div>
          <div style={{ color: "#52525b" }}>v0.1.0 · pre-deployment</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 110,
              color: "#fafafa",
              lineHeight: 0.95,
              letterSpacing: "-0.045em",
              fontWeight: 600,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            see what you{" "}
            <span style={{ color: "#fb923c", fontStyle: "italic" }}>sign.</span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#a1a1aa",
              lineHeight: 1.45,
              maxWidth: 1000,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            transaction legibility for solana. decodes anchor instructions,
            diffs state against live rpc, detects the drift 2026 exploit
            pattern.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 28,
            borderTop: "1px solid #1c1c22",
            fontSize: 20,
            color: "#52525b",
          }}
        >
          <div style={{ display: "flex", gap: 40 }}>
            <span>
              <span style={{ color: "#fafafa" }}>08</span> programs
            </span>
            <span>
              <span style={{ color: "#fafafa" }}>80+</span> instructions
            </span>
            <span>
              <span style={{ color: "#fafafa" }}>28/28</span> tests
            </span>
          </div>
          <div style={{ color: "#fb923c" }}>
            drift 2026 · detected
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
