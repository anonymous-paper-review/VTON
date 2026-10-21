"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";

type ConsentProps = { version: string; items: { id: string; title: string; body: string[] }[] };
type Step = "intro" | "consent" | "selfie" | "working" | "done";
type Status = { state: "queued"; position?: number } | { state: "running" } | { state: "done"; videoUrl: string } | { state: "failed"; error: string };

const POLL_MS = 4000;
const SELFIE_MAX_PX = 1280;
const jobKey = (videoId: string) => `vton.job.${videoId}`;

// 새로고침해도 진행 중인 작업을 이어 보도록 sessionStorage에 job id를 둔다 (없어도 동작).
const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { sessionStorage.removeItem(k); } catch {} },
};

export default function SwapFlow({ video, consent }: { video: Video; consent: ConsentProps }) {
  const [step, setStep] = useState<Step>("intro");
  const [agreed, setAgreed] = useState<string[]>([]);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    const saved = store.get(jobKey(video.id));
    if (saved) { setJobId(saved); setStep("working"); }
  }, [video.id]);

  const reset = () => {
    store.del(jobKey(video.id));
    setJobId(null); setResultUrl(null); setSelfie(null); setStep("selfie");
  };

  return (
    <>
      {step === "intro" && (
        <>
          <video src={video.src} poster={video.poster} controls playsInline muted autoPlay loop />
          <h1>{video.title}</h1>
          <p className="muted">{video.description}</p>
          <div className="panel">
            <h2>얼굴 바꾸기 해볼까요?</h2>
            <p className="muted">셀카 한 장을 찍으면 이 영상의 주인공이 내 얼굴로 바뀐 영상을 만들어 드려요. 몇 분 정도 걸려요.</p>
            <div className="btns">
              <button className="btn" onClick={() => setStep("consent")}>네, 해볼게요</button>
              <Link className="btn ghost" href="/">다른 영상 볼게요</Link>
            </div>
          </div>
        </>
      )}

      {step === "consent" && (
        <ConsentStep consent={consent} agreed={agreed} setAgreed={setAgreed} onNext={() => setStep("selfie")} onBack={() => setStep("intro")} />
      )}

      {step === "selfie" && (
        <SelfieStep
          onDone={(blob) => { setSelfie(blob); setStep("working"); }}
          onBack={() => setStep("consent")}
        />
      )}

      {step === "working" && (
        <WorkingStep
          videoId={video.id}
          consentVersion={consent.version}
          agreed={agreed}
          selfie={selfie}
          jobId={jobId}
          setJobId={(id) => { setJobId(id); store.set(jobKey(video.id), id); }}
          onDone={(url) => { setResultUrl(url); store.del(jobKey(video.id)); setStep("done"); }}
          onRetry={reset}
        />
      )}

      {step === "done" && resultUrl && <ResultStep video={video} resultUrl={resultUrl} onRetry={reset} />}
    </>
  );
}

