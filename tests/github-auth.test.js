const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_GITHUB_APP_CLIENT_ID,
  createPrivateSyncRepository,
  exchangeDeviceCode,
  fetchGitHubAppRepositories,
  fetchGitHubViewer,
  requestDeviceCode,
  selectPreferredRepository,
  waitForDeviceAuthorization,
} = require("../src/core/github-auth");

function makeJsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("requestDeviceCode starts GitHub App device authorization", async () => {
  const calls = [];
  const result = await requestDeviceCode({
    clientId: "Iv1.exampleclient",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return makeJsonResponse({
        device_code: "device-code",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      });
    },
  });

  assert.equal(result.userCode, "ABCD-1234");
  assert.equal(result.verificationUri, "https://github.com/login/device");
  assert.equal(calls[0].url, "https://github.com/login/device/code?client_id=Iv1.exampleclient");
  assert.equal(calls[0].init.method, "POST");
});

test("requestDeviceCode uses bundled GitHub App client id by default", async () => {
  const result = await requestDeviceCode({
    fetch: async (url) => {
      assert.equal(url, `https://github.com/login/device/code?client_id=${DEFAULT_GITHUB_APP_CLIENT_ID}`);
      return makeJsonResponse({
        device_code: "device-code",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      });
    },
  });

  assert.equal(result.deviceCode, "device-code");
});

test("requestDeviceCode explains GitHub App device flow 404", async () => {
  await assert.rejects(
    requestDeviceCode({
      fetch: async () => makeJsonResponse({}, false, 404),
    }),
    /Device Flow returned 404/
  );
});

test("exchangeDeviceCode returns token when GitHub authorization succeeds", async () => {
  const result = await exchangeDeviceCode({
    clientId: "Iv1.exampleclient",
    deviceCode: "device-code",
    fetch: async () =>
      makeJsonResponse({
        access_token: "github-token",
        token_type: "bearer",
      }),
  });

  assert.equal(result.accessToken, "github-token");
  assert.equal(result.tokenType, "bearer");
});

test("waitForDeviceAuthorization handles pending responses before success", async () => {
  const responses = [
    { error: "authorization_pending" },
    { access_token: "github-token", token_type: "bearer" },
  ];
  let waitCount = 0;

  const result = await waitForDeviceAuthorization({
    clientId: "Iv1.exampleclient",
    deviceCode: "device-code",
    interval: 1,
    expiresIn: 60,
    wait: async () => {
      waitCount += 1;
    },
    fetch: async () => makeJsonResponse(responses.shift()),
  });

  assert.equal(result.accessToken, "github-token");
  assert.equal(waitCount, 1);
});

test("waitForDeviceAuthorization stops when authorization is cancelled", async () => {
  await assert.rejects(
    waitForDeviceAuthorization({
      clientId: "Iv1.exampleclient",
      deviceCode: "device-code",
      interval: 1,
      expiresIn: 60,
      shouldCancel: () => true,
      fetch: async () => makeJsonResponse({ error: "authorization_pending" }),
      wait: async () => {},
    }),
    /cancelled/
  );
});

test("fetchGitHubViewer returns safe profile defaults for the UI", async () => {
  const result = await fetchGitHubViewer({
    githubToken: "github-token",
    fetch: async (url, init) => {
      assert.equal(url, "https://api.github.com/user");
      assert.equal(init.headers.Authorization, "Bearer github-token");
      return makeJsonResponse({
        login: "octocat",
        name: "The Octocat",
        email: null,
      });
    },
  });

  assert.equal(result.login, "octocat");
  assert.equal(result.gitName, "The Octocat");
  assert.equal(result.gitEmail, "octocat@users.noreply.github.com");
});

test("fetchGitHubAppRepositories returns installed repositories", async () => {
  const urls = [];
  const result = await fetchGitHubAppRepositories({
    githubToken: "github-token",
    fetch: async (url) => {
      urls.push(url);
      if (url.endsWith("/user/installations?per_page=100")) {
        return makeJsonResponse({ installations: [{ id: 123 }] });
      }
      return makeJsonResponse({
        repositories: [
          {
            full_name: "octocat/codex-env-sync-data",
            name: "codex-env-sync-data",
            private: false,
            html_url: "https://github.com/octocat/codex-env-sync-data",
            clone_url: "https://github.com/octocat/codex-env-sync-data.git",
            owner: { login: "octocat" },
            permissions: { contents: "write" },
          },
        ],
      });
    },
  });

  assert.equal(urls.length, 2);
  assert.equal(result[0].fullName, "octocat/codex-env-sync-data");
  assert.equal(result[0].cloneUrl, "https://github.com/octocat/codex-env-sync-data.git");
});

test("createPrivateSyncRepository creates a private initialized repository", async () => {
  const calls = [];
  const result = await createPrivateSyncRepository({
    githubToken: "github-token",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return makeJsonResponse({
        full_name: "octocat/codex-env-sync-data",
        name: "codex-env-sync-data",
        private: true,
        html_url: "https://github.com/octocat/codex-env-sync-data",
        clone_url: "https://github.com/octocat/codex-env-sync-data.git",
        owner: { login: "octocat" },
        permissions: { admin: true, push: true, pull: true },
      });
    },
  });

  assert.equal(calls[0].url, "https://api.github.com/user/repos");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer github-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    name: "codex-env-sync-data",
    private: true,
    auto_init: true,
    description: "Private Codex settings sync data for Codex Env Sync.",
    has_issues: false,
    has_projects: false,
    has_wiki: false,
  });
  assert.equal(result.fullName, "octocat/codex-env-sync-data");
  assert.equal(result.private, true);
});

test("selectPreferredRepository picks codex-env-sync-data when available", () => {
  const result = selectPreferredRepository([
    { fullName: "octocat/codex-env-sync" },
    { fullName: "octocat/codex-env-sync-data" },
  ]);

  assert.equal(result.fullName, "octocat/codex-env-sync-data");
});

test("selectPreferredRepository refuses the source repository by itself", () => {
  const result = selectPreferredRepository([{ fullName: "octocat/codex-env-sync" }]);

  assert.equal(result, null);
});
