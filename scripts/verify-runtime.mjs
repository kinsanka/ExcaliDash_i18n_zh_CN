/**
 * Real HTTP + Socket.IO verification against an explicitly disposable instance.
 * Requires seeded owner/peer/import accounts, auth enabled, and normal CSRF.
 * RUNTIME_URL=http://nginx RUNTIME_PASSWORD=... RUNTIME_DISPOSABLE=1 node scripts/verify-runtime.mjs
 * RUNTIME_STATE=/tmp/runtime-state.json persists public fixture expectations.
 * After externally restarting the backend, rerun with --check-restart.
 * RUNTIME_MODULE_ROOT may point at a checkout with installed frontend deps.
 * RUNTIME_IMPORT_URL optionally selects a second disposable instance for
 * cross-deployment backup portability; the same fixture password is used.
 * RUNTIME_EXPORT_ARCHIVE optionally saves the portable backup for inspection.
 * --check-import imports RUNTIME_IMPORT_ARCHIVE into the import fixture account.
 * --check-static fetches built HTML/JS/CSS without executing browser code.
 * No browser, database mutation, container operation, or external service use.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checkout =
  process.env.RUNTIME_MODULE_ROOT ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFrontend = createRequire(
  path.join(checkout, "frontend/package.json"),
);
const { io } = requireFrontend("socket.io-client");
const JSZip = requireFrontend("jszip");
const origin = process.env.RUNTIME_URL?.replace(/\/$/, "");
assert(
  origin && process.env.RUNTIME_PASSWORD,
  "set RUNTIME_URL and RUNTIME_PASSWORD",
);
assert.equal(
  process.env.RUNTIME_DISPOSABLE,
  "1",
  "this harness mutates fixture drawings; explicitly select a disposable instance",
);
const statePath =
  process.env.RUNTIME_STATE || "/tmp/excalidash-runtime-state.json";
const timeout = Number(process.env.RUNTIME_TIMEOUT_MS || 15000);
const sockets = new Set();
const results = [];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
const alternate = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const shape = (id, version = 1, extra = {}) => ({
  id,
  type: "rectangle",
  x: 10,
  y: 10,
  width: 40,
  height: 40,
  angle: 0,
  strokeColor: "#000000",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1,
  version,
  versionNonce: version,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
  ...extra,
});
const image = (id, fileId, extra = {}) =>
  shape(id, 1, {
    type: "image",
    fileId,
    status: "saved",
    scale: [1, 1],
    ...extra,
  });
const inline = (id, bytes = png) => ({
  id,
  mimeType: "image/png",
  created: 1,
  dataURL: `data:image/png;base64,${bytes.toString("base64")}`,
});
const managed = (drawingId, fileId) => ({
  id: fileId,
  mimeType: "image/png",
  created: 1,
  dataURL: `/api/files/${drawingId}/${fileId}`,
});

class Client {
  constructor(email, instanceOrigin = origin) {
    this.email = email;
    this.origin = instanceOrigin.replace(/\/$/, "");
    this.cookies = new Map();
  }
  cookieHeader() {
    return [...this.cookies]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
  async request(
    route,
    {
      method = "GET",
      body,
      headers = {},
      status = 200,
      raw = false,
      redirect = "manual",
    } = {},
  ) {
    const requestHeaders = { Cookie: this.cookieHeader(), ...headers };
    if (this.csrf) requestHeaders[this.csrf.header] = this.csrf.token;
    if (
      body !== undefined &&
      !(body instanceof FormData) &&
      !Buffer.isBuffer(body)
    ) {
      requestHeaders["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const response = await fetch(`${this.origin}/api${route}`, {
      method,
      headers: requestHeaders,
      body,
      redirect,
      signal: AbortSignal.timeout(timeout),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [name, ...rest] = cookie.split(";")[0].split("=");
      this.cookies.set(name, rest.join("="));
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const statuses = Array.isArray(status) ? status : [status];
    assert(
      statuses.includes(response.status),
      `${method} ${route}: expected ${statuses}, got ${response.status}: ${bytes.toString().slice(0, 500)}`,
    );
    return raw
      ? { response, bytes }
      : bytes.length
        ? JSON.parse(bytes.toString())
        : null;
  }
  async login() {
    this.csrf = await this.request("/csrf-token");
    const login = await this.request("/auth/login", {
      method: "POST",
      body: { email: this.email, password: process.env.RUNTIME_PASSWORD },
    });
    this.user = login.user;
    assert(this.user?.id, "login must return an authenticated user");
    return this;
  }
  async connect(transport = "websocket") {
    const socket = io(this.origin, {
      transports: [transport],
      extraHeaders: { Cookie: this.cookieHeader() },
      reconnection: false,
      autoConnect: false,
      timeout,
    });
    sockets.add(socket);
    const ready = event(socket, "connect");
    socket.connect();
    await ready;
    return socket;
  }
}
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      socket.off(name, handler);
      socket.off("connect_error", fail);
    };
    const fail = (error) => {
      clean();
      reject(error);
    };
    const handler = (payload) => {
      if (predicate(payload)) {
        clean();
        resolve(payload);
      }
    };
    const timer = setTimeout(
      () => fail(new Error(`timed out waiting for ${name}`)),
      timeout,
    );
    socket.on(name, handler);
    socket.on("connect_error", fail);
  });
}
async function join(socket, drawingId, client) {
  const ack = await new Promise((resolve, reject) =>
    socket.timeout(timeout).emit(
      "join-room",
      {
        drawingId,
        user: { id: "spoofed-id", name: "spoofed-name", color: "#123456" },
      },
      (error, value) => (error ? reject(error) : resolve(value)),
    ),
  );
  assert.equal(ack.user.id, client.user.id);
  assert.equal(ack.user.name, client.user.name);
}
async function scenario(name, callback) {
  const started = Date.now();
  await callback();
  const result = { name, status: "passed", durationMs: Date.now() - started };
  results.push(result);
  console.log(JSON.stringify(result));
}
async function bytesFor(client, drawingId, fileId, expected = png) {
  const { response, bytes } = await client.request(
    `/files/${drawingId}/${fileId}`,
    { raw: true, status: [200, 302] },
  );
  let content = bytes;
  if (response.status === 302) {
    const location = response.headers.get("location");
    assert(
      location && new URL(location).searchParams.has("X-Amz-Signature"),
      "private S3 download must be signed",
    );
    const downloaded = await fetch(location, {
      signal: AbortSignal.timeout(timeout),
    });
    assert.equal(downloaded.status, 200);
    content = Buffer.from(await downloaded.arrayBuffer());
    const unsigned = new URL(location);
    unsigned.search = "";
    const denied = await fetch(unsigned, {
      signal: AbortSignal.timeout(timeout),
    });
    assert(
      [401, 403].includes(denied.status),
      `private object accessible without signature: ${denied.status}`,
    );
    await denied.arrayBuffer();
  } else {
    assert.equal(response.headers.get("etag"), `"${fileId}"`);
    await client.request(`/files/${drawingId}/${fileId}`, {
      headers: { "If-None-Match": `"${fileId}"` },
      status: 304,
    });
  }
  assert.equal(
    digest(content),
    digest(expected),
    `image bytes changed for ${drawingId}/${fileId}`,
  );
}
const create = (client, name, elements = [], files = {}) =>
  client.request("/drawings", {
    method: "POST",
    body: {
      name,
      elements,
      appState: { viewBackgroundColor: "#ffffff" },
      files,
    },
  });
const save = (client, drawing, elements, files = drawing.files) =>
  client.request(`/drawings/${drawing.id}`, {
    method: "PUT",
    body: {
      version: drawing.version,
      elements,
      appState: drawing.appState,
      files,
    },
  });
async function list(client, query = "") {
  const value = await client.request(`/drawings?limit=200${query}`);
  return Array.isArray(value) ? value : value.drawings;
}
function archiveForm(bytes) {
  const form = new FormData();
  form.append(
    "archive",
    new Blob([bytes], { type: "application/zip" }),
    "runtime.excalidash",
  );
  return form;
}

async function verifyPeerFirstUpload(owner, peer) {
  const drawing = await create(
    owner,
    `runtime-peer-upload-${randomUUID().slice(0, 8)}`,
  );
  try {
    await owner.request(`/drawings/${drawing.id}/permissions`, {
      method: "POST",
      body: { granteeUserId: peer.user.id, permission: "edit" },
    });
    await peer.request(`/drawings/${drawing.id}/files/peer-first`, {
      method: "PUT",
      body: png,
      headers: { "Content-Type": "image/png" },
    });
    await bytesFor(owner, drawing.id, "peer-first");
    const diff = await owner.request(`/drawings/${drawing.id}/files/diff`);
    const file = diff.files.find((item) => item.fileId === "peer-first");
    assert(file?.inS3Record, "peer upload must create a tracked file row");
    console.log(
      JSON.stringify({
        peerFirstUpload: {
          ownerId: owner.user.id,
          peerId: peer.user.id,
          drawingId: drawing.id,
          file,
        },
      }),
    );
    assert.equal(
      file.inS3,
      true,
      "owner storage UI must find a peer-uploaded image",
    );
    if ((await owner.request("/files/config")).s3Enabled)
      assert(
        file.s3Key.includes(`${owner.user.id}/${drawing.id}/`),
        "new peer upload must use drawing owner's S3 namespace",
      );
  } finally {
    await owner.request(`/drawings/${drawing.id}`, {
      method: "DELETE",
      body: {},
    });
  }
}

try {
  const owner = await new Client(
    process.env.RUNTIME_OWNER_EMAIL || "runtime.owner@example.test",
  ).login();
  const peer = await new Client(
    process.env.RUNTIME_PEER_EMAIL || "runtime.peer@example.test",
  ).login();
  if (process.argv.includes("--check-peer-upload")) {
    await scenario(
      "peer-first raw upload remains visible in owner storage namespace",
      () => verifyPeerFirstUpload(owner, peer),
    );
  } else if (process.argv.includes("--check-static")) {
    await scenario(
      "nginx serves built HTML, JavaScript, and CSS assets",
      async () => {
        const page = await fetch(origin, {
          signal: AbortSignal.timeout(timeout),
        });
        assert.equal(page.status, 200);
        const html = await page.text();
        assert(html.includes('id="root"'));
        const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
          (match) => match[1],
        );
        const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(
          (match) => match[1],
        );
        assert(
          scripts.length > 0 && styles.length > 0,
          "built entry JavaScript and CSS must be present",
        );
        for (const asset of [...scripts, ...styles]) {
          const url = new URL(asset, `${origin}/`);
          assert.equal(
            url.origin,
            origin,
            "entry assets must stay on the selected instance",
          );
          const response = await fetch(url, {
            signal: AbortSignal.timeout(timeout),
          });
          assert.equal(response.status, 200, `entry asset ${asset}`);
          const type = response.headers.get("content-type");
          assert(
            asset.endsWith(".css")
              ? type?.includes("text/css")
              : /javascript/.test(type || ""),
            `entry asset MIME type: ${asset}: ${type}`,
          );
          assert((await response.arrayBuffer()).byteLength > 0);
        }
      },
    );
  } else if (process.argv.includes("--check-import")) {
    await scenario(
      "portable full-account backup imports across database and image storage configurations",
      async () => {
        assert(
          process.env.RUNTIME_IMPORT_ARCHIVE,
          "set RUNTIME_IMPORT_ARCHIVE",
        );
        const archive = await readFile(process.env.RUNTIME_IMPORT_ARCHIVE);
        const zip = await JSZip.loadAsync(archive);
        const manifest = JSON.parse(
          await zip.file("excalidash.manifest.json").async("string"),
        );
        const importer = await new Client(
          process.env.RUNTIME_IMPORT_EMAIL || "runtime.import@example.test",
        ).login();
        const beforeIds = new Set(
          (await list(importer)).map((item) => item.id),
        );
        const imported = await importer.request("/import/excalidash", {
          method: "POST",
          body: archiveForm(archive),
        });
        assert.equal(
          imported.drawings.created + imported.drawings.updated,
          manifest.drawings.length,
        );
        const available = await list(importer);
        for (const metadata of manifest.drawings) {
          const source = JSON.parse(
            await zip.file(metadata.filePath).async("string"),
          );
          const matches = available.filter(
            (item) => item.name === metadata.name,
          );
          const target =
            matches.find((item) => item.id === metadata.id) ||
            matches.find((item) => !beforeIds.has(item.id));
          assert(target, `missing imported drawing ${metadata.name}`);
          const actual = await importer.request(`/drawings/${target.id}`);
          assert.deepEqual(actual.elements, source.elements);
          for (const [fileId, file] of Object.entries(source.files)) {
            assert(file.dataURL.startsWith("data:image/png;base64,"));
            await bytesFor(
              importer,
              actual.id,
              fileId,
              Buffer.from(file.dataURL.split(",")[1], "base64"),
            );
          }
        }
      },
    );
  } else if (process.argv.includes("--check-restart")) {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.origin, origin);
    if (state.ownerUserId)
      assert.equal(
        owner.user.id,
        state.ownerUserId,
        "nginx must route back to the same account database after backend restart",
      );
    await scenario(
      "backend restart preserves scenes, histories, image bytes, and reconnect",
      async () => {
        for (const expected of state.drawings) {
          const actual = await owner.request(`/drawings/${expected.id}`);
          assert.deepEqual(actual.elements, expected.elements);
          assert.deepEqual(actual.files, expected.files);
          if (expected.appState)
            assert.deepEqual(actual.appState, expected.appState);
          assert.equal(actual.version, expected.version);
          const history = await owner.request(
            `/drawings/${expected.id}/history`,
          );
          assert.equal(history.totalCount, expected.historyCount);
          for (const fileId of Object.keys(expected.files))
            await bytesFor(owner, expected.id, fileId);
        }
        const socket = await peer.connect();
        await join(socket, state.sharedDrawingId, peer);
        const actual = await peer.request(`/drawings/${state.sharedDrawingId}`);
        assert.deepEqual(
          actual.elements,
          state.drawings.find((item) => item.id === state.sharedDrawingId)
            .elements,
        );
      },
    );
  } else {
    const run = randomUUID().slice(0, 8);
    let drawing;
    let ownerSocket;
    let peerSocket;
    await scenario(
      "authenticated HTTP and websocket/polling clients through nginx",
      async () => {
        drawing = await create(owner, `runtime-${run}-collaboration`, [
          shape("base"),
        ]);
        await owner.request(`/drawings/${drawing.id}/permissions`, {
          method: "POST",
          body: { granteeUserId: peer.user.id, permission: "edit" },
        });
        const anonymous = new Client("anonymous");
        await anonymous.request(`/drawings/${drawing.id}`, {
          status: [401, 404],
        });
        ownerSocket = await owner.connect("websocket");
        peerSocket = await peer.connect("polling");
        await join(ownerSocket, drawing.id, owner);
        await join(peerSocket, drawing.id, peer);
      },
    );
    await scenario(
      "simultaneous guarded saves reject stale writes and rebase preserves both edits",
      async () => {
        for (let round = 0; round < 5; round++) {
          const initial = await owner.request(`/drawings/${drawing.id}`);
          const edits = [shape(`owner-${round}`), shape(`peer-${round}`)];
          const waitOwner = event(
            ownerSocket,
            "element-update",
            (payload) => payload.persisted && payload.drawingId === drawing.id,
          );
          const waitPeer = event(
            peerSocket,
            "element-update",
            (payload) => payload.persisted && payload.drawingId === drawing.id,
          );
          const outcomes = await Promise.all(
            [owner, peer].map((client, index) =>
              client.request(`/drawings/${drawing.id}`, {
                method: "PUT",
                status: [200, 409],
                body: {
                  version: initial.version,
                  elements: [...initial.elements, edits[index]],
                  appState: initial.appState,
                  files: {},
                },
              }),
            ),
          );
          const winners = outcomes.filter((value) => value.id);
          const conflicts = outcomes.filter(
            (value) => value.code === "VERSION_CONFLICT",
          );
          assert.equal(winners.length, 1);
          assert.equal(conflicts.length, 1);
          const winner = winners[0];
          assert.equal(winner.version, initial.version + 1);
          const echoes = await Promise.all([waitOwner, waitPeer]);
          for (const echo of echoes) {
            assert.deepEqual(echo.elements, winner.elements);
            assert.deepEqual(
              echo.elementOrder,
              winner.elements.map((element) => element.id),
            );
          }
          const missing = edits.find(
            (edit) =>
              !winner.elements.some((element) => element.id === edit.id),
          );
          drawing = await save(owner, winner, [...winner.elements, missing]);
          for (const edit of edits)
            assert(drawing.elements.some((element) => element.id === edit.id));
        }
        assert.equal(drawing.elements.length, 11);
      },
    );
    await scenario(
      "delayed realtime updates relay while committed scenes remain authoritative",
      async () => {
        for (const version of [3, 1, 2]) {
          const received = event(
            peerSocket,
            "element-update",
            (payload) => payload.runtimeMarker === `${run}-${version}`,
          );
          ownerSocket.emit("element-update", {
            drawingId: drawing.id,
            elements: [shape("delayed-peer-element", version)],
            files: {},
            runtimeMarker: `${run}-${version}`,
          });
          assert.equal((await received).elements[0].version, version);
        }
        const actual = await owner.request(`/drawings/${drawing.id}`);
        assert.deepEqual(actual.elements, drawing.elements);
        assert.equal(actual.version, drawing.version);
      },
    );
    await scenario(
      "joining after realtime delta receives persisted echo and reconnect reloads saved scene",
      async () => {
        peerSocket.disconnect();
        ownerSocket.emit("element-update", {
          drawingId: drawing.id,
          elements: [shape("late-join")],
          files: {},
        });
        peerSocket = await peer.connect();
        await join(peerSocket, drawing.id, peer);
        const committed = event(
          peerSocket,
          "element-update",
          (payload) =>
            payload.persisted &&
            payload.elements.some((element) => element.id === "late-join"),
        );
        drawing = await save(owner, drawing, [
          ...drawing.elements,
          shape("late-join"),
        ]);
        assert.deepEqual((await committed).elements, drawing.elements);
        peerSocket.disconnect();
        peerSocket = await peer.connect();
        await join(peerSocket, drawing.id, peer);
        const recovered = await peer.request(`/drawings/${drawing.id}`);
        assert.deepEqual(recovered.elements, drawing.elements);
      },
    );
    await scenario(
      "peer-first raw upload remains visible in owner storage namespace",
      () => verifyPeerFirstUpload(owner, peer),
    );
    let assets;
    await scenario(
      "raw/inline uploads preserve first writer and private download bytes",
      async () => {
        assets = await create(owner, `runtime-${run}-assets`);
        await owner.request(`/drawings/${assets.id}/permissions`, {
          method: "POST",
          body: { granteeUserId: peer.user.id, permission: "edit" },
        });
        const upload = (client, id, bytes) =>
          client.request(`/drawings/${assets.id}/files/${id}`, {
            method: "PUT",
            body: bytes,
            headers: { "Content-Type": "image/png" },
          });
        await upload(owner, "raw-first", png);
        await Promise.all([
          upload(owner, "raw-first", alternate),
          upload(peer, "raw-first", alternate),
        ]);
        assets = await save(
          owner,
          assets,
          [
            image("raw-image", "raw-first"),
            image("inline-image", "inline-first"),
          ],
          {
            "raw-first": inline("raw-first", alternate),
            "inline-first": inline("inline-first"),
          },
        );
        await upload(peer, "inline-first", alternate);
        assets = await save(owner, assets, assets.elements, {
          "inline-first": inline("inline-first", alternate),
        });
        assert.equal(
          Object.keys(assets.files).length,
          2,
          "partial client files must union merge",
        );
        for (const id of ["raw-first", "inline-first"])
          await bytesFor(owner, assets.id, id);
        const anonymous = new Client("anonymous");
        await anonymous.request(`/files/${assets.id}/raw-first`, {
          status: 404,
        });
        // A novel file id is raced too: either writer may win, but later retry
        // cannot switch the stored generation or delete the winner's object.
        // Separate owner sessions keep both generations inside the owner
        // prefix so files/diff can count all objects from the race.
        const secondOwner = await new Client(owner.email).login();
        await Promise.all([
          upload(owner, "raced", png),
          upload(secondOwner, "raced", alternate),
        ]);
        const raced = await owner.request(`/files/${assets.id}/raced`, {
          raw: true,
          status: [200, 302],
        });
        const raceBytes =
          raced.response.status === 302
            ? Buffer.from(
                await (
                  await fetch(raced.response.headers.get("location"))
                ).arrayBuffer(),
              )
            : raced.bytes;
        assert([digest(png), digest(alternate)].includes(digest(raceBytes)));
        await upload(
          owner,
          "raced",
          digest(raceBytes) === digest(png) ? alternate : png,
        );
        await bytesFor(owner, assets.id, "raced", raceBytes);
        const diff = await owner.request(`/drawings/${assets.id}/files/diff`);
        assert.equal(
          diff.summary.totalS3Files,
          3,
          "losing concurrent upload must not leave a second S3 generation",
        );
      },
    );
    await scenario(
      "simultaneous image saves preserve committed files through conflict cleanup and rebase",
      async () => {
        const initial = assets;
        const ids = ["owner-image-race", "peer-image-race"];
        const outcomes = await Promise.all(
          [owner, peer].map((client, index) =>
            client.request(`/drawings/${assets.id}`, {
              method: "PUT",
              status: [200, 409],
              body: {
                version: initial.version,
                elements: [...initial.elements, image(ids[index], ids[index])],
                appState: initial.appState,
                files: { [ids[index]]: inline(ids[index]) },
              },
            }),
          ),
        );
        const winner = outcomes.find((value) => value.id);
        assert(winner);
        assert.equal(outcomes.filter((value) => value.id).length, 1);
        assert.equal(
          outcomes.filter((value) => value.code === "VERSION_CONFLICT").length,
          1,
        );
        const winningId = ids.find((id) => winner.files[id]);
        const missingId = ids.find((id) => !winner.files[id]);
        await bytesFor(owner, assets.id, winningId);
        assets = await save(
          owner,
          winner,
          [...winner.elements, image(missingId, missingId)],
          { [missingId]: inline(missingId) },
        );
        assert.equal(Object.keys(assets.files).length, 4);
        for (const id of Object.keys(assets.files))
          await bytesFor(owner, assets.id, id);
        assets = await save(owner, assets, assets.elements, {
          "raw-first": { ...assets.files["raw-first"], dataURL: "" },
        });
        assert.equal(
          assets.files["raw-first"].dataURL,
          managed(assets.id, "raw-first").dataURL,
        );
        await bytesFor(owner, assets.id, "raw-first");
      },
    );
    await scenario(
      "trim and orphan deletion retain history-only images; restore is reversible",
      async () => {
        const before = assets;
        assets = await save(
          owner,
          assets,
          assets.elements.map((element) => ({ ...element, isDeleted: true })),
          assets.files,
        );
        const history = await owner.request(`/drawings/${assets.id}/history`);
        const snapshot = history.snapshots.find(
          (item) => item.version === before.version,
        );
        assert(snapshot);
        await owner.request(`/drawings/${assets.id}/trim`, {
          method: "POST",
          body: { confirmName: assets.name },
        });
        await owner.request(`/drawings/${assets.id}/files/orphans`, {
          method: "DELETE",
          body: {
            confirmName: assets.name,
            fileIds: ["raw-first", "inline-first", "raced"],
          },
        });
        for (const id of ["raw-first", "inline-first"])
          await bytesFor(owner, assets.id, id);
        await owner.request(`/files/${assets.id}/raced`, { status: 404 });
        assets = await owner.request(
          `/drawings/${assets.id}/history/${snapshot.id}/restore`,
          { method: "POST", body: {} },
        );
        assert.deepEqual(assets.elements, before.elements);
        assert.deepEqual(assets.files, before.files);
        for (const id of Object.keys(assets.files))
          await bytesFor(owner, assets.id, id);
        await owner.request(`/drawings/${assets.id}/files/orphans`, {
          method: "DELETE",
          status: 400,
          body: { confirmName: assets.name, fileIds: ["raw-first"] },
        });
        const after = await owner.request(`/drawings/${assets.id}`);
        assert.equal(after.version, assets.version);
      },
    );
    await scenario(
      "malformed seeded history restore leaves scene, version, and history unchanged",
      async () => {
        const corrupt = (
          await list(owner, "&search=runtime-corrupt-history")
        ).find((item) => item.name === "runtime-corrupt-history");
        assert(
          corrupt,
          "seed a drawing named runtime-corrupt-history with malformed history",
        );
        const before = await owner.request(`/drawings/${corrupt.id}`);
        const history = await owner.request(`/drawings/${corrupt.id}/history`);
        // Own-account imports add valid reversible snapshots on later runs.
        // The disposable seed reserves versions 1 and 2 for corrupt fixtures.
        const malformedSnapshots = history.snapshots.filter(
          (snapshot) =>
            snapshot.version <=
            Number(process.env.RUNTIME_CORRUPT_MAX_VERSION || 2),
        );
        assert(malformedSnapshots.length > 0);
        for (const snapshot of malformedSnapshots) {
          await owner.request(
            `/drawings/${corrupt.id}/history/${snapshot.id}/restore`,
            { method: "POST", status: [400, 500], body: {} },
          );
          const after = await owner.request(`/drawings/${corrupt.id}`);
          assert.deepEqual(after.elements, before.elements);
          assert.equal(after.version, before.version);
          assert.equal(
            (await owner.request(`/drawings/${corrupt.id}/history`)).totalCount,
            history.totalCount,
          );
        }
      },
    );
    let duplicate;
    await scenario(
      "full account backup is portable and same-id overwrite preserves preimport history",
      async () => {
        const exported = (
          await owner.request("/export/excalidash", { raw: true })
        ).bytes;
        if (process.env.RUNTIME_EXPORT_ARCHIVE)
          await writeFile(process.env.RUNTIME_EXPORT_ARCHIVE, exported, {
            mode: 0o600,
          });
        const zip = await JSZip.loadAsync(exported);
        const manifest = JSON.parse(
          await zip.file("excalidash.manifest.json").async("string"),
        );
        assert.equal(manifest.drawings.length, (await list(owner)).length);
        const assetMeta = manifest.drawings.find(
          (item) => item.id === assets.id,
        );
        assert(assetMeta);
        const archiveAssets = JSON.parse(
          await zip.file(assetMeta.filePath).async("string"),
        );
        for (const file of Object.values(archiveAssets.files))
          assert(file.dataURL.startsWith("data:image/png;base64,"));
        const importer = await new Client(
          process.env.RUNTIME_IMPORT_EMAIL || "runtime.import@example.test",
          process.env.RUNTIME_IMPORT_URL || origin,
        ).login();
        const imported = await importer.request("/import/excalidash", {
          method: "POST",
          body: archiveForm(exported),
        });
        assert.equal(imported.drawings.created, manifest.drawings.length);
        const importedAssets = (await list(importer)).find(
          (item) => item.name === assets.name,
        );
        assert(importedAssets);
        if (importer.origin === origin)
          assert.notEqual(
            importedAssets.id,
            assets.id,
            "foreign owner id collision must allocate a new drawing",
          );
        const restoredImported = await importer.request(
          `/drawings/${importedAssets.id}`,
        );
        assert.deepEqual(restoredImported.elements, archiveAssets.elements);
        for (const fileId of Object.keys(assets.files))
          await bytesFor(importer, importedAssets.id, fileId);
        const mutated = await save(owner, assets, [
          ...assets.elements,
          shape("before-reimport"),
        ]);
        const reimported = await owner.request("/import/excalidash", {
          method: "POST",
          body: archiveForm(exported),
        });
        assert.equal(reimported.drawings.updated, manifest.drawings.length);
        assets = await owner.request(`/drawings/${assets.id}`);
        assert.deepEqual(assets.elements, archiveAssets.elements);
        assert.equal(assets.version, mutated.version + 1);
        const snapshots = (
          await owner.request(`/drawings/${assets.id}/history`)
        ).snapshots;
        const backup = snapshots.find(
          (item) => item.version === mutated.version,
        );
        assert(backup);
        const fullBackup = await owner.request(
          `/drawings/${assets.id}/history/${backup.id}`,
        );
        assert.deepEqual(fullBackup.elements, mutated.elements);
        // Import validates every drawing before mutating any drawing.
        archiveAssets.elements = {};
        zip.file(assetMeta.filePath, JSON.stringify(archiveAssets));
        const malformed = await zip.generateAsync({ type: "nodebuffer" });
        const sceneBefore = await owner.request(`/drawings/${assets.id}`);
        const countBefore = (
          await owner.request(`/drawings/${assets.id}/history`)
        ).totalCount;
        await owner.request("/import/excalidash", {
          method: "POST",
          status: 400,
          body: archiveForm(malformed),
        });
        const sceneAfter = await owner.request(`/drawings/${assets.id}`);
        assert.deepEqual(sceneAfter.elements, sceneBefore.elements);
        assert.equal(sceneAfter.version, sceneBefore.version);
        assert.equal(
          (await owner.request(`/drawings/${assets.id}/history`)).totalCount,
          countBefore,
        );
        drawing = await owner.request(`/drawings/${drawing.id}`);
      },
    );
    await scenario(
      "duplicate retains independent image bytes after source deletion",
      async () => {
        duplicate = await owner.request(`/drawings/${assets.id}/duplicate`, {
          method: "POST",
          body: {},
        });
        for (const fileId of Object.keys(assets.files)) {
          assert.equal(
            duplicate.files[fileId].dataURL,
            managed(duplicate.id, fileId).dataURL,
          );
          await bytesFor(owner, duplicate.id, fileId);
        }
        await owner.request(`/drawings/${assets.id}`, {
          method: "DELETE",
          body: {},
        });
        await owner.request(`/drawings/${assets.id}`, { status: 404 });
        for (const fileId of Object.keys(duplicate.files))
          await bytesFor(owner, duplicate.id, fileId);
      },
    );
    const expectations = [];
    for (const fixture of [drawing, duplicate]) {
      const actual = await owner.request(`/drawings/${fixture.id}`);
      expectations.push({
        id: actual.id,
        elements: actual.elements,
        appState: actual.appState,
        files: actual.files,
        version: actual.version,
        historyCount: (await owner.request(`/drawings/${fixture.id}/history`))
          .totalCount,
      });
    }
    await writeFile(
      statePath,
      JSON.stringify(
        {
          origin,
          ownerUserId: owner.user.id,
          sharedDrawingId: drawing.id,
          drawings: expectations,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({ restartState: statePath, scenarios: results.length }),
    );
  }
  const report = { status: "passed", origin, results };
  const stage = process.argv.includes("--check-restart")
    ? "restart"
    : process.argv.includes("--check-import")
      ? "import"
      : process.argv.includes("--check-static")
        ? "static"
        : "baseline";
  await writeFile(
    process.env.RUNTIME_REPORT || `${statePath}.${stage}.report.json`,
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(
    JSON.stringify({
      status: "failed",
      origin,
      completed: results,
      message: error.message,
      stack: error.stack,
    }),
  );
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
}
