"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import type { Localized, MsgKey } from "@/lib/i18n";
import { errKey } from "@/lib/i18n";
import { NOOP_PSNR_DB, psnrAgainstSource } from "@/lib/frameCheck";
import { readReturnUrl } from "@/lib/returnTo";
import { forgetJobsFor, latestJobFor, resumeUrl, saveJob } from "@/lib/myJobs";
import { checkPhoto, preloadFaceCheck, type PhotoCheck } from "@/lib/faceCheck";
import { track } from "@/lib/track";
import { Frame, TopBar } from "../../HomeView";
import { useLang, useToast } from "../../LangProvider";
import { Chevron, Clock, Close, Megaphone, Photo, Save, Tick } from "../../icons";

type ConsentProps = { version: string; items: { id: string; title: Localized; body: Localized[] }[] };
type Step = "intro" | "consent" | "selfie" | "working" | "done";
type Status = { state: "queued"; position?: number } | { state: "running" } | { state: "done"; videoUrl: string } | { state: "failed"; code: string };

const POLL_MS = 4000;
// 보통 3~6분. 그보다 길면 대기열이 밀린 것이라 안내를 바꾼다.
// 한 작업이 10분이 지나도 아직 대기열이면 포기하고 대기열에서 뺀다 (시작 전이라 요금 없음).
// 이미 만들기 시작한 작업은 취소해도 요금이 나가고 보통 4~5분이면 끝나므로 15분까지는 기다린다.
// 시간은 작업마다 따로 잰다: 무변화·오류 자동 재시도로 새 작업을 맡기면 다시 10분을 준다.
const SLOW_S = 6 * 60;
const GIVE_UP_QUEUED_S = 10 * 60;
const GIVE_UP_RUNNING_S = 15 * 60;
// 다시 찍을 필요 없이 같은 사진으로 다시 해 볼 만한 실패 (서버 오류·혼잡·시간 초과)
const RETRYABLE = new Set(["generic", "busy", "timeout", "network"]);
const SELFIE_MAX_PX = 1280;
// 셀카(약 0.3MB) 보내기 제한. 응답이 없으면 끝없이 「사진 보내는 중」에 머물던 것을 막는다.
const UPLOAD_TIMEOUT_MS = 60_000;
// 결과 영상을 받다가 이만큼 한 바이트도 안 오면 끊고 우리 서버를 거쳐 다시 받는다
const FETCH_STALL_MS = 20_000;
// 2단계 막대를 채우는 기준: 8초·768P 실측 생성 시간 (2026-11-06 271초)
const TYPICAL_RUN_S = 270;
const HEAD: Record<Exclude<Step, "intro">, MsgKey> = { consent: "consent.head", selfie: "selfie.head", working: "work.head", done: "done.head" };
const LINES: MsgKey[] = ["work.line1", "work.line2", "work.line3", "work.line4"];

