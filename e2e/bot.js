// VTON 웹앱 점검 봇. VTON_MOCK=1 로 띄운 로컬 서버(BASE)에 대고 전체 흐름과 실패 경로를 돈다.
// 실행: VTON_MOCK=1 NEXT_PUBLIC_GENERATION_OPEN=1 npm run build && VTON_MOCK=1 npx next start -p 3100 그다음 npm run bot [flow|fail|resume|return|photo|progress|selfie|couple]
// 생성 잠금 확인: NEXT_PUBLIC_GENERATION_OPEN=0 으로 빌드·실행한 서버에 npm run bot closed (오픈 시각 2026-11-30 KST 전이면 값 없이도 잠김)
// Playwright가 깔린 환경(클라우드 세션 등)에서 돈다. 스크린샷은 e2e/shots/
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.env.OUT || require("path").join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });

// 가짜 카메라에 얼굴을 비춘다 (기본 가짜 화면엔 얼굴이 없어 사진 점검에 걸린다). 사진 점검용 어두운·흐린 사진도 만든다.
const { execFileSync } = require("child_process");
// 점검용 사진(정면 얼굴 1명 / 두 사람). 목록 영상이 바뀌어도 그대로 쓰도록 따로 둔다.
const FIX = require("path").join(__dirname, "fixtures");
const FACE_CAM = `${OUT}/face-cam.mjpeg`;
let hasFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-i", `${FIX}/face-front.jpg`, "-t", "2", "-r", "15", "-vf", "scale=-2:480,pad=640:480:(ow-iw)/2:0", "-q:v", "3", FACE_CAM]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${FIX}/face-front.jpg`, "-vf", "eq=brightness=-0.6", `${OUT}/photo-dark.jpg`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${FIX}/face-front.jpg`, "-vf", "gblur=sigma=6", `${OUT}/photo-blur.jpg`]);
} catch { hasFfmpeg = false; console.log("ffmpeg 없음: 가짜 카메라에 얼굴 없이 진행 (사진 점검은 「그래도 이 사진으로」로 넘김)"); }

/** 확인 화면에서 「이 사진으로 만들기」. 사진 점검에 걸리면 「그래도 이 사진으로」 */
async function usePhoto(page) {
  await page.waitForSelector(".cam-confirm .btn:not([disabled])", { timeout: 10000 });
  const issue = await page.locator(".photo-issue").count();
  await page.locator(issue ? ".cam-confirm .btn.sub" : ".cam-confirm .btn").first().click();
  return issue;
}

// 지원 언어 전부 (lib/i18n.ts LANGS 와 같은 순서)
const ALL = ["ko", "en", "zh", "zh-Hant", "ja", "vi", "th", "id", "es", "ar"];

