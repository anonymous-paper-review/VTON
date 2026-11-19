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
  /** 영상 속 이 인물의 옷차림(영어). 셀카 인물에게 이 옷을 입힌 캐릭터시트를 만들어, 바뀐 뒤에도 옷이 원본과 같게 한다. */
  outfit?: string;
  /** 고르는 타일에 보일 인물 사진 */
  photo?: string;
};

/** 목록 탭(장소별). 하동 트레일러 4편에서 잘라 낸 클립을 장소별로 묶는다. 모두 가로 16:9. */
export const GROUPS = ["simni", "market", "tea", "river"] as const;
export type Group = (typeof GROUPS)[number];

/** 클립 프레임 속도. parts의 길이 단위(프레임)가 이 속도 기준이다 (scripts/make-clips.py). */
export const CLIP_FPS = 24;
/**
 * 재생 순서대로 [종류, 프레임 수, 끝 디졸브 프레임 수?]. gen = 얼굴이 나와 AI가 다시 만드는 구간, orig = 원본을 그대로 쓰는 구간(얼굴 없는 샷, 끝 타이틀).
 * 세 번째 값이 있으면 그 구간의 마지막 N프레임이 검정으로 사라진다 (끝 타이틀 앞 샷).
 */
export type Part = ["gen" | "orig", number, number?];

export type Video = {
  id: string;
  group: Group;
  title: Localized;
  description: Localized;
  /** 절대 URL 또는 /public 기준 경로. fal이 받아갈 수 있도록 배포 환경에서는 공개 URL이어야 한다. */
  src: string;
  poster?: string;
  /** 전체 영상 길이(초). 화면에 보이는 길이 */
  seconds: number;
  /** 생성용 영상: src에서 얼굴이 나오는 구간만 이어 붙인 것. 있으면 엔진에는 이것만 보내고(요금이 길이에 비례), 결과에 원본의 나머지 구간을 이어 붙인다. */
  gen?: { src: string; seconds: number };
  /** gen이 있을 때 src를 이루는 구간들 */
  parts?: Part[];
  cast: CastMember[];
};

export const videos = list as Video[];

export const findVideo = (id: string) => videos.find((v) => v.id === id);

/** 상대 경로를 요청 origin 기준 절대 URL로 바꾼다. */
export const absoluteUrl = (src: string, origin: string) => new URL(src, origin).toString();
