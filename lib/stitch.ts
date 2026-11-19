import "server-only";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { chmod, copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { CLIP_FPS, type Part } from "@/lib/videos";

// 요금을 줄이려고 H3 Max에는 얼굴이 나오는 구간(gen)만 보낸다. 결과가 오면 여기서
// "생성 결과의 얼굴 구간 + 원본 영상의 얼굴 없는 구간"을 원래 순서대로 이어 붙여 한 파일로 만든다.
// 소리는 원본 전체 영상의 것을 그대로 쓴다 (음악이 컷마다 끊기지 않게).

const W = 1344;
const H = 768;
const MAX_INPUT_BYTES = 80 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const FFMPEG_TIMEOUT_MS = 40_000;

/** Vercel에는 ffmpeg이 없어 ffmpeg-static 바이너리를 함께 올린다 (next.config.ts의 outputFileTracingIncludes). 로컬은 시스템 ffmpeg도 된다. */
function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const bundled = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
  return existsSync(bundled) ? bundled : "ffmpeg";
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d).slice(-1500); });
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timeout")); }, FFMPEG_TIMEOUT_MS);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err}`)); });
  });
}

async function download(url: string, dest: string): Promise<void> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`fetch ${r.status} ${new URL(url).host}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_INPUT_BYTES) throw new Error("input too big");
  await writeFile(dest, buf);
}

/** 입력 0 = 생성 결과(얼굴 구간만), 입력 1 = 원본 전체 영상. parts 순서대로 잘라 붙이는 필터. */
export function stitchFilter(parts: Part[]): { filter: string; frames: number } {
  const cuts: { input: 0 | 1; from: number; to: number }[] = [];
  let g = 0; // 생성 결과에서의 위치(프레임)
  let f = 0; // 전체 영상에서의 위치
  for (const [kind, n] of parts) {
    if (kind === "gen") { cuts.push({ input: 0, from: g, to: g + n }); g += n; }
    else cuts.push({ input: 1, from: f, to: f + n });
    f += n;
  }
  const chains: string[] = [];
  for (const input of [0, 1] as const) {
    const mine = cuts.map((c, i) => ({ ...c, i })).filter((c) => c.input === input);
    if (!mine.length) continue;
    // 프레임 수·크기가 원본과 조금 달라도 맞춘다. 결과가 몇 프레임 짧으면 마지막 프레임으로 채운다.
    const norm = `[${input}:v]fps=${CLIP_FPS},scale=${W}:${H},setsar=1${input === 0 ? ",tpad=stop_mode=clone:stop=12" : ""}`;
    chains.push(mine.length === 1 ? `${norm}[s${mine[0].i}]` : `${norm},split=${mine.length}${mine.map((c) => `[s${c.i}]`).join("")}`);
    for (const c of mine) chains.push(`[s${c.i}]trim=start_frame=${c.from}:end_frame=${c.to},setpts=PTS-STARTPTS[p${c.i}]`);
  }
  chains.push(`${cuts.map((_, i) => `[p${i}]`).join("")}concat=n=${cuts.length}:v=1:a=0[v]`);
  return { filter: chains.join(";"), frames: f };
}

export type Stitched = { size: number; stream: () => ReadableStream<Uint8Array>; seconds: number };

/** 이어 붙인 mp4를 임시 폴더에 만들고 스트림으로 돌려준다. 스트림이 끝나면 임시 파일을 지운다 (서버에 영상을 남기지 않는다). */
export async function stitch(opts: { resultUrl: string; fullUrl: string; parts: Part[] }): Promise<Stitched> {
  const t0 = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), "vton-stitch-"));
  const clean = () => rm(dir, { recursive: true, force: true }).catch(() => {});
  try {
    // 파일 이름은 public/의 영상 이름과 겹치지 않게 둔다 (겹치면 빌드가 그 영상들을 서버 함수에 함께 싣는다)
    const gen = path.join(dir, "in-result.bin");
    const full = path.join(dir, "in-full.bin");
    const out = path.join(dir, "stitched.bin");
    await Promise.all([download(opts.resultUrl, gen), download(opts.fullUrl, full)]);
    const { filter, frames } = stitchFilter(opts.parts);
    const args = [
      "-v", "error", "-y", "-i", gen, "-i", full, "-filter_complex", filter,
      "-map", "[v]", "-map", "1:a?", "-frames:v", String(frames), "-t", (frames / CLIP_FPS).toFixed(4),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(CLIP_FPS),
      "-c:a", "copy", "-movflags", "+faststart", "-f", "mp4", out,
    ];
    let bin = ffmpegPath();
    try {
      await run(bin, args);
    } catch (e) {
      // 올린 바이너리에 실행 권한이 빠져 있으면 쓸 수 있는 곳으로 옮겨 다시 한다
      if ((e as NodeJS.ErrnoException).code !== "EACCES") throw e;
      const copy = path.join(tmpdir(), "vton-ffmpeg");
      await copyFile(bin, copy);
      await chmod(copy, 0o755);
      bin = copy;
      await run(bin, args);
    }
    const { size } = await stat(out);
    return {
      size,
      seconds: (Date.now() - t0) / 1000,
      stream: () => {
        const file = createReadStream(out);
        file.on("close", clean);
        return Readable.toWeb(file) as unknown as ReadableStream<Uint8Array>;
      },
    };
  } catch (e) {
    await clean();
    throw e;
  }
}