const findings = [];
const note = (ok, name, detail = "") => { findings.push({ ok, name, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["camera"], ...opts });
  // 점검 봇도 단계 로그를 보내게 한다 (lib/track.ts 는 자동화 브라우저를 사람 수에서 뺀다)
  await ctx.addInitScript(() => { try { localStorage.setItem("vton.trackBots", "1"); } catch {} });
  return ctx;
}
async function watch(page, tag) {
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|fonts\.g|TensorFlow Lite|XNNPACK|gl_context|inference_feedback/.test(m.text())) errs.push(`console ${m.text()}`); });
  return errs;
}
async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
async function rawKeys(page) {
  const txt = await page.evaluate(() => document.body.innerText);
  return (txt.match(/\b(?:home|work|done|selfie|consent|intro|err|map|tab|step|common|lang|qr)\.[a-zA-Z.]+\b/g) || []);
}
async function check(page, label) {
  const o = await overflow(page);
  const k = await rawKeys(page);
  if (o > 0) note(false, `${label}: 가로 넘침`, `${o}px`);
  if (k.length) note(false, `${label}: 번역 안 된 키`, k.join(","));
  return o <= 0 && !k.length;
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

async function fullFlow(browser, lang) {
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await page.addInitScript(() => { const send = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { if (b instanceof FormData) window.__role = b.get("role"); return send.call(this, b); }; });
  const errs = await watch(page);
  await page.goto(`${BASE}/?lang=${lang}`);
  await page.waitForTimeout(500);
  let ok = await check(page, `${lang} 홈`);
  await shot(page, `${lang}-1-home`);
  // 탭 전환
  const tabs = page.locator('[role="tab"]');
  const counts = [];
  for (const i of [1, 2, 3, 0]) { await tabs.nth(i).click(); counts[i] = await page.locator(".scenes li").count(); }
  if (counts.join() !== "2,3,2,3") note(false, `${lang} 탭`, `벚꽃·장터·녹차·섬진강=${counts.join()}`);
  // 장면 → intro
  await page.locator(".scenes a").first().click();
  await page.waitForURL(/\/v\//);
  await page.waitForTimeout(400);
  ok = (await check(page, `${lang} 장면 소개`)) && ok;
  await shot(page, `${lang}-2-intro`);
  await page.locator(".cast .tile").nth(1).click(); // 오른쪽 인물(트레일러 클립은 남자)
  // 동의: 빈 채로 다음 → 토스트
  await page.locator(".foot .btn").click();
  const toast = await page.locator(".toast").isVisible().catch(() => false);
  if (!toast) note(false, `${lang} 동의 미체크 토스트`, "토스트가 안 뜸");
  ok = (await check(page, `${lang} 동의`)) && ok;
  await shot(page, `${lang}-3-consent`);
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  // 셀카 (가짜 카메라)
  await page.waitForSelector(".shutter", { timeout: 8000 });
  await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0, null, { timeout: 8000 });
  ok = (await check(page, `${lang} 셀카`)) && ok;
  await shot(page, `${lang}-4-camera`);
  await page.locator(".shutter").click();
  await page.waitForSelector(".cam img");
  // 다시 찍기 → 카메라가 다시 살아나는지
  await page.locator(".cam-confirm .btn.sub").click();
  const live = await page.waitForFunction(() => { const v = document.querySelector(".cam video"); return v && v.srcObject && v.videoWidth > 0; }, null, { timeout: 4000 }).then(() => true).catch(() => false);
  if (!live) { note(false, `${lang} 다시 찍기 후 카메라`, "미리보기가 검게 멈춤(srcObject 없음)"); await shot(page, `${lang}-4b-retake-black`); }
  await page.locator(".shutter").click().catch(() => {});
  await page.waitForSelector(".cam img", { timeout: 4000 }).catch(() => {});
  if (!(await page.locator(".cam img").count())) { note(false, `${lang} 다시 찍기 후 촬영`, "셔터를 눌러도 사진이 안 찍힘"); await ctx.close(); return; }
  // 서버로 가는 요청 확인
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/jobs") && r.method() === "POST");
  const flagged = await usePhoto(page);
  if (flagged && hasFfmpeg) note(false, `${lang} 정상 셀카가 사진 점검에 걸림`, await page.locator(".photo-issue").innerText().catch(() => ""));
  await posted;
  const role = await page.evaluate(() => window.__role);
  if (role !== "man") note(false, `${lang} 고른 인물 전달`, `role=${role}`);
  await page.waitForSelector(".making");
  await page.waitForTimeout(800);
  ok = (await check(page, `${lang} 제작 중`)) && ok;
  await shot(page, `${lang}-5-working`);
  // 완성 (mock은 6초, 무변화 판정 시 한 번 더)
  const t0 = Date.now();
  await page.waitForSelector(".result", { timeout: 40000 });
  const took = Math.round((Date.now() - t0) / 1000);
  await page.waitForSelector(".foot .btn:not([disabled])", { timeout: 10000 }).catch(() => note(false, `${lang} 저장 버튼`, "준비 중에서 안 풀림"));
  ok = (await check(page, `${lang} 완성`)) && ok;
  await shot(page, `${lang}-6-done`);
  if (errs.length) note(false, `${lang} 콘솔 오류`, errs.slice(0, 3).join(" | "));
  note(ok && !errs.length, `${lang} 전체 흐름 (완성까지 ${took}초)`);
  await ctx.close();
}

/** 상태 조회 응답을 가로채 원하는 시나리오를 만든다 */
async function routeStatus(page, fn) {
  await page.route(/\/api\/jobs\/[^/]+$/, async (route) => {
    if (route.request().method() !== "GET") return route.fulfill({ status: 204 });
    const r = await fn(route.request().url());
    if (r.raw) return route.fulfill({ status: r.status, contentType: "text/html", body: r.raw });
    return route.fulfill({ status: r.status || 200, contentType: "application/json", body: JSON.stringify(r.json) });
  });
}
/** 화면 글자가 나올 때까지 기다린다. 시계를 가짜로 바꾼 페이지에서도 되도록 봇 쪽 시간으로 잰다. */
async function untilText(page, selector, re, ms = 8000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (re.test(await page.locator(selector).innerText().catch(() => ""))) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}
async function toWorking(page, videoId = "simni-1") {
  await page.goto(`${BASE}/v/${videoId}?lang=ko`);
  await page.locator(".cast .tile").first().click();
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  await page.waitForSelector(".shutter");
  await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0);
  await page.locator(".shutter").click();
  await usePhoto(page);
  await page.waitForSelector(".making");
}

