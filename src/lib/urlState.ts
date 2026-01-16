/**
 * URL State Management
 * Encodes/decodes the raw schedule input to/from the URL hash
 */

const HASH_PREFIX = "schedule=";

/**
 * Encodes raw input text to URL hash and updates the browser URL
 */
export function encodeScheduleToUrl(input: string): void {
    if (typeof window === "undefined") return;

    if (!input.trim()) {
        // Clear hash if input is empty
        window.history.replaceState(null, "", window.location.pathname);
        return;
    }

    const encoded = encodeURIComponent(input);
    window.history.replaceState(null, "", `#${HASH_PREFIX}${encoded}`);
}

/**
 * Decodes the URL hash back to raw input text
 * @returns The decoded schedule input, or empty string if none found
 */
export function decodeScheduleFromUrl(): string {
    if (typeof window === "undefined") return "";

    const hash = window.location.hash.slice(1); // Remove the '#'
    if (!hash.startsWith(HASH_PREFIX)) return "";

    const encoded = hash.slice(HASH_PREFIX.length);
    try {
        return decodeURIComponent(encoded);
    } catch {
        console.warn("Failed to decode schedule from URL");
        return "";
    }
}
