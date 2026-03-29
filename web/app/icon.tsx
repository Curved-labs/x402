import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          backgroundImage:
            "radial-gradient(ellipse at center, #0d0d11 0%, #070709 70%)",
        }}
      >
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: 72,
            background: "#fb923c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#070709",
            fontSize: 180,
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
