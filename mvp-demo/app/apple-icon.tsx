import { ImageResponse } from "next/og";

// The icon iOS uses when someone adds this to their home screen, which is a real
// path for a mobile-first travel app: you open it once on the trip, not from a
// browser bookmark. Without one iOS screenshots the page and uses that.
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
          background: "#12202e",
        }}
      >
        <svg width="104" height="123" viewBox="0 0 22 26" fill="none">
          <path d="M6 3v20" stroke="#f5f4f0" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="6" cy="8" r="3" fill="#f5f4f0" />
          <path
            d="M12 15h7m0 0-3-3m3 3-3 3"
            stroke="#f5f4f0"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size
  );
}