async function failurePaths(browser) {
  // 1) 정책 차단: 자동 재시도 없이 바로 안내, 「같은 사진으로 다시」 없음
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    let posts = 0; page.on("request", (r) => { if (r.url().endsWith("/api/jobs") && r.method() === "POST") posts++; });
    await routeStatus(page, () => ({ json: { state: "failed", code: "safety" } }));
    await toWorking(page);
    await page.waitForSelector('.empty[role="alert"]', { timeout: 15000 });
    const again = await page.locator(".foot .btn").count();
    await shot(page, "fail-safety");
    note(posts === 1 && again === 1, "정책 차단 → 바로 안내, 자동 재시도 없음", `요청 ${posts}번, 버튼 ${again}개`);
    await ctx.close();
  }
  // 2) 서버 오류: 같은 사진으로 1회 자동 재시도 → 또 실패면 안내 + 「같은 사진으로 다시」
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    let posts = 0; page.on("request", (r) => { if (r.url().endsWith("/api/jobs") && r.method() === "POST") posts++; });
    await routeStatus(page, () => ({ json: { state: "failed", code: "generic" } }));
    await toWorking(page);
    await page.waitForSelector('.empty[role="alert"]', { timeout: 20000 });
    const btns = await page.locator(".foot .btn").count();
    await shot(page, "fail-generic");
    note(posts === 2 && btns === 2, "서버 오류 → 1회 자동 재시도 후 안내", `요청 ${posts}번, 버튼 ${btns}개`);
    // 수동 「같은 사진으로 다시」
    await page.locator(".foot .btn").first().click();
    await page.waitForTimeout(1500);
    note(posts === 3, "「같은 사진으로 다시」 누르면 새 요청", `요청 ${posts}번`);
    await ctx.close();
  }
  // 3) 대기 순번 표시
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    await routeStatus(page, () => ({ json: { state: "queued", position: 7 } }));
    await toWorking(page);
    await untilText(page, ".stages", /앞에 7명/);
    const txt = await page.locator(".making").innerText();
    await shot(page, "queued-7");
    note(/앞에 7명/.test(txt), "대기 순번 표시", txt.replace(/\s+/g, " ").slice(0, 110));
    await ctx.close();
  }
  // 4) 대기열 10분 초과 → 취소 + 시간 초과 안내 (시계 빨리 감기)
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    await page.clock.install();
    let deletes = 0;
    page.on("request", (r) => { if (r.method() === "DELETE") deletes++; });
    let polls = 0;
    await routeStatus(page, () => { polls++; return { json: { state: "queued", position: 3 } }; });
    await toWorking(page);
    // 작업이 접수된 뒤부터 10분을 잰다 (접수 전에 시계를 감으면 시간 제한이 시작되지 않는다)
    await untilText(page, ".stages", /앞에 3명/);
    await page.clock.runFor(6 * 60 * 1000 + 5000);
    const slow = await page.locator(".wait").innerText();
    await page.clock.runFor(4 * 60 * 1000 + 10000);
    await page.waitForSelector('.empty[role="alert"]', { timeout: 5000 }).catch(() => {});
    const alert = await page.locator('.empty[role="alert"]').innerText().catch(() => "");
    // timeout은 재시도 가능 → 1회 자동 재시도가 먼저인지 확인
    await shot(page, "timeout-queued");
    note(deletes >= 1 && !!alert, "대기열 10분 초과 → fal 취소 + 안내", `DELETE ${deletes}번, 6분 문구: ${slow.slice(0, 40)}`);
    await ctx.close();
  }
  // 5) 상태 조회가 잠깐 실패(502 JSON)하면 새 작업을 또 맡기는가 (이중 과금 위험)
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    let posts = 0; page.on("request", (r) => { if (r.url().endsWith("/api/jobs") && r.method() === "POST") posts++; });
    let n = 0;
    await routeStatus(page, (url) => {
      n++;
      if (n === 2) return { status: 503, json: { state: "unknown" } };
      if (n < 4) return { json: { state: "running" } };
      const id = decodeURIComponent(url.split("/").pop());
      return { json: { state: "done", videoUrl: "/videos/simni-2.mp4" } };
    });
    await toWorking(page);
    await page.waitForSelector(".result, .empty[role=alert]", { timeout: 40000 });
    note(posts === 1, "상태 조회 일시 오류 때 새 작업 안 맡김", `POST ${posts}번`);
    await ctx.close();
  }
  // 6) 상태 조회가 HTML 오류(게이트웨이 타임아웃)만 계속 주면 끝없이 기다리는가
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    await page.clock.install();
    await routeStatus(page, () => ({ status: 504, raw: "<html>gateway timeout</html>" }));
    await toWorking(page);
    await page.waitForTimeout(300);
    await page.clock.runFor(20 * 60 * 1000);
    const alert = await page.locator('.empty[role="alert"]').count();
    note(alert > 0, "조회가 계속 실패해도 시간 제한 안내가 뜸", alert ? "" : "20분 지나도 계속 '만드는 중'");
    await shot(page, "status-504-forever");
    await ctx.close();
  }
  // 7) 완성 뒤 「확인 중」(원본과 같은지 비교)에서 영상을 못 받으면 멈추는가
  // iOS Safari는 화면에 안 붙인 영상을 재생 전까지 받지 않아 loadeddata가 안 올 수 있다. 응답 없는 영상 주소로 흉내 낸다.
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    await page.route(/\/stall\/.*\.mp4/, () => {}); // 응답하지 않음
    await routeStatus(page, () => ({ json: { state: "done", videoUrl: "/stall/result.mp4" } }));
    await toWorking(page);
    const t = Date.now();
    const done = await page.waitForSelector(".result", { timeout: 45000 }).then(() => true).catch(() => false);
    note(done, "「확인 중」에서 영상을 못 받아도 완성 화면으로 넘어감", done ? `${Math.round((Date.now() - t) / 1000)}초` : "45초 지나도 '확인 중'");
    await shot(page, "check-stall");
    await ctx.close();
  }
}

