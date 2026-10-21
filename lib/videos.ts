import list from "@/data/videos.json";

export type Video = {
  id: string;
  title: string;
  description: string;
  /** 절대 URL 또는 /public 기준 경로. fal이 받아갈 수 있도록 배포 환경에서는 공개 URL이어야 한다. */
  src: string;
  poster?: string;
  seconds: number;
  /** 교체할 인물을 프롬프트에서 특정하는 말 (예: "the woman in the red coat") */
  target: string;
};

export const videos: Video[] = list;

export const findVideo = (id: string) => videos.find((v) => v.id === id);

/** 상대 경로를 요청 origin 기준 절대 URL로 바꾼다. */
export const absoluteUrl = (src: string, origin: string) => new URL(src, origin).toString();
