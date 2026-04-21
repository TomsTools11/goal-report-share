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
  // Form controls — reports commonly use these for filters and interactive UI. Safe in concert
  // with CSP `sandbox` (null origin) and `form-action 'none'` on the report response.
  "form", "fieldset", "legend", "label", "input", "textarea", "select", "option", "optgroup",
  "button", "datalist", "output", "progress", "meter",
  // Other
  "address", "time", "wbr",
  // Scripts — safe here because the report is served with `Content-Security-Policy: sandbox
  // allow-scripts allow-popups`, which forces the document into an opaque/null origin. Inline
  // and external JS can run, but cannot read app-origin cookies, localStorage, or same-origin
  // responses.
  "script", "noscript",
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
  script: ["src", "type", "async", "defer", "crossorigin", "integrity", "nomodule", "referrerpolicy"],
  form: ["action", "method", "enctype", "target", "autocomplete", "novalidate"],
  input: ["name", "type", "value", "placeholder", "disabled", "readonly", "required", "min", "max",
    "step", "pattern", "checked", "autocomplete", "maxlength", "minlength", "list", "multiple", "size", "accept"],
  textarea: ["name", "rows", "cols", "placeholder", "disabled", "readonly", "required", "maxlength", "minlength", "wrap"],
  select: ["name", "multiple", "disabled", "size", "required", "autocomplete"],
  option: ["value", "selected", "disabled", "label"],
  optgroup: ["label", "disabled"],
  button: ["type", "disabled", "name", "value", "form", "formaction", "formmethod", "formenctype", "formtarget", "formnovalidate"],
  label: ["for"],
  fieldset: ["disabled", "form", "name"],
  output: ["for", "form", "name"],
  progress: ["value", "max"],
  meter: ["value", "min", "max", "low", "high", "optimum"],
  datalist: ["id"],
};

// sanitize-html drops attributes whose value is the empty string (e.g. `<option value="">All
// producers</option>`). That breaks interactive reports that rely on an explicit empty value — the
// option falls back to its text content and filter logic no longer matches. Preserve empty values
// through a unique sentinel that we swap back out after sanitization.
const EMPTY_VALUE_SENTINEL = "__REPORT_EMPTY_ATTR__";

export function sanitizeReport(html: string): string {
  const preprocessed = html.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)=""/g, `$1="${EMPTY_VALUE_SENTINEL}"`);
  const sanitized = sanitizeHtml(preprocessed, {
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
  return sanitized.split(EMPTY_VALUE_SENTINEL).join("");
}

export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || "Untitled Report";
}
