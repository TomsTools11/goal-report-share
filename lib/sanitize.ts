import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  // Document structure
  "html", "head", "body", "title", "meta", "style", "link",
  // Sections
  "header", "footer", "main", "section", "article", "aside", "nav",
  // Headings
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Block elements
  "div", "p", "blockquote", "pre", "code", "hr", "br",
  // Lists
  "ul", "ol", "li", "dl", "dt", "dd",
  // Tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  // Inline elements
  "span", "a", "strong", "b", "em", "i", "u", "s", "small", "sub", "sup", "mark", "abbr", "cite",
  // Media (safe)
  "img", "svg", "path", "circle", "rect", "line", "polyline", "polygon", "g", "defs",
  "linearGradient", "radialGradient", "stop", "text", "tspan", "use", "clipPath", "mask",
  "pattern", "symbol", "ellipse",
  // Figures
  "figure", "figcaption",
  // Details
  "details", "summary",
  // Other
  "address", "time", "wbr",
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  "*": ["class", "id", "style", "data-*", "role", "aria-*", "lang", "dir", "title"],
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height", "loading"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  col: ["span"],
  colgroup: ["span"],
  meta: ["charset", "name", "content"],
  link: ["rel", "href", "type", "crossorigin", "media"],
  time: ["datetime"],
  svg: ["viewBox", "xmlns", "width", "height", "fill", "stroke", "stroke-width"],
  path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "transform"],
  circle: ["cx", "cy", "r", "fill", "stroke"],
  rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke"],
  line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width"],
  polyline: ["points", "fill", "stroke"],
  polygon: ["points", "fill", "stroke"],
  g: ["transform", "fill", "stroke"],
  text: ["x", "y", "text-anchor", "font-size", "fill", "transform"],
  tspan: ["x", "y", "dx", "dy"],
  linearGradient: ["id", "x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform"],
  radialGradient: ["id", "cx", "cy", "r", "fx", "fy", "gradientUnits"],
  stop: ["offset", "stop-color", "stop-opacity"],
  use: ["href", "x", "y", "width", "height"],
  clipPath: ["id"],
  mask: ["id"],
  symbol: ["id", "viewBox"],
  ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke"],
};

export function sanitizeReport(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "data", "mailto"],
    allowVulnerableTags: true, // needed for <style> support
    allowedStyles: {
      "*": {
        // Allow all CSS properties (they're safe — only JS in CSS is dangerous, and CSP blocks that)
        "/.*/": [/.*/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => {
        // Ensure external links open in new tab and are safe
        return {
          tagName,
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  });
}

export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || "Untitled Report";
}
