// Server-side PDF handling: identity check plus a best-effort title read.
//
// There is no sanitizer equivalent for PDFs, and none is needed for the same reason the HTML
// sanitizer can be so permissive — the threat model is about what the served bytes can do to
// *this app*. A PDF has no DOM: browsers hand it to their own out-of-process viewer (PDFium in
// Chrome, pdf.js in a privileged context in Firefox), so document-level JavaScript inside a PDF
// cannot read DropDoc's cookies, storage, or same-origin endpoints. What matters instead is that
// the bytes really are a PDF and that the response never invites the browser to reinterpret them
// as markup — see the `nosniff` + explicit content-type headers in app/r/[slug]/route.ts.
//
// So this module does two things: confirm the file is a PDF (so nothing else rides in under a
// .pdf name), and pull the document title out for the report list, falling back to the filename
// when the PDF doesn't carry one we can read.

// A title longer than this is noise, not a title; also bounds the work done per string.
const MAX_TITLE_LENGTH = 180;
const MAX_STRING_BYTES = 4096;

const PDF_SIGNATURE = "%PDF-";
// The spec puts %PDF- at byte 0, but real-world files (and Acrobat itself) tolerate leading junk,
// so scan a short prefix rather than demanding an exact match at offset 0.
const SIGNATURE_SEARCH_BYTES = 1024;

export function looksLikePdf(bytes: Uint8Array): boolean {
  return toBinaryString(bytes.subarray(0, SIGNATURE_SEARCH_BYTES)).indexOf(PDF_SIGNATURE) !== -1;
}

// Reads the document title from the trailer's Info dictionary, falling back to the XMP metadata
// packet. Both are findable in the raw bytes only when they aren't inside a compressed object
// stream — the common case, since writers keep these tiny objects uncompressed — and we make no
// attempt to inflate anything. Returns null whenever we can't produce something that plausibly
// reads as a title; the caller falls back to the filename.
export function extractPdfTitle(bytes: Uint8Array): string | null {
  const raw = toBinaryString(bytes);
  return infoDictionaryTitle(raw) ?? xmpTitle(raw);
}

// Byte-per-character view of the file. Every char code is exactly one byte (0–255), which is what
// keeps the string scanning below byte-accurate — TextDecoder("latin1") would not, since that
// label decodes as windows-1252 and remaps 0x80–0x9f.
function toBinaryString(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return out;
}

