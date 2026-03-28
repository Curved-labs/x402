import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "crif — the legibility layer drift did not have";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "0 80px",
          background: "#070709",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 10% 100%, rgba(251,146,60,0.18) 0%, transparent 65%)",
          fontFamily: "system-ui, sans-serif",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 22,
            color: "#a1a1aa",
            marginBottom: 40,
            fontFamily: "ui-monospace, Menlo, monospace",
          }}
        >
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
        <div
          style={{
            fontSize: 96,
            color: "#fafafa",
            lineHeight: 0.98,
            fontWeight: 600,
            letterSpacing: "-0.045em",
          }}
        >
          the legibility layer
          <br />
          drift did <span style={{ color: "#fb923c", fontStyle: "italic" }}>
            not have.
          </span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            marginTop: 36,
            lineHeight: 1.5,
            maxWidth: 1040,
          }}
        >
          decodes squads · jupiter · drift · kamino · marginfi · token-2022.
          flags durable-nonce + multisig admin combos as CRITICAL before you
          sign.
        </div>
        <div
          style={{
            fontSize: 20,
            color: "#52525b",
            marginTop: 56,
            fontFamily: "ui-monospace, Menlo, monospace",
          }}
        >
          rust · offline mode · open source
        </div>
      </div>
    ),
    { ...size },
  );
}
