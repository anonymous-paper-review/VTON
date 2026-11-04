"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import type { Localized, MsgKey } from "@/lib/i18n";
import { errKey } from "@/lib/i18n";
import { NOOP_PSNR_DB, psnrAgainstSource } from "@/lib/frameCheck";
import { readReturnUrl } from "@/lib/returnTo";
import { forgetJobsFor, latestJobFor, resumeUrl, saveJob } from "@/lib/myJobs";
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
const RETRYABLE = new Set(["generic", "busy", "timeout"]);
const SELFIE_MAX_PX = 1280;
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
    setJobId(null); setResultUrl(null); setSelfie(null); setStartedAt(null); setStep(consented ? "selfie" : "intro");
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
          onDone={(url) => { setResultUrl(url); if (jobId) saveJob({ jobId, videoId: video.id, resultUrl: url }); setStep("done"); }}
          onRetry={reset}
        />
      )}

      {step === "done" && resultUrl && <ResultStep video={video} resultUrl={resultUrl} onRetry={reset} />}
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
          <button className="btn" onClick={() => { stream?.getTracks().forEach((tr) => tr.stop()); onDone(shot.blob); }}>{t("selfie.use")}</button>
          <button className="btn sub" onClick={() => setShot(null)}>{t("selfie.retake")}</button>
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

function WorkingStep({ videoId, videoSrc, role, consentVersion, agreed, selfie, jobId, startedAt, setJobId, onDone, onRetry }: {
  videoId: string; videoSrc: string; role: string; consentVersion: string; agreed: string[]; selfie: Blob | null; jobId: string | null;
  startedAt: number | null; setJobId: (id: string | null) => void; onDone: (url: string) => void; onRetry: () => void;
}) {
  const { t } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const retried = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef(startedAt ?? Date.now());
  const jobT0 = useRef(startedAt ?? Date.now());
  const [toast, toastNode] = useToast();
  const submitted = useRef(false);
  // 부모가 매 렌더마다 새 콜백을 넘겨도 조회 루프가 다시 시작되지 않게 ref로 둔다
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 작업 등록 (한 번만)
  useEffect(() => {
    if (jobId || !selfie || submitted.current || error) return;
    submitted.current = true;
    const fd = new FormData();
    fd.append("videoId", videoId);
    fd.append("role", role);
    fd.append("consentVersion", consentVersion);
    agreed.forEach((a) => fd.append("consent", a));
    fd.append("selfie", selfie, "selfie.jpg");
    fetch("/api/jobs", { method: "POST", body: fd })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return setError(j.code ?? "generic");
        jobT0.current = Date.now();
        setJobId(j.jobId);
      })
      .catch(() => setError("generic"));
  }, [jobId, selfie, videoId, role, consentVersion, agreed, setJobId, error]);

  // 같은 셀카로 새 작업을 맡긴다 (자동 재시도와 실패 화면의 「같은 사진으로 다시」)
  const again = useCallback(() => {
    retried.current = true;
    submitted.current = false;
    setStatus(null);
    setError(null);
    setJobId(null);
  }, [setJobId]);

  // 상태 조회
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let lastState: "queued" | "running" = "running";
    const poll = async () => {
      try {
        const s: Status | { state: "unknown" } = await (await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })).json();
        if (stop) return;
        // unknown: 상태 조회만 잠깐 실패한 것. 작업은 fal에서 계속되므로 새로 맡기지 않고 다음 조회를 기다린다
        if (s.state !== "unknown") setStatus(s);
        if (s.state === "queued" || s.state === "running") lastState = s.state;
        if (s.state === "done") {
          // 엔진이 원본을 거의 그대로 돌려주는 경우가 있어, 그러면 같은 셀카로 한 번 더 요청한다
          setChecking(true);
          const db = await psnrAgainstSource(videoSrc, s.videoUrl);
          if (stop) return;
          setChecking(false);
          if (db !== null && db > NOOP_PSNR_DB && !retried.current && selfie) return again();
          return onDoneRef.current(s.videoUrl);
        }
        if (s.state === "failed") {
          // 서버 쪽 일시 오류는 같은 사진으로 한 번 자동으로 다시 맡긴다
          if (RETRYABLE.has(s.code) && !retried.current && selfie) return again();
          return setError(s.code);
        }
      } catch {
        // 네트워크가 잠깐 끊기거나 서버가 HTML 오류를 줘도 다음 조회에서 다시 시도
      }
      if (stop) return;
      // 조회가 계속 실패해도 끝없이 기다리지 않게 시간 제한은 조회 성공 여부와 상관없이 본다
      const age = (Date.now() - jobT0.current) / 1000;
      if (age > (lastState === "queued" ? GIVE_UP_QUEUED_S : GIVE_UP_RUNNING_S)) {
        fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => {});
        return setError("timeout");
      }
      if (!stop) setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { stop = true; };
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

  const label: MsgKey = checking ? "work.checking"
    : !jobId ? (retried.current ? "work.again" : "work.sending")
    : status?.state === "queued" ? "work.queued"
    : LINES[Math.floor(elapsed / 12) % LINES.length];
  return (
    <>
      <Steps at={2} />
      <div className="making" role="status" aria-live="polite">
        <Frame>
          <video src={videoSrc} muted loop autoPlay playsInline aria-hidden />
          <span className="elapsed"><Clock />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
        </Frame>
        <h2 key={label}>{t(label)}</h2>
        <p className="wait">
          {status?.state === "queued" && status.position ? t("work.ahead").replace("{n}", String(status.position)) + " " : ""}
          {t(elapsed >= SLOW_S ? "work.slow" : "work.wait")}
        </p>
        <div className="track"><i /></div>
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
function useResultFile(resultUrl: string) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFile(null); setFailed(false);
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
    const sameOrigin = new URL(resultUrl, location.href).origin === location.origin;
    (sameOrigin ? get(resultUrl) : get(resultUrl).catch(() => get(`/api/download?url=${encodeURIComponent(resultUrl)}`)))
      .then((b) => { if (alive) setFile(new File([b], "hwagae-starring-me.mp4", { type: b.type || "video/mp4" })); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [resultUrl]);
  return { file, failed };
}

function ResultStep({ video, resultUrl, onRetry }: { video: Video; resultUrl: string; onRetry: () => void }) {
  const { t } = useLang();
  const [original, setOriginal] = useState(false);
  const { file, failed } = useResultFile(resultUrl);
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
          <video key={original ? "o" : "r"} src={original ? video.src : resultUrl} playsInline autoPlay loop muted />
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
