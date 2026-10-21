import Link from "next/link";
import { videos } from "@/lib/videos";

export default function Home() {
  return (
    <>
      <h1>영상 속 주인공 되기</h1>
      <p className="muted">마음에 드는 영상을 고르고, 셀카 한 장으로 주인공이 되어 보세요.</p>
      <ul className="list">
        {videos.map((v) => (
          <li key={v.id}>
            <Link className="card" href={`/v/${v.id}`}>
              <div className="thumb" style={v.poster ? { backgroundImage: `url(${v.poster})` } : undefined}>
                <span className="len">{v.seconds}초</span>
              </div>
              <div className="body">
                <strong>{v.title}</strong>
                <span className="muted">{v.description}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
