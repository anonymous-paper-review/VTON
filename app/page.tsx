import { videos } from "@/lib/videos";
import HomeView from "./HomeView";

export default function Home() {
  return <HomeView videos={videos} />;
}
