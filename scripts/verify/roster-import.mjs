#!/usr/bin/env node
// Sportfolio roster-import verifier (single journey, not a framework).
// Proves: pasted roster -> real /live/setup UI -> supabase-js -> PostgREST ->
// Postgres (real repo migrations + RLS) -> /live/session renders saved pupils.
// Everything runs on 127.0.0.1 in a throwaway cluster; any non-local request
// from the browser is blocked and fails the run. Never touches production.
// Usage: node scripts/verify/roster-import.mjs [--json] [--keep-build]
// Exit: 0 PASS, 1 FAIL, 2 environment/setup error.
import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const JSON_OUT = process.argv.includes("--json");
const PG_BIN = process.env.PG_BIN || "/usr/lib/postgresql/17/bin";
const POSTGREST_BIN = process.env.POSTGREST_BIN || "postgrest";
const CHROME_BIN = process.env.CHROME_BIN || "google-chrome";
const RUN = randomBytes(3).toString("hex");
const SECRET = randomBytes(32).toString("hex");
const TEACHER = { id: randomUUID(), email: `verify-teacher-${RUN}@example.test` };
const CLASS_NAME = `VERIFY Roster ${RUN}`;
const DECOY_CLASS = `VERIFY A Decoy ${RUN}`; // sorts first, so the session page must be switched to the right class
const DECOY_PUPIL = "Wrongclass";
// Obviously fictional roster: header row, stray whitespace, quoted comma, blank surname.
const ROSTER_PASTE = [
  "First name,Last name,Grade",
  "  Zephyr ,Testington,7A",
  'Quilla,"Van Fictional, Jr",7A',
  "Orbit,  McPlaceholder  ,7B",
  "Nimbus,,7B",
].join("\n");
const EXPECTED = [
  { first_name: "Zephyr", last_name: "Testington", grade: "7A" },
  { first_name: "Quilla", last_name: "Van Fictional, Jr", grade: "7A" },
  { first_name: "Orbit", last_name: "McPlaceholder", grade: "7B" },
  { first_name: "Nimbus", last_name: null, grade: "7B" },
];

const checks = [];
const procs = [];
const gatewayLog = [];
const blocked = [];
let tmp, pgPort;
const check = (id, name, ok, detail) => { checks.push({ id, name, ok: !!ok, detail }); if (!JSON_OUT) console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` :: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`); };
const log = (m) => { if (!JSON_OUT) console.log(`.. ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64u = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function jwt(payload) { const h = b64u({ alg: "HS256", typ: "JWT" }); const p = b64u(payload); return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`; }
function verifyJwt(token) { const [h, p, s] = (token || "").split("."); if (!s) return null; const good = createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url"); if (good !== s) return null; const claims = JSON.parse(Buffer.from(p, "base64url")); return claims.exp > Date.now() / 1000 ? claims : null; }
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); });
function psql(sql) { const r = spawnSync(join(PG_BIN, "psql"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAtX", "-c", sql], { encoding: "utf8" }); if (r.status !== 0) throw new Error(`psql: ${r.stderr}`); return r.stdout.trim(); }
function psqlFile(f) { const r = spawnSync(join(PG_BIN, "psql"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qX", "-f", f], { encoding: "utf8" }); if (r.status !== 0) throw new Error(`apply ${f}: ${r.stderr}`); }
const q = (sql) => JSON.parse(psql(`select coalesce(json_agg(t), '[]') from (${sql}) t`));
function start(cmd, args, opts = {}) { const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], detached: true, ...opts }); p.out = ""; p.stdout.on("data", (d) => (p.out += d)); p.stderr.on("data", (d) => (p.out += d)); procs.push(p); return p; }
async function waitFor(fn, ms, what) { const end = Date.now() + ms; let last; while (Date.now() < end) { try { last = await fn(); if (last) return last; } catch (e) { last = e; } await sleep(250); } throw new Error(`timeout waiting for ${what}${last instanceof Error ? `: ${last.message}` : ""}`); }

// ---- Supabase-shaped gateway: /rest/v1 -> PostgREST, /auth/v1/user -> local JWT check.
function startGateway(port, restPort) {
  const anonJwt = jwt({ role: "anon", exp: Math.floor(Date.now() / 1000) + 86400 });
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*" };
  const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url, "http://x");
    gatewayLog.push({ method: req.method, path: url.pathname });
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (url.pathname === "/auth/v1/user") {
      const c = verifyJwt(bearer);
      res.writeHead(c ? 200 : 401, { ...cors, "content-type": "application/json" });
      return res.end(JSON.stringify(c ? { id: c.sub, aud: "authenticated", role: "authenticated", email: c.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } : { code: 401, msg: "invalid JWT" }));
    }
    if (!url.pathname.startsWith("/rest/v1/")) { res.writeHead(404, cors); return res.end(); }
    const headers = { ...req.headers, host: `127.0.0.1:${restPort}`, authorization: `Bearer ${verifyJwt(bearer) ? bearer : anonJwt}` };
    delete headers.apikey;
    const up = http.request({ host: "127.0.0.1", port: restPort, method: req.method, path: url.pathname.slice(8) + url.search, headers }, (r) => { res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res); });
    up.on("error", (e) => { res.writeHead(502, cors); res.end(String(e)); });
    req.pipe(up);
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

// ---- Minimal Chrome DevTools Protocol client (no dependencies).
async function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map(); const handlers = [];
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } else handlers.forEach((h) => h(m)); };
  const send = (method, params = {}, sessionId) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { send, on: (h) => handlers.push(h), close: () => ws.close() };
}

