// VTON 웹앱 점검 봇. VTON_MOCK=1 로 띄운 로컬 서버(BASE)에 대고 전체 흐름과 실패 경로를 돈다.
// 실행: VTON_MOCK=1 npm run build && VTON_MOCK=1 npx next start -p 3100 그다음 npm run bot [flow|fail|resume|return|selfie]
// Playwright가 깔린 환경(클라우드 세션 등)에서 돈다. 스크린샷은 e2e/shots/
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.env.OUT || require("path").join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (ok, name, detail = "") => { findings.push({ ok, name, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["camera"], ...opts });
  return ctx;
}
async function watch(page, tag) {
  const errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) errs.push(`console ${m.text()}`); });
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
  await page.addInitScript(() => { const f = window.fetch; window.fetch = (u, o) => { if (o && o.body instanceof FormData) window.__role = o.body.get("role"); return f(u, o); }; });
  const errs = await watch(page);
  await page.goto(`${BASE}/?lang=${lang}`);
  await page.waitForTimeout(500);
  let ok = await check(page, `${lang} 홈`);
  await shot(page, `${lang}-1-home`);
  // 탭 전환
  const tabs = page.locator('[role="tab"]');
  await tabs.nth(1).click();
  const marketCount = await page.locator(".scenes li").count();
  await tabs.nth(0).click();
  const simniCount = await page.locator(".scenes li").count();
  if (marketCount !== 3 || simniCount !== 3) note(false, `${lang} 탭`, `simni=${simniCount} market=${marketCount}`);
  // 장면 → intro
  await page.locator(".scenes a").first().click();
  await page.waitForURL(/\/v\//);
  await page.waitForTimeout(400);
  ok = (await check(page, `${lang} 장면 소개`)) && ok;
  await shot(page, `${lang}-2-intro`);
  await page.locator(".cast .tile").nth(1).click(); // 오른쪽 인물(여자)
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
  await page.locator(".cam-confirm .btn").first().click();
  await posted;
  const role = await page.evaluate(() => window.__role);
  if (role !== "woman") note(false, `${lang} 고른 인물 전달`, `role=${role}`);
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
async function toWorking(page, videoId = "simni-tunnel") {
  await page.goto(`${BASE}/v/${videoId}?lang=ko`);
  await page.locator(".cast .tile").first().click();
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  await page.waitForSelector(".shutter");
  await page.waitForFunction(() => document.querySelector(".cam video")?.videoWidth > 0);
  await page.locator(".shutter").click();
  await page.locator(".cam-confirm .btn").first().click();
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
    await page.waitForTimeout(1500);
    const txt = await page.locator(".making").innerText();
    await shot(page, "queued-7");
    note(/7/.test(txt), "대기 순번 표시", txt.replace(/\s+/g, " ").slice(0, 80));
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
    await page.waitForTimeout(500);
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
      return { json: { state: "done", videoUrl: "/videos/simni-petal.mp4" } };
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
  await toWorking(page, "simni-petal");
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
    await page.locator(".cam-confirm .btn").first().click();
    const r = await resp;
    await page.waitForTimeout(500);
    await shot(page, "resume-retry");
    note(r.ok(), "이어본 뒤 「다시 만들기」 → 새 요청 성공", `HTTP ${r.status()} ${await r.text()}`);
  } else note(true, "이어본 뒤 「다시 만들기」 → 동의/인물 고르기부터", where);
  await ctx.close();

  // 4) 다른 기기: ?job= 링크만으로 이어보기
  {
    const c2 = await newCtx(browser); const p2 = await c2.newPage();
    const payload = Buffer.from(JSON.stringify({ at: Date.now() - 10000, video: "/videos/simni-stream.mp4" })).toString("base64url");
    await p2.goto(`${BASE}/v/simni-stream?job=mock.${payload}&lang=en`);
    const ok = await p2.waitForSelector(".result", { timeout: 10000 }).then(() => true).catch(() => false);
    note(ok, "다른 기기 ?job= 링크로 완성 화면");
    await c2.close();
  }
  if (errs.length) note(false, "이어보기 콘솔 오류", errs.slice(0, 3).join(" | "));
}

