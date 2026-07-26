import { ImageResponse } from "next/og";

/**
 * The picture that shows up when someone pastes the link.
 *
 * It is the product's own thesis rather than a logo on a gradient: a route that
 * runs green where it is step-free, hatched grey where we do not know, and blue
 * where a lift is doing the work. Anyone who sees the preview has already been
 * told what this app is for and that it admits what it cannot see.
 *
 * No custom font on purpose. ImageResponse can only use fonts whose bytes it is
 * handed, and shipping three woff2 files into the edge bundle to render one
 * static card is a poor trade when the built-in sans reads perfectly well at
 * this size.
 */

export const alt = "Voie Libre: step-free routes across Paris";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#12202e";
const PAPER = "#f5f4f0";
const OK = "#2fb37a";
const SIGNAL = "#4d90dd";
const UNKNOWN = "#8b929c";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          padding: "72px 80px",
          color: PAPER,
          fontFamily: "sans-serif",
        }}
      >
        {/* wordmark, with the same step-free glyph the app uses */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="38" height="45" viewBox="0 0 22 26" fill="none">
            <path d="M6 3v20" stroke={PAPER} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="6" cy="8" r="3" fill={PAPER} />
            <path
              d="M12 15h7m0 0-3-3m3 3-3 3"
              stroke={PAPER}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>Voie Libre</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* maxWidth is set to break the line after "Paris" rather than
              orphaning "stairs." onto a line of its own. */}
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.4, maxWidth: 700 }}>
            Get across Paris without the stairs.
          </div>

          {/* The route line: green, then the hatched stretch we cannot vouch for,
              then a lift leg. Hatching is drawn as discrete ticks because a
              pattern fill is not worth the complexity for one static image. */}
          <svg width="1040" height="34" viewBox="0 0 1040 34" fill="none">
            <line x1="14" y1="17" x2="330" y2="17" stroke={OK} strokeWidth="9" strokeLinecap="round" />
            {Array.from({ length: 15 }, (_, i) => (
              <line
                key={i}
                x1={352 + i * 18}
                y1="24"
                x2={364 + i * 18}
                y2="10"
                stroke={UNKNOWN}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}
            <line x1="640" y1="17" x2="1026" y2="17" stroke={SIGNAL} strokeWidth="9" strokeLinecap="round" />
            <circle cx="14" cy="17" r="13" fill={OK} />
            <circle cx="330" cy="17" r="13" fill={UNKNOWN} />
            <circle cx="640" cy="17" r="13" fill={SIGNAL} />
            <circle cx="1026" cy="17" r="15" fill={PAPER} />
          </svg>

          <div style={{ fontSize: 29, color: "rgba(245,244,240,0.72)", maxWidth: 900, lineHeight: 1.35 }}>
            Working lifts, stairs and long walks along the way, and an honest &quot;unknown&quot; when nobody
            has checked.
          </div>
        </div>
      </div>
    ),
    size
  );
}