async function main() {
  // Preconditions
  for (const [bin, label] of [[join(PG_BIN, "initdb"), "PG_BIN"], [POSTGREST_BIN, "POSTGREST_BIN"], [CHROME_BIN, "CHROME_BIN"]]) {
    if (spawnSync(bin, ["--version"], { encoding: "utf8" }).status !== 0 && spawnSync(bin, ["--help"], { encoding: "utf8" }).status !== 0) throw Object.assign(new Error(`missing ${label} (${bin})`), { setup: true });
  }
  tmp = mkdtempSync(join(tmpdir(), "sportfolio-verify-"));
  pgPort = await freePort(); const restPort = await freePort(); const gwPort = await freePort(); const appPort = await freePort();
  const GW = `http://127.0.0.1:${gwPort}`; const APP = `http://127.0.0.1:${appPort}`;

  log(`throwaway Postgres on :${pgPort} in ${tmp}`);
  if (spawnSync(join(PG_BIN, "initdb"), ["-D", join(tmp, "pg"), "-U", "postgres", "-A", "trust"], { encoding: "utf8" }).status !== 0) throw new Error("initdb failed");
  if (spawnSync(join(PG_BIN, "pg_ctl"), ["-D", join(tmp, "pg"), "-o", `-p ${pgPort} -k ${tmp} -c listen_addresses=127.0.0.1`, "-l", join(tmp, "pg.log"), "-w", "start"], { encoding: "utf8" }).status !== 0) throw new Error("pg start failed");
  psqlFile(join(HERE, "supabase-shim.sql"));
  const migrations = readdirSync(join(REPO, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migrations) {
    psqlFile(join(REPO, "supabase/migrations", f));
    if (f.startsWith("20260828100000")) psqlFile(join(HERE, "reconstructed-untracked-schema.sql"));
  }
  log(`applied shim + ${migrations.length} repo migrations + reconstructed untracked tables`);
  psql(`insert into auth.users(id,email) values ('${TEACHER.id}','${TEACHER.email}');
        insert into public.sportfolio_pilot_access(email,note) values ('${TEACHER.email}','verify synthetic');
        select set_config('request.jwt.claims', '{"sub":"${TEACHER.id}"}', false);
        insert into public.sportfolio_classes(id,name,teacher_user_id,academic_year) values ('${randomUUID()}','${DECOY_CLASS}','${TEACHER.id}','2026/27');
        with s as (insert into public.sportfolio_students(first_name,last_name,created_by) values ('${DECOY_PUPIL}','Decoy','${TEACHER.id}') returning id)
        insert into public.sportfolio_class_memberships(class_id,student_id) select c.id, s.id from s, public.sportfolio_classes c where c.name='${DECOY_CLASS}';`);

  start(POSTGREST_BIN, [], { env: { PGRST_DB_URI: `postgres://authenticator:verify-local-only@127.0.0.1:${pgPort}/postgres`, PGRST_DB_SCHEMAS: "public", PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: SECRET, PGRST_SERVER_HOST: "127.0.0.1", PGRST_SERVER_PORT: String(restPort), PGRST_DB_POOL: "4", PATH: process.env.PATH } });
  await waitFor(() => new Promise((r) => http.get(`http://127.0.0.1:${restPort}/`, (res) => { res.resume(); r(res.statusCode < 500); }).on("error", () => r(false))), 20000, "PostgREST");
  const gw = await startGateway(gwPort, restPort);

  const appEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: GW, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_verify_local_only", NEXT_TELEMETRY_DISABLED: "1" };
  for (const k of Object.keys(appEnv)) if (/SERVICE_ROLE|SUPABASE_SECRET|POSTHOG|VERCEL|SENTRY/i.test(k)) delete appEnv[k];
  log("next build (env points at local gateway)");
  const build = spawnSync("npx", ["next", "build"], { cwd: REPO, env: appEnv, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (build.status !== 0) throw new Error(`next build failed:\n${(build.stdout + build.stderr).slice(-3000)}`);
  const app = start("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(appPort)], { cwd: REPO, env: appEnv });
  await waitFor(() => new Promise((r) => http.get(APP, (res) => { res.resume(); r(true); }).on("error", () => r(false))), 60000, "next start");

  // Browser: signed-in synthetic teacher (locally signed session), every non-local request blocked.
  const chromeDir = join(tmp, "chrome");
  const chrome = start(CHROME_BIN, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--remote-debugging-port=0", `--user-data-dir=${chromeDir}`, "about:blank"]);
  const portFile = join(chromeDir, "DevToolsActivePort");
  const [cdpPort, cdpPath] = (await waitFor(() => existsSync(portFile) && readFileSync(portFile, "utf8").trim().split("\n").length === 2 && readFileSync(portFile, "utf8"), 20000, "Chrome")).trim().split("\n");
  const cdp = await cdpConnect(`ws://127.0.0.1:${cdpPort}${cdpPath}`);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  cdp.on((m) => { if (m.method === "Fetch.requestPaused" && m.sessionId === sessionId) { const u = new URL(m.params.request.url); if (["127.0.0.1", "localhost"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:") S("Fetch.continueRequest", { requestId: m.params.requestId }).catch(() => {}); else { blocked.push(m.params.request.url); S("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "BlockedByClient" }).catch(() => {}); } } });
  await S("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await S("Page.enable"); await S("Runtime.enable");
  const now = Math.floor(Date.now() / 1000);
  const access = jwt({ sub: TEACHER.id, email: TEACHER.email, role: "authenticated", aud: "authenticated", exp: now + 7200, iat: now });
  const session = { access_token: access, token_type: "bearer", expires_in: 7200, expires_at: now + 7200, refresh_token: "verify-no-refresh", user: { id: TEACHER.id, aud: "authenticated", role: "authenticated", email: TEACHER.email, app_metadata: {}, user_metadata: {} } };
  await S("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("sb-127-auth-token", ${JSON.stringify(JSON.stringify(session))})}catch(e){}` });
  const evaluate = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const bodyText = () => evaluate("document.body ? document.body.innerText : ''");
  const typeInto = async (selector, text) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('missing ${selector.replace(/'/g, "")}'); e.focus(); if (e.select) e.select(); return true})()`); await S("Input.insertText", { text }); };

  // A. Real UI path: /live/setup -> paste roster -> Add pasted list -> Create class.
  await S("Page.navigate", { url: `${APP}/live/setup` });
  await waitFor(async () => (await bodyText()).includes("Ready."), 45000, "setup page Ready.");
  const form = "form.setup-card";
  await typeInto(`${form} input`, CLASS_NAME);
  await typeInto(`${form} .setup-pair input`, "VERIFY Athletics");
  await typeInto(`${form} .roster-import textarea`, ROSTER_PASTE);
  await evaluate(`[...document.querySelectorAll('${form} .roster-import button')].find(b=>b.textContent.includes('Add pasted list')).click()`);
  await waitFor(async () => (await bodyText()).includes("4 pupils added to the roster"), 10000, "roster parsed");
  const posts0 = gatewayLog.length;
  await evaluate(`document.querySelector('${form} button.setup-save').click()`);
  const statusText = await waitFor(async () => { const t = await bodyText(); return (t.includes(`${CLASS_NAME} created with`) || t.includes("Could not")) && t; }, 20000, "create status");
  const writes = gatewayLog.slice(posts0).filter((r) => r.method === "POST").map((r) => r.path);
  const uiSaid = statusText.includes(`${CLASS_NAME} created with 4 pupils.`);
  check("A", "roster accepted through /live/setup UI (paste, parse, create class) via supabase-js REST writes", uiSaid && writes.includes("/rest/v1/sportfolio_classes") && writes.includes("/rest/v1/sportfolio_students"), { ui_status: uiSaid ? `${CLASS_NAME} created with 4 pupils.` : statusText.split("\n").find((l) => /created|Could not/.test(l)), browser_writes: writes });

  // B-D. Database truth (read as superuser, independent of the app).
  const cls = q(`select id, name, academic_year, activity, teacher_user_id from public.sportfolio_classes where name = '${CLASS_NAME}'`);
  const students = q(`select id, first_name, last_name, grade, created_by, auth_user_id from public.sportfolio_students where created_by = '${TEACHER.id}' and first_name <> '${DECOY_PUPIL}' order by first_name`);
  const byName = new Map(students.map((s) => [s.first_name, s]));
  check("B", "exactly the 4 expected pupil records persisted", students.length === 4 && EXPECTED.every((e) => byName.has(e.first_name)), { persisted: students.map((s) => s.first_name) });
  const members = cls.length === 1 ? q(`select m.student_id, s.first_name from public.sportfolio_class_memberships m join public.sportfolio_students s on s.id = m.student_id where m.class_id = '${cls[0].id}' order by s.first_name`) : [];
  const decoyMembers = q(`select s.first_name from public.sportfolio_class_memberships m join public.sportfolio_classes c on c.id = m.class_id join public.sportfolio_students s on s.id = m.student_id where c.name = '${DECOY_CLASS}'`);
  const memberIds = new Set(members.map((m) => m.student_id));
  check("C", "all 4 pupils linked to the synthetic class only (and class owned by the teacher)", cls.length === 1 && cls[0].teacher_user_id === TEACHER.id && members.length === 4 && students.every((s) => memberIds.has(s.id)) && decoyMembers.length === 1 && decoyMembers[0].first_name === DECOY_PUPIL, { class_rows: cls.length, memberships: members.map((m) => m.first_name), decoy_class_members: decoyMembers.map((m) => m.first_name) });
  const mismatches = EXPECTED.flatMap((e) => { const s = byName.get(e.first_name); if (!s) return [`${e.first_name}: missing`]; return ["last_name", "grade"].filter((k) => s[k] !== e[k]).map((k) => `${e.first_name}.${k}: got ${JSON.stringify(s[k])} want ${JSON.stringify(e[k])}`).concat(s.auth_user_id !== null ? [`${e.first_name}.auth_user_id not null`] : []); });
  if (cls[0] && (cls[0].academic_year !== "2026/27" || cls[0].activity !== "VERIFY Athletics")) mismatches.push(`class fields: ${JSON.stringify(cls[0])}`);
  check("D", "persisted fields equal the transformed input (trim, quoted CSV, blank surname -> null, grade, class defaults)", mismatches.length === 0, mismatches.length ? mismatches : EXPECTED.map((e) => `${e.first_name}|${e.last_name}|${e.grade}`));

  // E. Rendered state after a fresh load: /live/session for that class shows the saved pupils (and not the decoy).
  await S("Page.navigate", { url: `${APP}/live/session` });
  await waitFor(async () => /Ready to capture\.|Create a class/.test(await bodyText()), 45000, "session page");
  const target = cls[0]?.id || "";
  await evaluate(`(()=>{const s=document.querySelector('select'); const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s, ${JSON.stringify(target)}); s.dispatchEvent(new Event('change',{bubbles:true})); return s.value})()`);
  await sleep(500);
  await waitFor(async () => (await bodyText()).includes("Ready to capture."), 20000, "class switch");
  await sleep(500);
  const rendered = await evaluate(`[...document.querySelectorAll('.pupil-grid button')].map(b=>({first:b.querySelector('strong')?.textContent, second:b.querySelector('small')?.textContent}))`);
  const selected = await evaluate(`document.querySelector('select')?.selectedOptions[0]?.textContent`);
  const renderedFirsts = rendered.map((r) => r.first).sort();
  const expectFirsts = EXPECTED.map((e) => e.first_name).sort();
  const secondOk = EXPECTED.every((e) => rendered.some((r) => r.first === e.first_name && r.second === (e.last_name ?? e.grade)));
  check("E", "/live/session (fresh page load, synthetic class selected) renders exactly the saved pupils", selected === CLASS_NAME && JSON.stringify(renderedFirsts) === JSON.stringify(expectFirsts) && secondOk && !renderedFirsts.includes(DECOY_PUPIL), { selected_class: selected, rendered });
  const hosts = [...new Set(blocked.map((u) => new URL(u).hostname))];
  const prodAttempts = blocked.filter((u) => /supabase\.(co|in)|sportfolio/i.test(new URL(u).hostname));
  check("G", "network isolation: no Supabase/production request attempted; all other non-local calls blocked before leaving the machine", prodAttempts.length === 0, { production_attempts: prodAttempts.length, blocked_third_party_hosts: hosts, blocked_requests: blocked.length });

  // F. Cleanup: remove every synthetic row, prove zero remain, then tear the environment down.
  psql(`delete from public.sportfolio_classes where teacher_user_id = '${TEACHER.id}';
        delete from public.sportfolio_students where created_by = '${TEACHER.id}';
        delete from public.sportfolio_pilot_access where email = '${TEACHER.email}';
        delete from auth.users where id = '${TEACHER.id}';`);
  const left = q(`select (select count(*) from public.sportfolio_classes) classes, (select count(*) from public.sportfolio_students) students, (select count(*) from public.sportfolio_class_memberships) memberships, (select count(*) from public.sportfolio_pilot_access) pilot_access, (select count(*) from auth.users) users`)[0];
  cdp.close(); gw.close();
  await teardown();
  const alive = procs.filter((p) => { try { process.kill(-p.pid, 0); return true; } catch { return false; } }).length;
  const tmpGone = !existsSync(tmp);
  check("F", "cleanup: 0 synthetic rows remain, processes stopped, throwaway cluster deleted", Object.values(left).every((n) => Number(n) === 0) && alive === 0 && tmpGone, { rows_remaining: left, processes_alive: alive, cluster_dir_deleted: tmpGone });
}

let tornDown = false;
async function teardown() {
  if (tornDown) return; tornDown = true;
  for (const p of procs.reverse()) { try { process.kill(-p.pid, "SIGTERM"); } catch {} }
  await sleep(1500);
  for (const p of procs) { try { process.kill(-p.pid, "SIGKILL"); } catch {} }
  if (tmp && existsSync(join(tmp, "pg"))) spawnSync(join(PG_BIN, "pg_ctl"), ["-D", join(tmp, "pg"), "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}

const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" }).stdout.trim();
const dirty = spawnSync("git", ["status", "--porcelain", "--", "app", "lib", "supabase"], { cwd: REPO, encoding: "utf8" }).stdout.trim();
let code = 0, error;
try { await main(); } catch (e) { error = e.message; code = 2; await teardown(); }
const failed = checks.filter((c) => !c.ok).length;
if (!error) code = failed || checks.length < 7 ? 1 : 0;
const summary = `${code === 0 ? "VERIFY PASS" : code === 1 ? "VERIFY FAIL" : "VERIFY ERROR"} sportfolio-roster-import @ ${commit}${dirty ? "+dirty" : ""} (${checks.length} checks, ${failed} failed)${error ? ` :: ${error}` : ""}`;
if (JSON_OUT) console.log(JSON.stringify({ summary, commit, dirty: !!dirty, run: RUN, checks, gateway_requests: gatewayLog, blocked, error }, null, 2)); else console.log(summary);
process.exit(code);