// `/Title` can also occur as random bytes inside a compressed stream, so try every occurrence and
// keep the first that decodes to something title-shaped.
function infoDictionaryTitle(raw: string): string | null {
  const key = /\/Title\s*(\(|<)/g;
  let match: RegExpExecArray | null;
  while ((match = key.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    if (match[1] === "<") {
      // `<<` opens a dictionary, not a hex string — not a title value.
      if (raw.charAt(start) === "<") continue;
      const fromHex = decodeAndClean(readHexString(raw, start));
      if (fromHex) return fromHex;
      continue;
    }
    const fromLiteral = decodeAndClean(readLiteralString(raw, start));
    if (fromLiteral) return fromLiteral;
  }
  return null;
}

// XMP packets are XML in UTF-8 and are often left uncompressed even when the Info dictionary is
// absent, which makes them a useful second chance.
function xmpTitle(raw: string): string | null {
  const match = raw.match(/<dc:title>[\s\S]{0,4096}?<rdf:li[^>]*>([\s\S]{0,4096}?)<\/rdf:li>/i);
  if (!match) return null;
  return cleanTitle(decodeXmlEntities(utf8FromBinary(match[1])));
}

// Literal string body, starting just past the opening `(`. Returns its raw bytes, or null if the
// string is unterminated or implausibly long.
function readLiteralString(raw: string, start: number): number[] | null {
  const bytes: number[] = [];
  let depth = 0;

  for (let i = start; i < raw.length; i++) {
    if (bytes.length > MAX_STRING_BYTES) return null;
    const ch = raw.charAt(i);

    if (ch === "\\") {
      const next = raw.charAt(i + 1);
      if (next === "") return null;
      i++;
      switch (next) {
        case "n": bytes.push(0x0a); break;
        case "r": bytes.push(0x0d); break;
        case "t": bytes.push(0x09); break;
        case "b": bytes.push(0x08); break;
        case "f": bytes.push(0x0c); break;
        case "(": bytes.push(0x28); break;
        case ")": bytes.push(0x29); break;
        case "\\": bytes.push(0x5c); break;
        // A backslash before a newline is a line continuation: it contributes nothing.
        case "\n": break;
        case "\r": if (raw.charAt(i + 1) === "\n") i++; break;
        default: {
          const octal = /^[0-7]{1,3}/.exec(raw.substr(i, 3));
          if (octal) {
            bytes.push(parseInt(octal[0], 8) & 0xff);
            i += octal[0].length - 1;
          } else {
            bytes.push(next.charCodeAt(0) & 0xff);
          }
        }
      }
      continue;
    }

    if (ch === "(") {
      depth++;
      bytes.push(0x28);
      continue;
    }
    if (ch === ")") {
      if (depth === 0) return bytes;
      depth--;
      bytes.push(0x29);
      continue;
    }
    bytes.push(raw.charCodeAt(i) & 0xff);
  }

  return null;
}

// Hex string body, starting just past the opening `<`.
function readHexString(raw: string, start: number): number[] | null {
  const end = raw.indexOf(">", start);
  if (end === -1 || end - start > MAX_STRING_BYTES * 2) return null;
  const digits = raw.slice(start, end).replace(/[^0-9a-fA-F]/g, "");
  // An odd digit count means the last byte is padded with a trailing zero.
  const padded = digits.length % 2 === 0 ? digits : digits + "0";
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    bytes.push(parseInt(padded.substr(i, 2), 16));
  }
  return bytes;
}

function decodeAndClean(bytes: number[] | null): string | null {
  if (!bytes || bytes.length === 0) return null;
  return cleanTitle(decodeTextString(bytes));
}

// PDF "text strings" are either UTF-16 with a byte-order mark, or PDFDocEncoding.
function decodeTextString(bytes: number[]): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  // Little-endian isn't in the spec but turns up in the wild.
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(PDF_DOC_ENCODING[bytes[i]]);
  }
  return out;
}

// PDFDocEncoding is Latin-1 except for two runs of typographic characters (0x18–0x1f and
// 0x80–0xa0). Mapping them, rather than letting them through as control bytes, keeps a title
// with an em dash or curly quotes readable instead of getting rejected as garbage below.
const PDF_DOC_ENCODING: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) table.push(i);
  const accents = [0x02d8, 0x02c7, 0x02c6, 0x02d9, 0x02dd, 0x02db, 0x02da, 0x02dc];
  for (let i = 0; i < accents.length; i++) table[0x18 + i] = accents[i];
  const typographic = [
    0x2022, 0x2020, 0x2021, 0x2026, 0x2014, 0x2013, 0x0192, 0x2044,
    0x2039, 0x203a, 0x2212, 0x2030, 0x201e, 0x201c, 0x201d, 0x2018,
    0x2019, 0x201a, 0x2122, 0xfb01, 0xfb02, 0x0141, 0x0152, 0x0160,
    0x0178, 0x017d, 0x0131, 0x0142, 0x0153, 0x0161, 0x017e, 0xfffd,
    0x20ac,
  ];
  for (let i = 0; i < typographic.length; i++) table[0x80 + i] = typographic[i];
  return table;
})();

function utf8FromBinary(binary: string): string {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  // Invalid sequences become U+FFFD, which cleanTitle rejects — the right outcome for bytes that
  // were never UTF-8 to begin with.
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => codePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function codePoint(value: number): string {
  if (!isFinite(value) || value < 0 || value > 0x10ffff) return "\ufffd";
  return String.fromCodePoint(value);
}

// The last line of defence against a false positive: a `/Title (` sequence that happened to land
// inside compressed data decodes to control bytes and replacement characters, never to prose.
function cleanTitle(text: string): string | null {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/.test(text)) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, MAX_TITLE_LENGTH).trim();
}