function ConsentStep({ consent, agreed, setAgreed, onNext, onBack }: {
  consent: ConsentProps; agreed: string[]; setAgreed: (v: string[]) => void; onNext: () => void; onBack: () => void;
}) {
  const all = consent.items.every((c) => agreed.includes(c.id));
  const toggle = (id: string) => setAgreed(agreed.includes(id) ? agreed.filter((a) => a !== id) : [...agreed, id]);
  return (
    <>
      <h1>개인정보 동의</h1>
      <p className="muted">얼굴 사진은 영상을 만드는 데에만 쓰고, 정해진 기간이 지나면 지워요.</p>
      <label className="all">
        <input type="checkbox" checked={all} onChange={() => setAgreed(all ? [] : consent.items.map((c) => c.id))} />
        모두 동의해요
      </label>
      {consent.items.map((c) => (
        <div className="consent" key={c.id}>
          <label>
            <input type="checkbox" checked={agreed.includes(c.id)} onChange={() => toggle(c.id)} />
            {c.title}
          </label>
          <ul>{c.body.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      ))}
      <div className="btns">
        <button className="btn" disabled={!all} onClick={onNext}>동의하고 셀카 찍기</button>
        <button className="btn ghost" onClick={onBack}>이전</button>
      </div>
    </>
  );
}

function SelfieStep({ onDone, onBack }: { onDone: (b: Blob) => void; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      setStream(s);
    } catch {
      setError("카메라를 열 수 없어요. 아래 버튼으로 사진을 찍거나 골라 주세요.");
    }
  }, []);

  useEffect(() => { start(); }, [start]);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, SELFIE_MAX_PX / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    if (blob) setShot({ blob, url: URL.createObjectURL(blob) });
  };

  const pickFile = (f?: File) => {
    if (f && f.type.startsWith("image/")) setShot({ blob: f, url: URL.createObjectURL(f) });
  };

  return (
    <>
      <h1>셀카 찍기</h1>
      <p className="muted">얼굴이 정면으로, 밝게 나오게 찍어 주세요. 모자나 마스크는 벗는 게 좋아요.</p>
      <div className="camera">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.url} alt="찍은 셀카" />
        ) : (
          <>
            <video ref={videoRef} className="mirror" playsInline muted autoPlay />
            <div className="guide" aria-hidden />
          </>
        )}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="btns">
        {shot ? (
          <>
            <button className="btn" onClick={() => { stream?.getTracks().forEach((t) => t.stop()); onDone(shot.blob); }}>이 사진으로 만들기</button>
            <button className="btn ghost" onClick={() => setShot(null)}>다시 찍기</button>
          </>
        ) : (
          <>
            {stream && <button className="btn" onClick={capture}>찍기</button>}
            <label className="btn ghost">
              {stream ? "앨범에서 고르기" : "카메라로 찍기 / 사진 고르기"}
              <input type="file" accept="image/*" capture="user" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            <button className="btn ghost" onClick={onBack}>이전</button>
          </>
        )}
      </div>
    </>
  );
}

function WorkingStep({ videoId, consentVersion, agreed, selfie, jobId, setJobId, onDone, onRetry }: {
  videoId: string; consentVersion: string; agreed: string[]; selfie: Blob | null; jobId: string | null;
  setJobId: (id: string) => void; onDone: (url: string) => void; onRetry: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
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
    fd.append("consentVersion", consentVersion);
    agreed.forEach((a) => fd.append("consent", a));
    fd.append("selfie", selfie, "selfie.jpg");
    fetch("/api/jobs", { method: "POST", body: fd })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "요청에 실패했어요.");
        setJobId(j.jobId);
      })
      .catch((e) => setError(e.message));
  }, [jobId, selfie, videoId, consentVersion, agreed, setJobId]);

  // 상태 조회
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const poll = async () => {
      try {
        const s: Status = await (await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })).json();
        if (stop) return;
        setStatus(s);
        if (s.state === "done") return onDoneRef.current(s.videoUrl);
        if (s.state === "failed") return setError(s.error);
      } catch {
        // 네트워크가 잠깐 끊겨도 다음 조회에서 다시 시도
      }
      if (!stop) setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { stop = true; };
  }, [jobId]);

  useEffect(() => {
    if (error) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="panel">
        <h2>영상을 만들지 못했어요</h2>
        <p className="err">{error}</p>
        <div className="btns"><button className="btn" onClick={onRetry}>다시 찍어서 해보기</button></div>
      </div>
    );
  }

  const label = !jobId ? "사진을 보내는 중" : status?.state === "queued" ? `순서를 기다리는 중${status.position ? ` (${status.position}번째)` : ""}` : "주인공을 바꾸는 중";
  return (
    <div className="panel progress" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <h2>{label}</h2>
      <p className="muted">보통 2~5분 걸려요. 이 화면을 닫지 말고 기다려 주세요.</p>
      <span className="timer">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
    </div>
  );
}

function ResultStep({ video, resultUrl, onRetry }: { video: Video; resultUrl: string; onRetry: () => void }) {
  const [original, setOriginal] = useState(false);
  return (
    <>
      <h1>완성됐어요!</h1>
      <video key={original ? "o" : "r"} src={original ? video.src : resultUrl} controls playsInline autoPlay loop />
      <div className="btns">
        <a className="btn" href={resultUrl} download target="_blank" rel="noopener">영상 저장하기</a>
        <button className="btn ghost" onClick={() => setOriginal(!original)}>{original ? "내 영상 보기" : "원본과 비교하기"}</button>
        <button className="btn ghost" onClick={onRetry}>다시 찍어서 해보기</button>
        <Link className="btn ghost" href="/">다른 영상 해보기</Link>
      </div>
      <p className="muted" style={{ marginTop: 14 }}>영상은 24시간 동안만 보관돼요. 필요하면 지금 저장해 주세요.</p>
    </>
  );
}