async function resumePaths(browser) {
  // 1) 만드는 중 새로고침 → 이어보기
  const ctx = await newCtx(browser); const page = await ctx.newPage();
  const errs = await watch(page);
  await toWorking(page, "simni-2");
  await page.waitForTimeout(2500);
  await page.reload();
  const resumed = await page.waitForSelector(".making, .result", { timeout: 5000 }).then(() => true).catch(() => false);
  note(resumed, "만드는 중 새로고침 → 이어보기");
  await page.waitForSelector(".result", { timeout: 30000 }).catch(() => {});
  // 2) 홈 「내 영상」
  await page.goto(`${BASE}/?lang=ko`);
  await page.waitForTimeout(500);
  const mine = await page.locator(".mine-card").count();
  await shot(page, "home-mine");
  note(mine >= 1, "홈 「내 영상」 표시", `${mine}개`);
  await page.locator(".mine-card").first().click();
  const done = await page.waitForSelector(".result", { timeout: 8000 }).then(() => true).catch(() => false);
  note(done, "「내 영상」 → 완성 화면");
  // 3) 이어본 완성 화면에서 「다시 만들기」 → 동의 없이 셀카로 가서 서버가 거절하는가
  await page.locator(".foot .btn.sub").first().click();
  const where = await page.waitForSelector(".shutter, .agree-all, .cast", { timeout: 5000 }).then((h) => h.getAttribute("class")).catch(() => "?");
  if (where?.includes("shutter")) {
    await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0);
    await page.locator(".shutter").click();
    const resp = page.waitForResponse((r) => r.url().endsWith("/api/jobs") && r.request().method() === "POST");
    await usePhoto(page);
    const r = await resp;
    await page.waitForTimeout(500);
    await shot(page, "resume-retry");
    note(r.ok(), "이어본 뒤 「다시 만들기」 → 새 요청 성공", `HTTP ${r.status()} ${await r.text()}`);
  } else note(true, "이어본 뒤 「다시 만들기」 → 동의/인물 고르기부터", where);
  await ctx.close();

  // 4) 다른 기기: ?job= 링크만으로 이어보기
  {
    const c2 = await newCtx(browser); const p2 = await c2.newPage();
    // 얼굴 구간만 만든 작업: 링크만으로도 서버가 원본 샷을 이어 붙여 전체 길이로 돌려줘야 한다
    const payload = Buffer.from(JSON.stringify({ at: Date.now() - 10000, video: `${BASE}/videos/river-1-gen.mp4`, vid: "river-1" })).toString("base64url");
    await p2.goto(`${BASE}/v/river-1?job=mock.${payload}&lang=en`);
    const ok = await p2.waitForSelector(".result", { timeout: 20000 }).then(() => true).catch(() => false);
    note(ok, "다른 기기 ?job= 링크로 완성 화면");
    await p2.waitForFunction(() => document.querySelector(".result video")?.duration > 0, null, { timeout: 8000 }).catch(() => {});
    const dur = await p2.evaluate(() => document.querySelector(".result video")?.duration || 0);
    note(Math.abs(dur - 10.5) < 0.2, "?job= 링크: 이어 붙인 전체 길이 영상", `${dur.toFixed(2)}초 (전체 10.50초, 얼굴 구간만은 7.08초)`);
    await c2.close();
  }
  if (errs.length) note(false, "이어보기 콘솔 오류", errs.slice(0, 3).join(" | "));
}