export default function SwapFlow({ video, consent }: { video: Video; consent: ConsentProps }) {
  const { t, pick } = useLang();
  const [step, setStep] = useState<Step>("intro");
  const [agreed, setAgreed] = useState<string[]>([]);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [role, setRole] = useState(video.cast[0].id);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // 앱을 닫았다 다시 열어도 이어 보기: ?job= 링크가 먼저, 없으면 이 기기에서 이 장면으로 만든 마지막 작업
  useEffect(() => {
    const fromLink = new URLSearchParams(location.search).get("job");
    const saved = latestJobFor(video.id);
    const job = fromLink && fromLink !== saved?.jobId ? { jobId: fromLink, resultUrl: undefined, at: undefined } : saved;
    if (!job) return;
    setJobId(job.jobId);
    if (job.at) setStartedAt(job.at);
    if (job.resultUrl) { setResultUrl(job.resultUrl); setStep("done"); }
    else setStep("working");
  }, [video.id]);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const saveJobId = useCallback((id: string | null) => {
    setJobId(id);
    if (id) saveJob({ jobId: id, videoId: video.id });
  }, [video.id]);

  // 앱을 다시 열어 이어 본 경우엔 동의와 고른 인물이 남아 있지 않으므로 인물 고르기부터 다시 한다
  // (그대로 셀카로 가면 서버가 동의 없음으로 거절한다)
  const reset = () => {
    forgetJobsFor(video.id);
    const consented = consent.items.every((c) => agreed.includes(c.id));
    setJobId(null); setResultUrl(null); setResultFile(null); setSelfie(null); setStartedAt(null); setStep(consented ? "selfie" : "intro");
  };

  const back = step === "consent" ? () => setStep("intro") : step === "selfie" ? () => setStep("consent") : undefined;

  return (
    <div className="page">
      <TopBar
        title={step === "intro" ? pick(video.title) : t(HEAD[step])}
        back={step === "working" ? undefined : back ? { label: t("common.back"), onClick: back } : { label: t("common.list"), href: "/" }}
      />

      {step === "intro" && <IntroStep video={video} onPick={(id) => { setRole(id); setStep("consent"); }} />}

      {step === "consent" && <ConsentStep consent={consent} agreed={agreed} setAgreed={setAgreed} onNext={() => setStep("selfie")} />}

      {step === "selfie" && <SelfieStep onDone={(blob) => { setSelfie(blob); setStep("working"); }} />}

      {step === "working" && (
        <WorkingStep
          videoId={video.id}
          videoSrc={video.src}
          role={role}
          consentVersion={consent.version}
          agreed={agreed}
          selfie={selfie}
          jobId={jobId}
          startedAt={startedAt}
          setJobId={saveJobId}
          onDone={(url, file) => { setResultUrl(url); setResultFile(file); if (jobId) saveJob({ jobId, videoId: video.id, resultUrl: url }); setStep("done"); }}
          onRetry={reset}
        />
      )}

      {step === "done" && resultUrl && <ResultStep video={video} resultUrl={resultUrl} initialFile={resultFile} onRetry={reset} />}
    </div>
  );
}

/** 진행 막대: 칸을 똑같이 나눠 지나온 칸은 녹차, 남은 칸은 회색 */
function Steps({ at }: { at: 0 | 1 | 2 }) {
  const { t } = useLang();
  const keys: MsgKey[] = ["step.consent", "step.selfie", "step.make"];
  return (
    <div className="steps">
      <div className="cells" aria-hidden>{keys.map((k, i) => <i key={k} className={i <= at ? "on" : undefined} />)}</div>
      <p><b>{at + 1}/{keys.length}</b>{t(keys[at])}</p>
    </div>
  );
}

