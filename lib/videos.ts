import list from "@/data/videos.json";
import type { Localized } from "@/lib/i18n";

/** 영상 속 인물. cast 배열은 화면 왼쪽부터 순서대로 둔다 (MiniMax가 참고 사진을 왼쪽부터 대응시킨다). */
export type CastMember = {
  id: string;
  /** 고르는 타일에 보일 이름 (예: "그녀") */
  label: Localized;
  /** 프롬프트에서 이 인물을 특정하는 말 (예: "the woman in the red coat") */
  target: string;
  /** 원본 속 이 인물의 얼굴 사진. 오른쪽 인물을 바꿀 때 이 인물을 그대로 두려고 MiniMax에 함께 넣는다. */
  still?: string;
  /** 고르는 타일에 보일 인물 사진 */
  photo?: string;
};

/** 목록 탭. simni = 십리벚꽃길(3:4 세로), market = 화개장터(가로) */
export const GROUPS = ["simni", "market"] as const;
export type Group = (typeof GROUPS)[number];

export type Video = {
  id: string;
  group: Group;
  title: Localized;
  description: Localized;
  /** 절대 URL 또는 /public 기준 경로. fal이 받아갈 수 있도록 배포 환경에서는 공개 URL이어야 한다. */
  src: string;
  poster?: string;
  seconds: number;
  cast: CastMember[];
};

export const videos = list as Video[];

export const findVideo = (id: string) => videos.find((v) => v.id === id);

/** 상대 경로를 요청 origin 기준 절대 URL로 바꾼다. */
export const absoluteUrl = (src: string, origin: string) => new URL(src, origin).toString();
