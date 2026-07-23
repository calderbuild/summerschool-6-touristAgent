"use client";

import type { DemoRoute } from "@/lib/data";
import { statusHex, lineTextColor } from "@/lib/status";

/**
 * A compact, self-drawn schematic of the route, lettered station dots coloured
 * by accessibility status, connected by segments coloured by the line ridden
 * (dashed for a walk or an unknown-status leg). It replaces the inline Google
 * map: no WebGL, no API instance per card, and it reads as a purpose-built
 * accessibility diagram rather than a plain map. Geographic accuracy is not the
 * point here, legibility of the step-free path is.
 */
export default function AccessRibbon({ route, label }: { route: DemoRoute; label: string }) {
  const nodes = route.nodes;
  const W = 320;
  const H = 72;
  const padX = 24;
  const y = 46;
  const step = nodes.length > 1 ? (W - padX * 2) / (nodes.length - 1) : 0;
  const x = (i: number) => padX + i * step;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${label}: ${route.from} → ${route.to}`}
    >
      {/* segments (drawn first, under the dots) */}
      {nodes.slice(1).map((n, idx) => {
        const i = idx + 1;
        const walking = !n.line;
        const status = n.into?.status;
        const unknown = status === "unknown";
        // A leg with a known barrier or an unknown status must never look identical
        // to a genuinely step-free leg, dash anything that isn't solidly "ok".
        const notClear = unknown || status === "stairs" || status === "lift_down";
        const dashed = walking || notClear;
        const color = walking ? "#9aa0a8" : n.line!.color;
        return (
          <line
            key={`seg-${i}`}
            x1={x(i - 1)}
            y1={y}
            x2={x(i)}
            y2={y}
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={dashed ? "2 7" : undefined}
            opacity={unknown ? 0.75 : 1}
          />
        );
      })}

      {/* line badges above their segment */}
      {nodes.slice(1).map((n, idx) => {
        const i = idx + 1;
        if (!n.line) return null;
        const cx = (x(i - 1) + x(i)) / 2;
        const w = n.line.label.length * 6 + 8;
        return (
          <g key={`badge-${i}`}>
            <rect x={cx - w / 2} y={12} width={w} height={14} rx={3} fill={n.line.color} />
            <text
              x={cx}
              y={22}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={lineTextColor(n.line.color)}
              fontFamily="var(--ff-mono)"
            >
              {n.line.label}
            </text>
          </g>
        );
      })}

      {/* station dots, lettered A/B/C/D, coloured by accessibility status */}
      {nodes.map((n, i) => (
        <g key={`dot-${i}`}>
          <circle cx={x(i)} cy={y} r={8.5} fill={statusHex(n.at)} stroke="#ffffff" strokeWidth={2.5} />
          <text
            x={x(i)}
            y={y + 3.2}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={700}
            fill="#ffffff"
            fontFamily="var(--ff-display)"
          >
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}
    </svg>
  );
}