function IntroStep({ video, onPick }: { video: Video; onPick: (id: string) => void }) {
  const { t, pick } = useLang();
  const many = video.cast.length > 1;
  return (
    <>
      <section className="stage">
        <Frame poster={video.poster}>
          <video src={video.src} poster={video.poster} muted loop autoPlay playsInline aria-hidden />
        </Frame>
        <div className="stage-body">
          <div className="chips"><span className="chip"><Clock />{video.seconds}{t("common.sec")}</span></div>
          <h2 className="title">{pick(video.title)}</h2>
          <p>{pick(video.description)}</p>
        </div>
      </section>

      <div className="band" style={{ marginTop: 24 }} />
      <div className="cast-h">
        <h2>{t(many ? "intro.who" : "intro.whoSingle")}</h2>
        <p>{t("intro.note")}</p>
      </div>
      {many ? (
        <div className="cast">
          {video.cast.map((c) => (
            <button key={c.id} className="card tile" onClick={() => onPick(c.id)}>
              <span className="ph" style={c.photo ? { backgroundImage: `url(${c.photo})` } : undefined} />
              <span className="who">
                <b>{pick(c.label)}</b>
                <span>{t("intro.become")}<Chevron /></span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="solo">
          <button className="btn" onClick={() => onPick(video.cast[0].id)}>{t("intro.start")}</button>
        </div>
      )}
      <div className="foot">
        <Link className="text-btn" href="/">{t("done.other")}</Link>
      </div>
    </>
  );
}

function ConsentStep({ consent, agreed, setAgreed, onNext }: {
  consent: ConsentProps; agreed: string[]; setAgreed: (v: string[]) => void; onNext: () => void;
}) {
  const { t, pick } = useLang();
  const [toast, toastNode] = useToast();
  const all = consent.items.every((c) => agreed.includes(c.id));
  const toggle = (id: string) => setAgreed(agreed.includes(id) ? agreed.filter((a) => a !== id) : [...agreed, id]);
  return (
    <>
      <Steps at={0} />
      <section className="screen">
        <h2 className="h-screen">{t("consent.title")}</h2>
        <p className="lead">{t("consent.sub")}</p>
        <button className="card agree-all" aria-pressed={all} onClick={() => setAgreed(all ? [] : consent.items.map((c) => c.id))}>
          <span className="check"><Tick /></span>
          {t("consent.all")}
        </button>
        <div className="rows">
          {consent.items.map((c) => (
            <div className="row-wrap" key={c.id}>
              <button className="row" aria-pressed={agreed.includes(c.id)} onClick={() => toggle(c.id)}>
                <span className="check"><Tick /></span>
                <span>{pick(c.title)}</span>
              </button>
              <details>
                <summary>{t("consent.view")}</summary>
                <ul>{c.body.map((b) => <li key={b.en}>{pick(b)}</li>)}</ul>
              </details>
            </div>
          ))}
        </div>
      </section>
      <div className="foot">
        {/* 못 누르는 회색 버튼 대신, 살려 두고 누르면 무엇이 모자란지 토스트로 알린다 */}
        <button className="btn" onClick={() => (all ? onNext() : toast(t("consent.need")))}>{t("consent.next")}</button>
      </div>
      {toastNode}
    </>
  );
}

/** 이미지(촬영 프레임 또는 앨범 사진)를 긴 변 1280px JPEG로 맞춘다. 서버가 data URI로 그대로 넘긴다. */
async function toJpeg(src: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, SELFIE_MAX_PX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
}

function SelfieStep({ onDone }: { onDone: (b: Blob) => void }) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<MsgKey | null>(null);
  const [camFailed, setCamFailed] = useState(false);
  // 휴대폰 안 사진 점검 결과. null이면 점검 중
  const [check, setCheck] = useState<PhotoCheck | null>(null);

  useEffect(() => { preloadFaceCheck(); }, []);
  useEffect(() => {
    if (!shot) return;
    let alive = true;
    setCheck(null);
    checkPhoto(shot.blob).then((c) => {
      if (!alive) return;
      setCheck(c);
      if (c.issue || c.skipped) track("photo_check", { issue: c.issue ?? undefined, skipped: c.skipped });
    });
    return () => { alive = false; };
  }, [shot]);

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then(setStream)
      .catch(() => setCamFailed(true)) ?? setCamFailed(true);
  }, []);
  useEffect(() => {
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, [stream]);
  // 「다시 찍기」로 미리보기 <video>가 새로 그려질 때마다 카메라를 다시 붙인다 (안 그러면 검은 화면에 셔터도 안 먹음)
  useEffect(() => {
    if (!shot && videoRef.current && stream && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
  }, [stream, shot]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const keep = (blob: Blob | null) => { if (blob) { setError(null); setShot({ blob, url: URL.createObjectURL(blob) }); } };

  const use = (blob: Blob) => { stream?.getTracks().forEach((tr) => tr.stop()); onDone(blob); };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    keep(await toJpeg(v, v.videoWidth, v.videoHeight));
  };

  const pickFile = async (f?: File) => {
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const bmp = await createImageBitmap(f);
      keep(await toJpeg(bmp, bmp.width, bmp.height));
    } catch {
      setError("selfie.badFile");
    }
  };

  const album = (
    <label className="side right">
      <span className="sq">
        <Photo />
      </span>
      {t("selfie.album")}
      <input type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
    </label>
  );

  return (
    <div className="cam-screen">
      <div className="cam">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.url} alt="" />
        ) : (
          <>
            <video ref={videoRef} className="mirror" playsInline muted autoPlay />
            <div className="ring" aria-hidden />
          </>
        )}
        {!shot && (
          <div className="cam-copy">
            <h2>{t("selfie.title")}</h2>
            <p>{t("selfie.tip")}</p>
          </div>
        )}
        {!shot && (camFailed || error) && <p className="cam-err">{t(error ?? "selfie.noCam")}</p>}
      </div>

      {shot ? (
        <div className="cam-confirm foot">
          {check?.issue && <p className="photo-issue" role="alert">{t(`photo.${check.issue}` as MsgKey)}</p>}
          {check?.issue ? (
            <>
              <button className="btn" onClick={() => setShot(null)}>{t("selfie.retake")}</button>
              <button className="btn sub" onClick={() => { track("photo_check", { issue: check.issue, anyway: true }); use(shot.blob); }}>{t("photo.anyway")}</button>
            </>
          ) : (
            <>
              <button className="btn" disabled={!check} onClick={() => use(shot.blob)}>{t(check ? "selfie.use" : "photo.checking")}</button>
              <button className="btn sub" onClick={() => setShot(null)}>{t("selfie.retake")}</button>
            </>
          )}
        </div>
      ) : stream ? (
        <div className="cam-bar">
          <span />
          <button className="shutter" onClick={capture} aria-label={t("selfie.shoot")} />
          {album}
        </div>
      ) : (
        <div className="cam-confirm">
          <label className="btn">
            {t("selfie.pickPhoto")}
            <input type="file" accept="image/*" capture="user" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        </div>
      )}
    </div>
  );
}