async function returnPaths(browser) {
  const ctx = await newCtx(browser); const page = await ctx.newPage();
  await page.goto(`${BASE}/?return=${encodeURIComponent("https://map.example.com/spot/12")}&lang=zh`);
  await page.waitForTimeout(400);
  const href = await page.locator("header .map-btn").getAttribute("href").catch(() => null);
  const box = await page.locator("header .map-btn").boundingBox().catch(() => null);
  await shot(page, "return-header");
  note(href === "https://map.example.com/spot/12", "?return= → 헤더 지도 버튼", `${href} ${box ? Math.round(box.width) + "px" : ""}`);
  await check(page, "zh 홈(지도 버튼)");
  // 다른 화면으로 갔다 돌아와도(파라미터 없이) 남는가
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(300);
  note(await page.locator("header .map-btn").count() === 1, "?return= 기억(파라미터 없이 다시 열어도)");
  // 4개 언어 모두 헤더 안에 들어가는가
  for (const l of ["ko", "zh", "en", "ja"]) {
    await page.goto(`${BASE}/?lang=${l}`);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const h = document.querySelector("header.top"); const t = h.querySelector("h1"); const b = h.querySelector(".map-btn");
      const tr = t.getBoundingClientRect(), br = b?.getBoundingClientRect();
      return { overlap: br ? br.right > tr.left + 2 && t.scrollWidth > t.clientWidth : false, clipped: t.scrollWidth > t.clientWidth };
    });
    if (r.clipped || r.overlap) note(false, `${l} 헤더 제목 잘림/겹침`, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/${l}-header.png`, clip: { x: 0, y: 0, width: 360, height: 60 } });
  }
  await ctx.close();
  const c2 = await newCtx(browser); const p2 = await c2.newPage();
  await p2.goto(`${BASE}/?return=${encodeURIComponent("javascript:alert(1)")}`);
  await p2.waitForTimeout(300);
  note(await p2.locator("header .map-btn").count() === 0, "javascript: 주소는 거부");
  await c2.close();
}

async function selfieEdge(browser) {
  // 카메라 거부 → 사진 고르기 버튼
  const ctx = await newCtx(browser, { permissions: [] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); });
  await page.goto(`${BASE}/v/hwagae-tea?lang=ja`);
  await page.locator(".cast .tile").first().click();
  await page.locator(".agree-all").click();
  await page.locator(".foot .btn").click();
  await page.waitForTimeout(500);
  const err = await page.locator(".cam-err").innerText().catch(() => "");
  await shot(page, "ja-camera-denied");
  // 앨범 사진 올리기
  await page.setInputFiles('input[type="file"]', require("path").join(__dirname, "../public/videos/hwagae-food-man.jpg"));
  const got = await page.waitForSelector(".cam img", { timeout: 4000 }).then(() => true).catch(() => false);
  note(!!err && got, "카메라 거부 → 안내 + 사진 올리기", err.slice(0, 40));
  // 이미지가 아닌 파일
  await page.locator(".cam-confirm .btn.sub").click().catch(() => {});
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const only = process.argv[2];
  if (!only || only === "flow") for (const l of ["ko", "zh", "en", "ja"]) await fullFlow(browser, l).catch((e) => note(false, `${l} 전체 흐름 예외`, e.message.split("\n")[0]));
  if (!only || only === "fail") await failurePaths(browser).catch((e) => note(false, "실패 경로 예외", e.message.split("\n")[0]));
  if (!only || only === "resume") await resumePaths(browser).catch((e) => note(false, "이어보기 예외", e.message.split("\n")[0]));
  if (!only || only === "return") await returnPaths(browser).catch((e) => note(false, "지도 버튼 예외", e.message.split("\n")[0]));
  if (!only || only === "selfie") await selfieEdge(browser).catch((e) => note(false, "셀카 예외", e.message.split("\n")[0]));
  await browser.close();
  fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
  console.log(`\n${findings.filter((f) => !f.ok).length} FAIL / ${findings.length}`);
})();
