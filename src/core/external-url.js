const ALLOWED_EXTERNAL_HOSTS = new Set(["github.com", "www.github.com"]);

function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    return url.protocol === "https:" && ALLOWED_EXTERNAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

module.exports = { isAllowedExternalUrl };