/** 셀카를 보낸다. fetch는 올리는 진행률을 못 보여 주고 시간 제한도 없어서 XHR로 보낸다. */
function postJob(fd: FormData, onPct: (p: number) => void): Promise<{ ok: boolean; json: { jobId?: string; code?: string } }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/jobs");
    x.timeout = UPLOAD_TIMEOUT_MS;
    x.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let json = {};
      try { json = JSON.parse(x.responseText); } catch {}
      resolve({ ok: x.status >= 200 && x.status < 300, json });
    };
    x.onerror = () => reject(new Error("network"));
    x.ontimeout = () => reject(new Error("network"));
    x.send(fd);
  });
}

/** 결과 영상을 받으며 진행률을 알린다. 한동안 한 바이트도 안 오면 끊는다. */
async function fetchProgress(url: string, onBytes: (got: number, total: number) => void): Promise<Blob> {
  const ctl = new AbortController();
  let stall = setTimeout(() => ctl.abort(), FETCH_STALL_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok || !r.body) throw new Error(String(r.status));
    const total = Number(r.headers.get("content-length")) || 0;
    const reader = r.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      onBytes(got, total);
      clearTimeout(stall);
      stall = setTimeout(() => ctl.abort(), FETCH_STALL_MS);
    }
    return new Blob(parts as BlobPart[], { type: r.headers.get("content-type") || "video/mp4" });
  } finally {
    clearTimeout(stall);
  }
}

type Phase = "upload" | "queue" | "make" | "fetch";

