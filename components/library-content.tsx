import { JourneyLibrary } from "@/components/journey-library";
import { PublicHubRetry } from "@/components/public-hub-retry";
import { readPublicHubState } from "@/lib/public-hub";
export async function LibraryContent({ home = false }: { home?: boolean }) {
  const { trips, ready } = await readPublicHubState();
  return ready ? <JourneyLibrary trips={trips} home={home} /> : <div className="jl-empty"><PublicHubRetry /></div>;
}
