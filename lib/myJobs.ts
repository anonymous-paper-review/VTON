// 이 기기에서 만든 영상 목록 (브라우저 localStorage).
// 영상 생성은 fal 큐에서 3~6분 걸리고 앱을 닫아도 계속되므로, job id를 남겨 두면 다시 열었을 때 이어서 보여 줄 수 있다.

export type MyJob = { jobId: string; videoId: string; at: number; resultUrl?: string };

const KEY = "vton.jobs";
const TTL_MS = 24 * 60 * 60 * 1000; // fal 결과 링크가 오래 가지 않으므로 하루만 둔다

function read(): MyJob[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as MyJob[];
    return list.filter((j) => Date.now() - j.at < TTL_MS);
  } catch {
    return [];
  }
}

function write(list: MyJob[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10))); } catch {}
}

/** 최근 것부터 */
export const listJobs = () => read().sort((a, b) => b.at - a.at);

export const latestJobFor = (videoId: string) => listJobs().find((j) => j.videoId === videoId);

export function saveJob(job: Omit<MyJob, "at"> & { at?: number }) {
  const list = read();
  const prev = list.find((j) => j.jobId === job.jobId);
  write([{ ...prev, ...job, at: prev?.at ?? job.at ?? Date.now() }, ...list.filter((j) => j.jobId !== job.jobId)]);
}

export const forgetJobsFor = (videoId: string) => write(read().filter((j) => j.videoId !== videoId));

/** 다른 기기나 브라우저에서도 이어 볼 수 있는 링크 */
export const resumeUrl = (videoId: string, jobId: string) =>
  `${location.origin}/v/${videoId}?job=${encodeURIComponent(jobId)}`;
