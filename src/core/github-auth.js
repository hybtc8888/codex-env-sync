const DEFAULT_GITHUB_APP_CLIENT_ID = "Iv23liWtNhmzmTmFFNJO";
const { retryTransient } = require("./network-retry");
const GITHUB_APP_PUBLIC_URL = "https://github.com/apps/codex-env-sync";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const DEFAULT_REQUEST_TIMEOUT_MS = 25000;

function getClientId(clientId) {
  return String(clientId || DEFAULT_GITHUB_APP_CLIENT_ID).trim();
}

function parseJson(text) {
  return text ? JSON.parse(text) : {};
}

async function readJsonResponse(response, context = "request") {
  const data = parseJson(await response.text());
  if (!response.ok) {
    if (response.status === 404 && context === "device") {
      throw new Error("GitHub Device Flow returned 404. Check that this GitHub App Client ID is correct and Device Flow is enabled in the app settings.");
    }
    const error = new Error(data.error_description || data.message || `GitHub request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchWithTimeout(fetchFn, url, init = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("GitHub request timed out. Check the network connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toFormBody(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, value);
    }
  }
  return body;
}

async function requestDeviceCode(options = {}) {
  const url = new URL(GITHUB_DEVICE_CODE_URL);
  url.searchParams.set("client_id", getClientId(options.clientId));
  if (options.scope) {
    url.searchParams.set("scope", options.scope);
  }

  const response = await fetchWithTimeout(options.fetch || fetch, url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const data = await readJsonResponse(response, "device");

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    verificationUriComplete: data.verification_uri_complete || "",
    expiresIn: Number(data.expires_in || 900),
    interval: Number(data.interval || 5),
  };
}

async function exchangeDeviceCode(options = {}) {
  if (!options.deviceCode) {
    throw new Error("GitHub device code is required.");
  }

  const response = await fetchWithTimeout(options.fetch || fetch, GITHUB_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody({
      client_id: getClientId(options.clientId),
      device_code: options.deviceCode,
      grant_type: DEVICE_GRANT_TYPE,
    }),
  });
  const data = await readJsonResponse(response, "device");

  if (data.error) {
    return {
      error: data.error,
      errorDescription: data.error_description || data.error,
      interval: Number(data.interval || options.interval || 5),
    };
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope || "",
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDeviceAuthorization(options = {}) {
  const startedAt = Date.now();
  const expiresIn = Number(options.expiresIn || 900);
  let interval = Number(options.interval || 5);
  const waitFn = options.wait || wait;

  while ((Date.now() - startedAt) / 1000 < expiresIn) {
    if (options.shouldCancel && options.shouldCancel()) {
      throw new Error("GitHub authorization was cancelled.");
    }

    let result;
    try {
      result = await retryTransient(() => exchangeDeviceCode({ ...options, interval }));
    } catch (error) {
      if (/TypeError.*fetch failed/i.test(String(error.message || error))) {
        throw new Error(
          "Cannot reach GitHub to complete authorization. Check your network connection and try again. If the problem continues, retry later."
        );
      }
      throw error;
    }

    if (result.accessToken) {
      return result;
    }
    if (result.error === "authorization_pending") {
      await waitFn(interval * 1000);
      if (options.shouldCancel && options.shouldCancel()) {
        throw new Error("GitHub authorization was cancelled.");
      }
      continue;
    }
    if (result.error === "slow_down") {
      interval = Number(result.interval || interval + 5);
      await waitFn(interval * 1000);
      if (options.shouldCancel && options.shouldCancel()) {
        throw new Error("GitHub authorization was cancelled.");
      }
      continue;
    }
    if (result.error === "expired_token") {
      throw new Error("GitHub authorization code expired. Start connection again.");
    }
    if (result.error === "access_denied") {
      throw new Error("GitHub authorization was cancelled.");
    }
    if (result.error === "device_flow_disabled") {
      throw new Error("Device Flow is disabled for this GitHub App.");
    }
    throw new Error(result.errorDescription || "GitHub authorization failed.");
  }

  throw new Error("GitHub authorization timed out. Start connection again.");
}

function normalizeRepository(repo) {
  return {
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner && repo.owner.login,
    private: Boolean(repo.private),
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url || `https://github.com/${repo.full_name}.git`,
    permissions: repo.permissions || {},
  };
}

async function githubApi(options, apiPath, init = {}) {
  const token = options.githubToken || options.accessToken;
  if (!token) {
    throw new Error("GitHub token is required.");
  }

  const response = await fetchWithTimeout(options.fetch || fetch, `${GITHUB_API_URL}${apiPath}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
    body: init.body,
  });
  return readJsonResponse(response, "api");
}

async function fetchGitHubViewer(options = {}) {
  const data = await githubApi(options, "/user");
  const login = data.login || "";

  return {
    login,
    name: data.name || "",
    email: data.email || "",
    gitName: data.name || login,
    gitEmail: data.email || (login ? `${login}@users.noreply.github.com` : ""),
  };
}

async function fetchGitHubAppRepositories(options = {}) {
  const installations = await githubApi(options, "/user/installations?per_page=100");
  const repositories = [];

  for (const installation of installations.installations || []) {
    const page = await githubApi(options, `/user/installations/${installation.id}/repositories?per_page=100`);
    for (const repo of page.repositories || []) {
      repositories.push(normalizeRepository(repo));
    }
  }

  return repositories;
}

async function createPrivateSyncRepository(options = {}) {
  const name = options.name || DEFAULT_SYNC_REPOSITORY_NAME;
  const data = await githubApi(options, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name,
      private: true,
      auto_init: true,
      description: "Private Codex settings sync data for Codex Env Sync.",
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    }),
  });

  return normalizeRepository(data);
}

const DEFAULT_SYNC_REPOSITORY_NAME = "codex-env-sync-data";
const SOURCE_REPOSITORY_NAME = "codex-env-sync";

function isSourceRepository(repo) {
  return Boolean(repo && repo.fullName && repo.fullName.toLowerCase().endsWith(`/${SOURCE_REPOSITORY_NAME}`));
}

function selectPreferredRepository(repositories, preferredName = DEFAULT_SYNC_REPOSITORY_NAME) {
  const preferred = repositories.find((repo) => repo.fullName && repo.fullName.toLowerCase().endsWith(`/${preferredName.toLowerCase()}`));
  if (preferred) {
    return preferred;
  }

  return (
    repositories.find((repo) => !isSourceRepository(repo)) ||
    null
  );
}

module.exports = {
  DEFAULT_GITHUB_APP_CLIENT_ID,
  DEFAULT_SYNC_REPOSITORY_NAME,
  GITHUB_APP_PUBLIC_URL,
  SOURCE_REPOSITORY_NAME,
  createPrivateSyncRepository,
  exchangeDeviceCode,
  fetchGitHubAppRepositories,
  fetchGitHubViewer,
  isSourceRepository,
  requestDeviceCode,
  selectPreferredRepository,
  waitForDeviceAuthorization,
};