async function returnPaths(browser) {
  const ctx = await newCtx(browser); const page = await ctx.newPage();
  const DEEP = "https://map.traveljipsa.com/spot/12?tab=info&from=list#pin-3";
  await page.goto(`${BASE}/?return=${encodeURIComponent(DEEP)}&lang=zh`);
  await page.waitForTimeout(400);
  const href = await page.locator("header .map-btn").getAttribute("href").catch(() => null);
  const box = await page.locator("header .map-btn").boundingBox().catch(() => null);
  await shot(page, "return-header");
  note(href === DEEP, "?return= 깊은 주소(경로·쿼리·#) 그대로 → 헤더 지도 버튼", `${href} ${box ? Math.round(box.width) + "px" : ""}`);
  await check(page, "zh 홈(지도 버튼)");
  // 영상 화면으로 갔다가 언어 바꾸고 새로고침해도 같은 주소가 남는가
  await page.goto(`${BASE}/v/tea-1?lang=en`);
  await page.reload();
  await page.goto(`${BASE}/?lang=ja`);
  await page.waitForTimeout(300);
  const href2 = await page.locator("header .map-btn").getAttribute("href").catch(() => null);
  note(href2 === DEEP, "?return= 기억(영상 화면·언어 변경·새로고침 뒤에도)", String(href2));
  // 인코딩을 빠뜨린 주소도 & 와 # 가 잘리지 않는가
  {
    const c = await newCtx(browser); const p = await c.newPage();
    await p.goto(`${BASE}/?lang=ko&return=${DEEP}`);
    await p.waitForTimeout(300);
    const h = await p.locator("header .map-btn").getAttribute("href").catch(() => null);
    note(h === DEEP, "인코딩 안 된 ?return= 도 전체 주소 복원", String(h));
    await c.close();
  }
  // 협업사가 아닌 주소는 거부(아무 사이트로 보내는 링크 방지)
  {
    const c = await newCtx(browser); const p = await c.newPage();
    await p.goto(`${BASE}/?return=${encodeURIComponent("https://evil.example.com/phish")}`);
    await p.waitForTimeout(300);
    const h = await p.locator("header .map-btn").getAttribute("href").catch(() => null);
    note(!h || !h.includes("evil.example.com"), "협업사 아닌 ?return= 거부(기본 지도 주소로 대체)", String(h));
    await c.close();
  }
  // 지도에서 링크로 들어와 홈→영상→홈을 돌아다닌 뒤 버튼 → 뒤로 가기로 지도 원래 화면(새 기록 없이)
  {
    const c = await newCtx(browser); const p = await c.newPage();
    await c.route("https://map.traveljipsa.com/**", (r) => r.fulfill({ contentType: "text/html", body: `<title>map</title><a id="go" href="${BASE}/?return=${encodeURIComponent(DEEP)}">go</a><script>if (!history.state) history.replaceState({ mapState: Math.random() }, "")</script>` }));
    await p.goto(DEEP);
    const mapState = await p.evaluate(() => history.state.mapState);
    await p.click("#go");
    await p.waitForSelector("header .map-btn");
    const supported = await p.evaluate(() => !!window.navigation);
    await p.locator(".card, a[href^='/v/']").first().click().catch(() => {});
    await p.waitForURL(/\/v\//, { timeout: 5000 }).catch(() => {});
    await p.goBack(); // 영상 화면 → 홈(우리 앱 안 뒤로)
    await p.waitForSelector("header .map-btn");
    await p.locator(".card, a[href^='/v/']").first().click().catch(() => {});
    await p.waitForURL(/\/v\//, { timeout: 5000 }).catch(() => {});
    await p.goto(`${BASE}/`); // 주소창으로 홈(기록 추가)
    await p.waitForSelector("header .map-btn");
    const lenBefore = await p.evaluate(() => history.length);
    await p.locator("header .map-btn").click();
    await p.waitForURL((u) => u.href === DEEP, { timeout: 5000 }).catch(() => {});
    const r = await p.evaluate(() => ({ url: location.href, len: history.length, state: history.state?.mapState }));
    note(r.url === DEEP && (!supported || (r.state === mapState && r.len === lenBefore)), "지도에서 들어온 탭: 버튼이 뒤로 가기로 지도 원래 화면 복원", `${JSON.stringify(r)} 이전 기록 ${lenBefore} navigation API ${supported}`);
    await c.close();
  }
  // 새 탭으로 열린 경우(앞에 지도 기록 없음): 그냥 주소로 이동
  {
    const c = await newCtx(browser); const p0 = await c.newPage();
    await c.route("https://map.traveljipsa.com/**", (r) => r.fulfill({ contentType: "text/html", body: `<title>map</title><a id="go" target="_blank" href="${BASE}/?return=${encodeURIComponent(DEEP)}">go</a>` }));
    await p0.goto(DEEP);
    const [p] = await Promise.all([c.waitForEvent("page"), p0.click("#go")]);
    await p.waitForSelector("header .map-btn");
    await p.locator("header .map-btn").click();
    await p.waitForURL((u) => u.href === DEEP, { timeout: 5000 }).catch(() => {});
    note(p.url() === DEEP, "새 탭으로 열린 경우: 버튼이 return 주소로 이동", p.url());
    await c.close();
  }
  // 4개 언어 모두 헤더 안에 들어가는가
  for (const l of ALL) {
    await page.goto(`${BASE}/?lang=${l}`);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const h = document.querySelector("header.top"); const t = h.querySelector("h1"); const b = h.querySelector(".map-btn");
      const tr = t.getBoundingClientRect(), br = b?.getBoundingClientRect();
      const rtl = document.documentElement.dir === "rtl";
      const hit = br ? (rtl ? br.left < tr.right - 2 : br.right > tr.left + 2) : false;
      return { overlap: hit && t.scrollWidth > t.clientWidth, clipped: t.scrollWidth > t.clientWidth };
    });
    if (r.clipped || r.overlap) note(false, `${l} 헤더 제목 잘림/겹침`, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/${l}-header.png`, clip: { x: 0, y: 0, width: 360, height: 60 } });
  }
  await ctx.close();
  const c2 = await newCtx(browser); const p2 = await c2.newPage();
  await p2.goto(`${BASE}/?return=${encodeURIComponent("javascript:alert(1)")}`);
  await p2.waitForTimeout(300);
  const h2 = await p2.locator("header .map-btn").getAttribute("href").catch(() => null);
  note(!h2 || !h2.startsWith("javascript:"), "javascript: 주소는 거부(기본 지도 주소로 대체)", String(h2));
  await c2.close();
}

async function selfieEdge(browser) {
  // 카메라 거부 → 사진 고르기 버튼
  const ctx = await newCtx(browser, { permissions: [] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); });
  await page.goto(`${BASE}/v/tea-1?lang=ja`);
  await page.locator(".cast .tile").first().click();
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  await page.waitForTimeout(500);
  const err = await page.locator(".cam-err").innerText().catch(() => "");
  await shot(page, "ja-camera-denied");
  // 앨범 사진 올리기
  await page.setInputFiles('input[type="file"]', require("path").join(__dirname, "fixtures/face-front.jpg"));
  const got = await page.waitForSelector(".cam img", { timeout: 4000 }).then(() => true).catch(() => false);
  note(!!err && got, "카메라 거부 → 안내 + 사진 올리기", err.slice(0, 40));
  // 이미지가 아닌 파일
  await page.locator(".cam-confirm .btn.sub").click().catch(() => {});
  await ctx.close();
}

async function photoPaths(browser) {
  // 앨범 사진으로 사진 점검: 걸려야 할 사진은 안내 + 「다시 찍기」가 앞, 정상 사진은 그대로
  const cases = [
    ["face-front.jpg", `${FIX}/face-front.jpg`, false],
    ["두 사람 사진", `${FIX}/two-people.jpg`, true],
    ...(hasFfmpeg ? [["어두운 사진", `${OUT}/photo-dark.jpg`, true], ["흐린 사진", `${OUT}/photo-blur.jpg`, true]] : []),
  ];
  const ctx = await newCtx(browser); const page = await ctx.newPage();
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); });
  await page.goto(`${BASE}/v/simni-1?lang=ko`);
  await page.locator(".cast .tile").first().click();
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  for (const [name, file, expect] of cases) {
    await page.setInputFiles('input[type="file"]', file);
    await page.waitForSelector(".cam-confirm .btn:not([disabled])", { timeout: 10000 });
    const msg = await page.locator(".photo-issue").innerText().catch(() => "");
    note(!!msg === expect, `사진 점검: ${name}`, msg || "통과");
    if (expect) await shot(page, `photo-issue-${cases.indexOf(cases.find((c) => c[0] === name))}`);
    await page.locator(".cam-confirm .btn" + (msg ? "" : ".sub")).first().click(); // 다시 찍기
  }
  // 걸린 사진도 「그래도 이 사진으로」로 보낼 수 있다
  await page.setInputFiles('input[type="file"]', `${FIX}/two-people.jpg`);
  await page.waitForSelector(".photo-issue", { timeout: 10000 });
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/jobs") && r.method() === "POST", { timeout: 5000 }).then(() => true).catch(() => false);
  await page.locator(".cam-confirm .btn.sub").click();
  note(await posted, "사진 점검에 걸려도 「그래도 이 사진으로」 보내짐");
  await ctx.close();
}

async function progressPaths(browser) {
  // 1) 4단계 표시: 사진 접수 → 장면 의상 → AI 영상(접수·대기 → 만드는 중) → 받기, 단계 로그
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    const events = [];
    page.on("request", (r) => { if (r.url().endsWith("/api/log")) { try { events.push(JSON.parse(r.postData() || "{}").e); } catch {} } });
    let n = 0;
    await routeStatus(page, () => {
      n++;
      if (n <= 2) return { json: { state: "queued", position: 3 } };
      if (n <= 4) return { json: { state: "running" } };
      return { json: { state: "done", videoUrl: "/videos/simni-2.mp4" } };
    });
    await toWorking(page);
    // 서버가 사진을 받은 뒤 장면 의상(캐릭터시트)을 만드는 동안 2단계가 진행 중이어야 한다 (모의 서버는 1.5초)
    const fitNow = await page.waitForSelector('.stages li:nth-child(2)[data-s="now"]', { timeout: 3000 }).then((h) => h.innerText()).catch(() => "");
    await shot(page, "stages-0-fitting");
    note(/의상/.test(fitNow) && (await page.locator('.stages li:nth-child(1)[data-s="done"]').count()) === 1, "단계 표시: 사진 접수 완료 → 장면 의상 입히는 중", fitNow.replace(/\s+/g, " ").slice(0, 60));
    await page.waitForFunction(() => /앞에 3명/.test(document.querySelector('.stages li[data-s="now"]')?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    const q = await page.locator(".stages").innerText();
    await shot(page, "stages-1-queued");
    note((await page.locator(".stages li").count()) === 4 && /의상 준비 완료/.test(q) && /AI 접수 완료 · 앞에 3명/.test(q) && (await page.locator('.stages li[data-s="done"]').count()) === 2,
      "단계 표시: 의상 준비 완료 → AI 접수 완료(앞에 3명)", q.replace(/\s+/g, " ").slice(0, 110));
    await page.waitForFunction(() => /지남/.test(document.querySelector('.stages li:nth-child(3)[data-s="now"]')?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const m = await page.locator('.stages li[data-s="now"]').innerText().catch(() => "");
    await shot(page, "stages-2-making");
    note(/지남/.test(m) && (await page.locator('.stages li[data-s="done"]').count()) === 2, "단계 표시: 만드는 중", m.replace(/\s+/g, " ").slice(0, 60));
    await page.waitForSelector(".result", { timeout: 30000 });
    await page.waitForTimeout(500);
    const saveReady = await page.locator(".foot .btn:not([disabled])").first().innerText();
    note(["fitted", "submitted", "started", "generated", "downloaded"].every((e) => events.includes(e)), "단계 로그", events.join(","));
    note(!/준비/.test(saveReady), "받아 둔 영상으로 저장 버튼 바로 준비", saveReady);
    await ctx.close();
  }
  // 2) 셀카 전송이 끊김 → 「인터넷」 안내 + 같은 사진으로 다시
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    await page.route(/\/api\/jobs$/, (r) => r.abort("internetdisconnected"));
    await toWorking(page).catch(() => {});
    await page.waitForSelector('.empty[role="alert"]', { timeout: 10000 }).catch(() => {});
    const msg = await page.locator('.empty[role="alert"]').innerText().catch(() => "");
    const btns = await page.locator(".foot .btn").count();
    await shot(page, "upload-failed");
    note(/인터넷/.test(msg) && btns === 2, "셀카 전송 끊김 → 인터넷 안내 + 같은 사진으로 다시", msg.replace(/\s+/g, " ").slice(0, 60));
    await ctx.close();
  }
  // 3) 상태 조회가 연달아 안 닿음 → 「연결 불안정」 안내, 다시 닿으면 사라짐
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    let n = 0;
    await page.route(/\/api\/jobs\/[^/]+$/, (route) => {
      n++;
      if (n <= 3) return route.abort("internetdisconnected");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: "running" }) });
    });
    await toWorking(page);
    const shown = await page.waitForSelector(".notice.warn", { timeout: 20000 }).then(() => true).catch(() => false);
    await shot(page, "net-weak");
    const gone = await page.waitForSelector(".notice.warn", { state: "detached", timeout: 10000 }).then(() => true).catch(() => false);
    note(shown && gone, "조회 연달아 실패 → 연결 불안정 안내, 회복 후 사라짐");
    await ctx.close();
  }
  // 4) 얼굴 구간만 만들고(모의 서버는 생성용 영상을 그대로 결과로 준다) 원본 샷을 이어 붙인 전체 길이 영상이 오는가
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    await toWorking(page, "simni-2");
    await page.waitForSelector(".result", { timeout: 40000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector(".result video")?.duration > 0, null, { timeout: 8000 }).catch(() => {});
    const dur = await page.evaluate(() => document.querySelector(".result video")?.duration || 0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vton.jobs") || "[]")[0]?.resultUrl || "");
    note(Math.abs(dur - 10.75) < 0.2 && saved.startsWith("/api/result?job="), "얼굴 구간만 생성 → 원본 샷을 이어 붙인 결과", `${dur.toFixed(2)}초 (전체 10.75초, 얼굴 구간만은 6.83초), ${saved.slice(0, 24)}`);
    await ctx.close();
  }
  // 5) 장면 의상(캐릭터시트)이 실패하면 사진 그대로 진행한다고 알리는가
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage();
    const job = `mock.${Buffer.from(JSON.stringify({ at: Date.now() + 60000, video: "/videos/simni-1.mp4" })).toString("base64url")}`;
    await page.route(/\/api\/jobs$/, (r) => r.fulfill({
      status: 200, contentType: "application/x-ndjson",
      body: [{ ev: "received", sheet: true }, { ev: "sheet", ok: false }, { jobId: job }].map((o) => JSON.stringify(o)).join("\n") + "\n",
    }));
    await toWorking(page);
    await page.waitForSelector('.stages li:nth-child(2)[data-s="done"]', { timeout: 5000 }).catch(() => {});
    const fit = await page.locator(".stages li:nth-child(2)").innerText().catch(() => "");
    await shot(page, "stages-fit-skipped");
    note(/사진 그대로/.test(fit), "장면 의상 실패 → 사진 그대로 진행 안내", fit.replace(/\s+/g, " ").slice(0, 60));
    await ctx.close();
  }
}

// 생성이 잠겨 있을 때(정식 오픈 전): 장면은 보이고, 주인공 되기는 안내만, 서버도 503
async function closedPaths(browser) {
  const ctx = await newCtx(browser); const page = await ctx.newPage();
  await page.goto(`${BASE}/v/simni-1?lang=ko`);
  await page.locator(".cast .tile, .solo .btn").first().click();
  await page.waitForTimeout(400);
  const toastText = await page.locator("body").innerText();
  note(/정식 오픈/.test(toastText), "잠금: 주인공 되기 → 준비 중 안내");
  note(await page.locator(".agree-all").count() === 0, "잠금: 동의 화면으로 안 넘어감");
  await page.screenshot({ path: `${OUT}/closed-toast.png` });
  const res = await page.request.post(`${BASE}/api/jobs`, { multipart: { videoId: "simni-1" } });
  note(res.status() === 503, "잠금: /api/jobs 503", String(res.status()));
  await ctx.close();
}

/** 둘이 함께 바꾸기: 커플 카드 → 동의(함께 찍는 사람 항목) → 그 → 그녀 차례로 셀카 → 셀카 2장이 서버로 가는지 */
async function couplePaths(browser, lang = "ko") {
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await page.addInitScript(() => { const send = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { if (b instanceof FormData) window.__form = [...b.keys()]; return send.call(this, b); }; });
  const errs = await watch(page);
  await page.goto(`${BASE}/v/market-1?lang=${lang}`);
  await page.waitForTimeout(400);
  await page.locator(".couple").scrollIntoViewIfNeeded();
  await check(page, `${lang} 커플 카드`);
  await shot(page, `couple-${lang}-1-intro`);
  await page.locator(".couple").click();
  const rows = await page.locator(".rows .row").count();
  note(rows === 4, `${lang} 커플 동의 항목 4개`, String(rows));
  await shot(page, `couple-${lang}-2-consent`);
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  // 1번: 그
  await page.waitForSelector(".pair-bar");
  await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0, null, { timeout: 8000 });
  const first = await page.locator('.pair-bar [aria-selected="true"]').innerText();
  note(/(그|他|Him|彼|Anh ấy|เขา|Laki-laki|Él|هو)$/.test(first.trim()), `${lang} 커플 첫 차례가 그`, first.replace(/\n/g, " "));
  await check(page, `${lang} 커플 셀카 1`);
  await shot(page, `couple-${lang}-3-cam-him`);
  await page.locator(".shutter").click();
  await page.waitForSelector(".cam img");
  await page.waitForSelector(".cam-confirm .btn:not([disabled])", { timeout: 10000 });
  await shot(page, `couple-${lang}-4-confirm-him`);
  await usePhoto(page);
  // 2번: 그녀 (카메라가 다시 살아나야 한다)
  const live = await page.waitForFunction(() => { const v = document.querySelector(".cam video"); return v && v.srcObject && v.videoWidth > 0; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  note(live, `${lang} 커플 두 번째 카메라`);
  const second = await page.locator('.pair-bar [aria-selected="true"]').innerText();
  note(/그녀|她|Her|彼女|Cô ấy|เธอ|Perempuan|Ella|هي/.test(second), `${lang} 커플 둘째 차례가 그녀`, second.replace(/\n/g, " "));
  await page.waitForTimeout(300);
  await shot(page, `couple-${lang}-5-cam-her`);
  // 1번 칸을 눌러 다시 찍었다가 돌아오기
  await page.locator(".pair-bar button").first().click();
  await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0, null, { timeout: 8000 });
  await page.locator(".shutter").click();
  await page.waitForSelector(".cam-confirm .btn:not([disabled])", { timeout: 10000 });
  const lbl1 = await page.locator(".cam-confirm .btn").first().innerText();
  await usePhoto(page);
  await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0, null, { timeout: 8000 });
  await page.locator(".shutter").click();
  await page.waitForSelector(".cam-confirm .btn:not([disabled])", { timeout: 10000 });
  const lbl2 = await page.locator(".cam-confirm .btn").first().innerText();
  note(/다음|下一|next|次|tiếp theo|ถัดไป|berikutnya|siguiente|التالي/i.test(lbl1) && /두 사진|两张|兩張|both|2枚|hai ảnh|สองรูป|dua foto|las dos|بالصورتين/i.test(lbl2), `${lang} 커플 버튼 글자`, `${lbl1} / ${lbl2}`);
  await shot(page, `couple-${lang}-6-confirm-her`);
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/jobs") && r.method() === "POST");
  await usePhoto(page);
  await posted;
  const keys = await page.evaluate(() => window.__form);
  note(keys.includes("selfie.man") && keys.includes("selfie.woman") && keys.includes("role") && !keys.includes("selfie"), `${lang} 커플 셀카 2장 전송`, keys.join(","));
  await page.waitForSelector(".making");
  await page.waitForTimeout(800);
  await shot(page, `couple-${lang}-7-working`);
  await page.waitForSelector(".result", { timeout: 40000 }).then(() => note(true, `${lang} 커플 완성까지`)).catch(() => note(false, `${lang} 커플 완성`, "결과 화면이 안 뜸"));
  if (errs.length) note(false, `${lang} 커플 콘솔 오류`, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

/** 휴대폰 언어로 첫 언어 고르기 · 직접 고른 언어 유지 · 아랍어 오른쪽→왼쪽 · 언어 시트 */
async function langPaths(browser) {
  const cases = [
    [["zh-TW", "zh"], "zh-Hant"], [["zh-CN"], "zh"], [["vi-VN"], "vi"], [["th-TH"], "th"], [["in-ID"], "id"],
    [["es-MX", "es"], "es"], [["ar-SA"], "ar"], [["fr-FR", "fr", "en-US"], "en"], [["fr-FR", "de"], "ko"], [["ja-JP"], "ja"],
  ];
  for (const [langs, want] of cases) {
    const ctx = await newCtx(browser, { locale: langs[0] });
    await ctx.addInitScript((ls) => { Object.defineProperty(navigator, "languages", { get: () => ls }); }, langs);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(400);
    const got = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
    note(got[0] === want && got[1] === (want === "ar" ? "rtl" : "ltr"), `휴대폰 언어 ${langs.join(",")} → ${want}`, got.join(" "));
    await ctx.close();
  }
  // 직접 고른 언어는 휴대폰 언어보다 앞선다
  const ctx = await newCtx(browser, { locale: "vi-VN" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(400);
  await page.locator(".lang-btn").click();
  await page.waitForTimeout(400); // 시트가 올라오는 애니메이션
  const opts = await page.locator(".sheet .opt").count();
  note(opts === ALL.length, `언어 시트 항목 ${ALL.length}개`, String(opts));
  const fits = await page.evaluate(() => { const s = document.querySelector(".sheet"); return s.getBoundingClientRect().top >= 0; });
  note(fits, "언어 시트가 화면 안에 들어옴");
  await shot(page, "lang-sheet");
  await page.locator('.sheet .opt[lang="es"]').click();
  await page.reload();
  await page.waitForTimeout(400);
  note(await page.evaluate(() => document.documentElement.lang) === "es", "직접 고른 언어(es)가 다시 열어도 유지");
  // 작은 화면(iPhone SE)에서도 시트가 넘치지 않고 안에서 스크롤
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator(".lang-btn").click();
  await page.waitForTimeout(400);
  const small = await page.evaluate(() => { const s = document.querySelector(".sheet"); return { top: Math.round(s.getBoundingClientRect().top), scroll: s.scrollHeight > s.clientHeight }; });
  note(small.top >= 0, "작은 화면 언어 시트", JSON.stringify(small));
  await shot(page, "lang-sheet-small");
  await ctx.close();
  // 아랍어: 뒤로 버튼이 오른쪽, 화살표가 뒤집힘, 본문이 오른쪽 정렬
  const c2 = await newCtx(browser); const p2 = await c2.newPage();
  await p2.goto(`${BASE}/v/market-1?lang=ar`);
  await p2.waitForTimeout(500);
  const r = await p2.evaluate(() => {
    const b = document.querySelector("header .icon-btn"); const svg = b?.querySelector("svg");
    return { backX: b ? Math.round(b.getBoundingClientRect().left) : -1, flip: svg ? getComputedStyle(svg).transform : "", dir: getComputedStyle(document.body).direction };
  });
  note(r.backX > 180 && r.flip !== "none" && r.dir === "rtl", "아랍어 오른쪽→왼쪽 배치(뒤로 버튼 오른쪽·화살표 뒤집힘)", JSON.stringify(r));
  await check(p2, "ar 장면 소개");
  await c2.close();
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", ...(hasFfmpeg ? [`--use-file-for-fake-video-capture=${FACE_CAM}`] : [])] });
  const only = process.argv[2];
  if (only === "closed") await closedPaths(browser).catch((e) => note(false, "잠금 예외", e.message.split("\n")[0]));
  if (!only || only === "flow") for (const l of ALL) await fullFlow(browser, l).catch((e) => note(false, `${l} 전체 흐름 예외`, e.message.split("\n")[0]));
  if (!only || only === "lang") await langPaths(browser).catch((e) => note(false, "언어 예외", e.message.split("\n")[0]));
  if (!only || only === "fail") await failurePaths(browser).catch((e) => note(false, "실패 경로 예외", e.message.split("\n")[0]));
  if (!only || only === "resume") await resumePaths(browser).catch((e) => note(false, "이어보기 예외", e.message.split("\n")[0]));
  if (!only || only === "return") await returnPaths(browser).catch((e) => note(false, "지도 버튼 예외", e.message.split("\n")[0]));
  if (!only || only === "photo") await photoPaths(browser).catch((e) => note(false, "사진 점검 예외", e.message.split("\n")[0]));
  if (!only || only === "progress") await progressPaths(browser).catch((e) => note(false, "진행 표시 예외", e.message.split("\n")[0]));
  if (!only || only === "selfie") await selfieEdge(browser).catch((e) => note(false, "셀카 예외", e.message.split("\n")[0]));
  if (!only || only === "couple") for (const l of only ? ALL : ["ko"]) await couplePaths(browser, l).catch((e) => note(false, `${l} 커플 예외`, e.message.split("\n")[0]));
  await browser.close();
  fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
  console.log(`\n${findings.filter((f) => !f.ok).length} FAIL / ${findings.length}`);
})();