function WorkingStep({ videoId, videoSrc, role, consentVersion, agreed, selfie, jobId, startedAt, setJobId, onDone, onRetry }: {
  videoId: string; videoSrc: string; role: string; consentVersion: string; agreed: string[]; selfie: Blob | null; jobId: string | null;
  startedAt: number | null; setJobId: (id: string | null) => void; onDone: (url: string, file: File | null) => void; onRetry: () => void;
}) {
  const { t } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const retried = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [fetchBytes, setFetchBytes] = useState<{ got: number; total: number } | null>(null);
  const [netWeak, setNetWeak] = useState(false);
  const t0 = useRef(startedAt ?? Date.now());
  const jobT0 = useRef(startedAt ?? Date.now());
  // 이 작업이 「만드는 중」으로 바뀐 때 (단계 2의 경과 시간)
  const runT0 = useRef<number | null>(null);
  const [toast, toastNode] = useToast();
  const submitted = useRef(false);
  // 부모가 매 렌더마다 새 콜백을 넘겨도 조회 루프가 다시 시작되지 않게 ref로 둔다
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 작업 등록 (한 번만)
  useEffect(() => {
    if (jobId || !selfie || submitted.current || error) return;
    submitted.current = true;
    setUploadPct(0);
    const fd = new FormData();
    fd.append("videoId", videoId);
    fd.append("role", role);
    fd.append("consentVersion", consentVersion);
    agreed.forEach((a) => fd.append("consent", a));
    fd.append("selfie", selfie, "selfie.jpg");
    const sentAt = Date.now();
    postJob(fd, setUploadPct)
      .then(({ ok, json }) => {
        if (!ok || !json.jobId) {
          track("submit_failed", { video: videoId, code: json.code ?? "generic" });
          return setError(json.code ?? "generic");
        }
        track("submitted", { video: videoId, job: json.jobId, s: (Date.now() - sentAt) / 1000, retry: retried.current });
        jobT0.current = Date.now();
        runT0.current = null;
        setJobId(json.jobId);
      })
      .catch(() => {
        // 응답을 못 받은 것: 서버엔 닿았을 수도 있어 자동으로 또 보내지 않는다 (요금이 두 번 나갈 수 있음)
        track("submit_failed", { video: videoId, code: "network", s: (Date.now() - sentAt) / 1000 });
        setError("network");
      });
  }, [jobId, selfie, videoId, role, consentVersion, agreed, setJobId, error]);

  // 같은 셀카로 새 작업을 맡긴다 (자동 재시도와 실패 화면의 「같은 사진으로 다시」)
  const again = useCallback(() => {
    retried.current = true;
    submitted.current = false;
    setStatus(null);
    setError(null);
    setFetchBytes(null);
    setJobId(null);
  }, [setJobId]);

  // 상태 조회
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let lastState: "queued" | "running" = "running";
    let misses = 0;
    const finish = async (videoUrl: string) => {
      track("generated", { job: jobId, s: runT0.current ? (Date.now() - runT0.current) / 1000 : undefined });
      // 3단계: 결과 영상을 이 휴대폰으로 받는다 (저장 버튼과 재생이 이 파일을 쓴다). 막히면 우리 서버를 거쳐 받는다.
      const fetchAt = Date.now();
      let file: File | null = null;
      setFetchBytes({ got: 0, total: 0 });
      const onBytes = (got: number, total: number) => { if (!stop) setFetchBytes({ got, total }); };
      const sameOrigin = new URL(videoUrl, location.href).origin === location.origin;
      try {
        const blob = await fetchProgress(videoUrl, onBytes).catch((e) => {
          if (sameOrigin || stop) throw e;
          return fetchProgress(`/api/download?url=${encodeURIComponent(videoUrl)}`, onBytes);
        });
        file = new File([blob], "hwagae-starring-me.mp4", { type: blob.type || "video/mp4" });
        track("downloaded", { job: jobId, s: (Date.now() - fetchAt) / 1000, mb: blob.size / 1e6 });
      } catch {
        // 못 받아도 완성 화면은 보여 준다 (영상은 fal 주소로 재생, 저장은 새 탭)
        track("download_failed", { job: jobId, s: (Date.now() - fetchAt) / 1000 });
      }
      if (stop) return;
      // 엔진이 원본을 거의 그대로 돌려주는 경우가 있어, 그러면 같은 셀카로 한 번 더 요청한다.
      // 받아 둔 파일로 비교하므로 금방 끝난다. 못 받았으면 비교도 못 하니 건너뛴다.
      let db: number | null = null;
      if (file) {
        setChecking(true);
        const local = URL.createObjectURL(file);
        db = await psnrAgainstSource(videoSrc, local);
        URL.revokeObjectURL(local);
      }
      if (stop) return;
      setChecking(false);
      if (db !== null && db > NOOP_PSNR_DB && !retried.current && selfie) {
        track("noop_retry", { job: jobId });
        return again();
      }
      onDoneRef.current(videoUrl, file);
    };
    const poll = async () => {
      if (stop || busy) return;
      busy = true;
      clearTimeout(timer);
      try {
        const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const s: Status | { state: "unknown" } = await r.json();
        if (stop) return;
        misses = 0;
        setNetWeak(false);
        // unknown: 상태 조회만 잠깐 실패한 것. 작업은 fal에서 계속되므로 새로 맡기지 않고 다음 조회를 기다린다
        if (s.state !== "unknown") setStatus(s);
        if (s.state === "running" && runT0.current === null) {
          runT0.current = Date.now();
          track("started", { job: jobId, s: (Date.now() - jobT0.current) / 1000 });
        }
        if (s.state === "queued" || s.state === "running") lastState = s.state;
        if (s.state === "done") return void (await finish(s.videoUrl));
        if (s.state === "failed") {
          track("failed", { job: jobId, code: s.code, stage: lastState, retry: retried.current });
          // 서버 쪽 일시 오류는 같은 사진으로 한 번 자동으로 다시 맡긴다
          if (RETRYABLE.has(s.code) && !retried.current && selfie) return again();
          return setError(s.code);
        }
      } catch {
        // 응답을 못 받음: 대개 휴대폰 인터넷 문제. 몇 번 연달아면 화면에 알린다 (작업은 fal에서 계속된다)
        if (stop) return;
        misses++;
        if (misses === 3) track("net_weak", { job: jobId });
        if (misses >= 3 || !navigator.onLine) setNetWeak(true);
      } finally {
        busy = false;
      }
      if (stop) return;
      // 조회가 계속 실패해도 끝없이 기다리지 않게 시간 제한은 조회 성공 여부와 상관없이 본다
      const age = (Date.now() - jobT0.current) / 1000;
      if (age > (lastState === "queued" ? GIVE_UP_QUEUED_S : GIVE_UP_RUNNING_S)) {
        fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => {});
        track("failed", { job: jobId, code: "timeout", stage: lastState, retry: retried.current });
        return setError("timeout");
      }
      timer = setTimeout(poll, POLL_MS);
    };
    // 화면을 껐다 켜거나 다른 앱에서 돌아오면 바로 확인한다 (그동안 휴대폰이 조회를 멈춰 둔다)
    const wake = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [jobId, videoSrc, selfie, again]);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [error]);

  // 다른 브라우저나 기기에서도 이어 볼 수 있도록 링크를 넘긴다
  const shareLink = async () => {
    if (!jobId) return;
    const url = resumeUrl(videoId, jobId);
    try {
      if (navigator.share) return await navigator.share({ url });
      await navigator.clipboard.writeText(url);
      toast(t("work.copied"));
    } catch {}
  };

  if (error) {
    return (
      <>
        <div className="empty" role="alert">
          <div className="circle"><Close /></div>
          <h1>{t("work.failTitle")}</h1>
          <p>{t(errKey(error))}</p>
        </div>
        <div className="foot">
          {selfie && RETRYABLE.has(error) ? (
            <>
              <button className="btn" onClick={() => { t0.current = Date.now(); setElapsed(0); again(); }}>{t("work.again.btn")}</button>
              <button className="btn sub" style={{ marginTop: 12 }} onClick={onRetry}>{t("work.retry")}</button>
            </>
          ) : (
            <button className="btn" onClick={onRetry}>{t("work.retry")}</button>
          )}
          <Link className="text-btn" href="/">{t("done.other")}</Link>
        </div>
      </>
    );
  }

  const phase: Phase = fetchBytes ? "fetch" : !jobId ? "upload" : status?.state === "running" ? "make" : status?.state === "queued" ? "queue" : runT0.current ? "make" : "queue";
  const runS = runT0.current ? Math.max(0, Math.floor((Date.now() - runT0.current) / 1000)) : 0;
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const mb = (b: number) => (b / 1e6).toFixed(1);
  const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((a, [k, x]) => a.replace(`{${k}}`, String(x)), s);

  const label: MsgKey = checking ? "work.checking"
    : phase === "fetch" ? "work.fetching"
    : phase === "upload" ? (retried.current ? "work.again" : "work.sending")
    : phase === "queue" ? "work.queued"
    : LINES[Math.floor(elapsed / 12) % LINES.length];

  const order: Phase[] = ["upload", "make", "fetch"];
  const at = order.indexOf(phase === "queue" ? "upload" : phase);
  const pos = status?.state === "queued" ? status.position : undefined;
  const stages: { key: MsgKey; detail?: string; bar?: number }[] = [
    {
      key: "stage.receive",
      detail: phase === "upload" ? fill(t("stage.sending"), { pct: uploadPct })
        : phase === "queue" ? (pos ? fill(t("stage.queued"), { n: pos }) : t("stage.next"))
        : t("stage.received"),
      bar: phase === "upload" ? uploadPct : undefined,
    },
    {
      key: "stage.make",
      detail: phase === "make" ? fill(t("stage.making"), { t: clock(runS) }) : at > 1 ? t("stage.made") : undefined,
      // 남은 시간을 알 수 없어 보통 걸리는 시간(약 4분 30초)에 맞춰 채우고 95%에서 멈춘다
      bar: phase === "make" ? Math.min(95, (runS / TYPICAL_RUN_S) * 100) : undefined,
    },
    {
      key: "stage.fetch",
      detail: checking ? t("stage.checking")
        : phase === "fetch" && fetchBytes ? (fetchBytes.total ? fill(t("stage.fetching"), { pct: Math.round((fetchBytes.got / fetchBytes.total) * 100), a: mb(fetchBytes.got), b: mb(fetchBytes.total) }) : fill(t("stage.fetchingMb"), { a: mb(fetchBytes.got) }))
        : undefined,
      bar: phase === "fetch" && fetchBytes?.total ? (fetchBytes.got / fetchBytes.total) * 100 : undefined,
    },
  ];

  return (
    <>
      <Steps at={2} />
      <div className="making" role="status" aria-live="polite">
        <Frame>
          <video src={videoSrc} muted loop autoPlay playsInline aria-hidden />
          <span className="elapsed"><Clock />{clock(elapsed)}</span>
        </Frame>
        <h2 key={label}>{t(label)}</h2>
        {retried.current && <p className="wait">{t("work.retrying")}</p>}
        <ol className="stages">
          {stages.map((s, i) => (
            <li key={s.key} data-s={i < at ? "done" : i === at ? "now" : "todo"}>
              <span className="dot">{i < at ? <Tick /> : i + 1}</span>
              <div>
                <b>{t(s.key)}</b>
                {s.detail && <p>{s.detail}</p>}
                {i === at && (s.bar === undefined ? <div className="track"><i /></div> : <div className="track fill"><i style={{ width: `${Math.max(3, s.bar)}%` }} /></div>)}
              </div>
            </li>
          ))}
        </ol>
        {netWeak && <div className="notice warn" role="alert"><Megaphone /><span>{t("net.weak")}</span></div>}
        {elapsed >= SLOW_S && phase !== "fetch" && <p className="wait">{t("work.slow")}</p>}
        <div className="notice"><Megaphone /><span>{t("work.bg")}</span></div>
      </div>
      <div className="foot">
        {jobId && <button className="btn sub" onClick={shareLink}>{t("work.link")}</button>}
      </div>
      {toastNode}
    </>
  );
}
/** 결과 영상을 같은 출처 Blob으로 받아 둔다. 다른 출처 링크는 휴대폰에서 저장 대신 새 탭으로 열리기 때문. */
// fal.media는 CORS를 열어 두어(Access-Control-Allow-Origin: *) 바로 받는다. 막히면 /api/download 통로로 받는다.
// 둘 다 실패하면(링크 만료 등) failed를 돌려 버튼이 「준비 중」에 멈추지 않고 새 탭 열기로 넘어가게 한다.
function useResultFile(resultUrl: string, initialFile: File | null) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // 만드는 화면 3단계에서 이미 받아 왔으면 다시 받지 않는다
    if (initialFile) return setFile(initialFile);
    let alive = true;
    setFile(null); setFailed(false);
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
    const sameOrigin = new URL(resultUrl, location.href).origin === location.origin;
    (sameOrigin ? get(resultUrl) : get(resultUrl).catch(() => get(`/api/download?url=${encodeURIComponent(resultUrl)}`)))
      .then((b) => { if (alive) setFile(new File([b], "hwagae-starring-me.mp4", { type: b.type || "video/mp4" })); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [resultUrl, initialFile]);
  return { file, failed };
}

