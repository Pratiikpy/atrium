// Minimal stroke icon set for the desktop app shell — ported from refs.

export type AppIconName =
  | "portfolio" | "trade" | "transfer" | "agents" | "reserves" | "tax"
  | "settings" | "docs" | "search" | "bell" | "chev" | "chevDn" | "plus"
  | "arrow" | "arrowUR" | "check" | "x" | "info" | "copy" | "download"
  | "refresh" | "venue" | "spark" | "shield";

export function AppIcon({ name, size = 16 }: { name: AppIconName; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 16 16", fill: "none",
    stroke: "currentColor", strokeWidth: 1.4 as const,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "portfolio": return (<svg {...common}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 7h12" /><path d="M5.5 10h2 M9 10h1.5" /></svg>);
    case "trade":     return (<svg {...common}><path d="M2.5 11.5l3-3 2.5 2.5 5.5-5.5" /><path d="M9.5 5.5h4v4" /></svg>);
    case "transfer":  return (<svg {...common}><path d="M2 5h11l-2.4-2.4 M14 11H3l2.4 2.4" /></svg>);
    case "agents":    return (<svg {...common}><circle cx="8" cy="6" r="2.4" /><path d="M3 13c0-2.4 2.2-4 5-4s5 1.6 5 4" /></svg>);
    case "reserves":  return (<svg {...common}><path d="M3 6l5-3 5 3v3c0 2.4-2.2 4-5 4s-5-1.6-5-4V6z" /><path d="M6.4 8.2l1.2 1.2 2.6-2.6" /></svg>);
    case "tax":       return (<svg {...common}><rect x="3" y="2.5" width="10" height="11" rx="1" /><path d="M5.5 5.5h5 M5.5 8h5 M5.5 10.5h3" /></svg>);
    case "settings":  return (<svg {...common}><circle cx="8" cy="8" r="2" /><path d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2 M3.4 3.4l1.4 1.4 M11.2 11.2l1.4 1.4 M3.4 12.6l1.4-1.4 M11.2 4.8l1.4-1.4" /></svg>);
    case "docs":      return (<svg {...common}><path d="M4 2.5h6l3 3v8H4v-11z" /><path d="M10 2.5v3h3" /><path d="M6 8h5 M6 10.5h5 M6 5.5h2" /></svg>);
    case "search":    return (<svg {...common}><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2L13 13" /></svg>);
    case "bell":      return (<svg {...common}><path d="M4 11V7.5a4 4 0 1 1 8 0V11l1 1.5H3L4 11z" /><path d="M6.5 14a1.5 1.5 0 0 0 3 0" /></svg>);
    case "chev":      return (<svg {...common}><path d="M5.5 4.5L9.5 8l-4 3.5" /></svg>);
    case "chevDn":    return (<svg {...common}><path d="M4 6l4 4 4-4" /></svg>);
    case "plus":      return (<svg {...common}><path d="M8 2.5v11 M2.5 8h11" /></svg>);
    case "arrow":     return (<svg {...common}><path d="M3.5 8h9 M9 4.5L12.5 8 9 11.5" /></svg>);
    case "arrowUR":   return (<svg {...common}><path d="M5 11L11 5 M5.5 5h5.5v5.5" /></svg>);
    case "check":     return (<svg {...common}><path d="M3 8.4L6.2 11 13 4.5" /></svg>);
    case "x":         return (<svg {...common}><path d="M3.5 3.5l9 9 M12.5 3.5l-9 9" /></svg>);
    case "info":      return (<svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 6v0.01 M8 8v3.5" /></svg>);
    case "copy":      return (<svg {...common}><rect x="5" y="2.5" width="8" height="8" rx="1" /><path d="M5 5H3.5v8H11v-1.5" /></svg>);
    case "download":  return (<svg {...common}><path d="M8 2.5v8.5 M4.5 7.5L8 11l3.5-3.5" /><path d="M3 13.5h10" /></svg>);
    case "refresh":   return (<svg {...common}><path d="M3 8a5 5 0 0 1 9-3l1 1.2 M13 8a5 5 0 0 1-9 3l-1-1.2" /><path d="M13 3v3.2h-3.2 M3 13v-3.2h3.2" /></svg>);
    case "venue":     return (<svg {...common}><rect x="2.5" y="4" width="11" height="9" /><path d="M5 4V2.5h6V4 M2.5 7h11" /></svg>);
    case "spark":     return (<svg {...common}><path d="M2 11l3-4 2.5 2.5 3.5-5.5 3 7" /></svg>);
    case "shield":    return (<svg {...common}><path d="M3 4l5-2 5 2v4c0 2.7-2.3 5-5 6-2.7-1-5-3.3-5-6V4z" /></svg>);
  }
}
