import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070709",
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 28,
            background: "#fb923c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#070709",
            fontSize: 72,
            fontWeight: 700,
            fontFamily: "ui-monospace, Menlo, monospace",
            letterSpacing: "-0.08em",
          }}
        >
          cr
        </div>
      </div>
    ),
    { ...size },
  );
}