function ResultStep({ video, resultUrl, initialFile, onRetry }: { video: Video; resultUrl: string; initialFile: File | null; onRetry: () => void }) {
  const { t } = useLang();
  const [original, setOriginal] = useState(false);
  const { file, failed } = useResultFile(resultUrl, initialFile);
  // 받아 둔 파일이 있으면 그것을 재생한다 (휴대폰 데이터를 한 번 더 쓰지 않게)
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setFileUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  useEffect(() => { setMapUrl(readReturnUrl()); }, []);
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  // 휴대폰은 공유 시트의 "동영상 저장"이 갤러리로 가는 길이다. 공유가 안 되는 브라우저는 파일 다운로드로.
  const save = async () => {
    if (!file) return void window.open(resultUrl, "_blank", "noopener");
    if (canShare) {
      try { return await navigator.share({ files: [file] }); } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  return (
    <>
      <section className="result">
        <Frame poster={video.poster}>
          <video key={original ? "o" : "r"} src={original ? video.src : fileUrl ?? resultUrl} playsInline autoPlay loop muted />
        </Frame>
        <div className="stage-body">
          <div className="chips"><span className="chip done"><Tick />{t("done.head")}</span></div>
          <h2 className="title">{t("done.title")}</h2>
          <div className="chips seg" role="group">
            <button className="chip" aria-pressed={!original} onClick={() => setOriginal(false)}>{t("done.after")}</button>
            <button className="chip" aria-pressed={original} onClick={() => setOriginal(true)}>{t("done.before")}</button>
          </div>
        </div>
      </section>
      <div className="foot">
        {/* 준비 중일 때는 버튼 글자가 이유를 말하므로 회색으로 둔다 */}
        <button className="btn" onClick={save} disabled={!file && !failed}><Save />{t(file || failed ? "done.save" : "done.preparing")}</button>
        {canShare && <p className="small">{t("done.saveHint")}</p>}
        <button className="btn sub" style={{ marginTop: 12 }} onClick={onRetry}>{t("done.retry")}</button>
        <Link className="text-btn" href="/">{t("done.other")}</Link>
        {mapUrl && <a className="text-btn" href={mapUrl}>{t("map.back")}</a>}
        <p className="terms" style={{ marginTop: 16 }}>{t("done.keep")}</p>
      </div>
    </>
  );
}
