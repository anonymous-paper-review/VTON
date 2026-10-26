"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import type { Localized, MsgKey } from "@/lib/i18n";
import { errKey } from "@/lib/i18n";
import { NOOP_PSNR_DB, psnrAgainstSource } from "@/lib/frameCheck";
import { forgetJobsFor, latestJobFor, resumeUrl, saveJob } from "@/lib/myJobs";
import { Arrow, Frame, TopBar } from "../../HomeView";
import { useLang } from "../../LangProvider";

type ConsentProps = { version: string; items: { id: string; title: Localized; body: Localized[] }[] };
type Step = "intro" | "consent" | "selfie" | "working" | "done";
type Status = { state: "queued"; position?: number } | { state: "running" } | { state: "done"; videoUrl: string } | { state: "failed"; code: string };

const POLL_MS = 4000;
const SELFIE_MAX_PX = 1280;
const LINES: MsgKey[] = ["work.line1", "work.line2", "work.line3", "work.line4"];

export default function SwapFlow({ video, consent }: { video: Video; consent: ConsentProps }) {
  const { t } = useLang();
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

  const reset = () => {
    forgetJobsFor(video.id);
    setJobId(null); setResultUrl(null); setSelfie(null); setStartedAt(null); setStep("selfie");
  };

  const back = step === "consent" ? () => setStep("intro") : step === "selfie" ? () => setStep("consent") : undefined;

  return (
    <div className="page">
      {step !== "working" && (
        <TopBar back={back ? { label: t("common.back"), onClick: back } : { label: t("common.list"), href: "/" }} />
      )}

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

function Steps({ at }: { at: 0 | 1 | 2 }) {
  const { t } = useLang();
  const keys: MsgKey[] = ["step.consent", "step.selfie", "step.make"];
  return (
    <div className="steps" aria-hidden>
      {keys.map((k, i) => <div key={k} className={i <= at ? "on" : undefined}><b>0{i + 1}</b>{t(k)}</div>)}
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
          <div className="kicker">{video.seconds}{t("common.sec")}</div>
          <h1 className="title-xl">{pick(video.title)}</h1>
          <p>{pick(video.description)}</p>
        </div>
      </section>

      <h2 className="cast-h">{t(many ? "intro.who" : "intro.whoSingle")}</h2>
      <p className="cast-note">{t("intro.note")}</p>
      {many ? (
        <div className="cast">
          {video.cast.map((c) => (
            <button key={c.id} className="tile" style={c.photo ? { backgroundImage: `url(${c.photo})` } : undefined} onClick={() => onPick(c.id)}>
              <span className="who">{pick(c.label)}</span>
              <span className="cta">{t("intro.become")}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="solo">
          <button className="btn" onClick={() => onPick(video.cast[0].id)}>{t("intro.start")} <Arrow /></button>
        </div>
      )}
      <div className="foot">
        <Link className="btn ghost" href="/">{t("done.other")}</Link>
      </div>
    </>
  );
}

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

function ConsentStep({ consent, agreed, setAgreed, onNext }: {
  consent: ConsentProps; agreed: string[]; setAgreed: (v: string[]) => void; onNext: () => void;
}) {
  const { t, pick } = useLang();
  const all = consent.items.every((c) => agreed.includes(c.id));
  const toggle = (id: string) => setAgreed(agreed.includes(id) ? agreed.filter((a) => a !== id) : [...agreed, id]);
  return (
    <>
      <Steps at={0} />
      <section className="screen">
        <h1 className="h-big">{t("consent.title")}</h1>
        <p className="lead">{t("consent.sub")}</p>
        <button className="agree-all" aria-pressed={all} onClick={() => setAgreed(all ? [] : consent.items.map((c) => c.id))}>
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
        <button className="btn" disabled={!all} onClick={onNext}>{t("consent.next")} <Arrow /></button>
      </div>
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
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
    return () => stream?.getTracks().forEach((tr) => tr.stop());
  }, [stream]);
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.6" /></svg>
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
            <h1>{t("selfie.title")}</h1>
            <p>{t("selfie.tip")}</p>
          </div>
        )}
        {!shot && (camFailed || error) && <p className="cam-err">{t(error ?? "selfie.noCam")}</p>}
      </div>

      {shot ? (
        <div className="cam-confirm btns">
          <button className="btn" onClick={() => { stream?.getTracks().forEach((tr) => tr.stop()); onDone(shot.blob); }}>{t("selfie.use")} <Arrow /></button>
          <button className="btn ghost" onClick={() => setShot(null)}>{t("selfie.retake")}</button>
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
  const [copied, setCopied] = useState(false);
  const submitted = useRef(false);
  // 부모가 매 렌더마다 새 콜백을 넘겨도 조회 루프가 다시 시작되지 않게 ref로 둔다
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 작업 등록 (한 번만)
  useEffect(() => {
    if (jobId || !selfie || submitted.current) return;
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
        setJobId(j.jobId);
      })
      .catch(() => setError("generic"));
  }, [jobId, selfie, videoId, role, consentVersion, agreed, setJobId]);

  // 상태 조회
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const poll = async () => {
      try {
        const s: Status = await (await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })).json();
        if (stop) return;
        setStatus(s);
        if (s.state === "done") {
          // 엔진이 원본을 거의 그대로 돌려주는 경우가 있어, 그러면 같은 셀카로 한 번 더 요청한다
          setChecking(true);
          const db = await psnrAgainstSource(videoSrc, s.videoUrl);
          if (stop) return;
          setChecking(false);
          if (db !== null && db > NOOP_PSNR_DB && !retried.current && selfie) {
            retried.current = true;
            submitted.current = false;
            setStatus(null);
            return setJobId(null);
          }
          return onDoneRef.current(s.videoUrl);
        }
        if (s.state === "failed") return setError(s.code);
      } catch {
        // 네트워크가 잠깐 끊겨도 다음 조회에서 다시 시도
      }
      if (!stop) setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { stop = true; };
  }, [jobId, videoSrc, selfie, setJobId]);

  useEffect(() => {
    if (error) return;
    const t0 = startedAt ?? Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [error, startedAt]);

  // 다른 브라우저나 기기에서도 이어 볼 수 있도록 링크를 넘긴다
  const shareLink = async () => {
    if (!jobId) return;
    const url = resumeUrl(videoId, jobId);
    try {
      if (navigator.share) return await navigator.share({ url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {}
  };

  if (error) {
    return (
      <div className="fail" role="alert">
        <div className="kicker">CUT</div>
        <h1 className="h-big" style={{ marginTop: 14 }}>{t("work.failTitle")}</h1>
        <p>{t(errKey(error))}</p>
        <div className="btns" style={{ marginTop: 18 }}>
          <button className="btn" onClick={onRetry}>{t("work.retry")}</button>
          <Link className="btn ghost" href="/">{t("done.other")}</Link>
        </div>
      </div>
    );
  }

  const label: MsgKey = checking ? "work.checking"
    : !jobId ? (retried.current ? "work.again" : "work.sending")
    : status?.state === "queued" ? "work.queued"
    : LINES[Math.floor(elapsed / 12) % LINES.length];
  return (
    <div className="making" role="status" aria-live="polite">
      <video className="bg-video" src={videoSrc} muted loop autoPlay playsInline aria-hidden />
      <span className="rec">REC</span>
      <div className="clock">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
      <h2 key={label}>{t(label)}</h2>
      <p>{t("work.wait")}</p>
      <div className="bar"><i /></div>
      <p className="bg-note">{t("work.bg")}</p>
      {jobId && <button className="btn ghost link-btn" onClick={shareLink}>{t(copied ? "work.copied" : "work.link")}</button>}
    </div>
  );
}

/** 결과 영상을 같은 출처 Blob으로 받아 둔다. 다른 출처 링크는 휴대폰에서 저장 대신 새 탭으로 열리기 때문. */
function useResultFile(resultUrl: string) {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    let alive = true;
    const sameOrigin = new URL(resultUrl, location.href).origin === location.origin;
    const src = sameOrigin ? resultUrl : `/api/download?url=${encodeURIComponent(resultUrl)}`;
    fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { if (alive) setFile(new File([b], "hwagae-starring-me.mp4", { type: b.type || "video/mp4" })); })
      .catch(() => {});
    return () => { alive = false; };
  }, [resultUrl]);
  return file;
}

function ResultStep({ video, resultUrl, onRetry }: { video: Video; resultUrl: string; onRetry: () => void }) {
  const { t } = useLang();
  const [original, setOriginal] = useState(false);
  const file = useResultFile(resultUrl);
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
          <div className="kicker">{t("done.kicker")}</div>
          <h1 className="title-xl">{t("done.title")}</h1>
          <div className="seg" role="group">
            <button aria-pressed={!original} onClick={() => setOriginal(false)}>{t("done.after")}</button>
            <button aria-pressed={original} onClick={() => setOriginal(true)}>{t("done.before")}</button>
          </div>
        </div>
      </section>
      <div className="foot btns">
        <button className="btn" onClick={save} disabled={!file}>{t(file ? "done.save" : "done.preparing")}</button>
        {canShare && <p className="small" style={{ marginTop: 0 }}>{t("done.saveHint")}</p>}
        <div className="two">
          <button className="btn ghost" onClick={onRetry}>{t("done.retry")}</button>
          <Link className="btn ghost" href="/">{t("done.other")}</Link>
        </div>
        <p className="small">{t("done.keep")}</p>
      </div>
    </>
  );
}
