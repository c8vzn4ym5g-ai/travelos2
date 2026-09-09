import Link from "next/link";
import { readContent } from "@/lib/editable-store";

export async function FamilyEditableTrips() {
  try {
    const { content } = await readContent();
    const trips = [...content.trips]
      .filter((trip) => trip.photos.length > 0 || trip.journalEntries.length > 0)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    if (trips.length === 0) {
      return null;
    }

    return (
      <section className="fam-sheet" data-family-editable-trips="" style={{ paddingTop: 4 }}>
        <h2 className="fam-section">遊記草稿</h2>
        <div className="mt-4 grid gap-2">
          {trips.map((trip) => (
            <Link
              className="fam-press fam-pill fam-pill-white min-h-11 w-full justify-between"
              href={`/trips/admin?trip=${encodeURIComponent(trip.id)}`}
              key={trip.id}
            >
              <span>{trip.title}</span>
              <span className="fam-en">編輯</span>
            </Link>
          ))}
        </div>
      </section>
    );
  } catch {
    return (
      <section className="fam-sheet" data-family-editable-trips="" style={{ paddingTop: 4 }}>
        <h2 className="fam-section">遊記草稿</h2>
        <Link className="fam-pill fam-pill-white mt-4 min-h-11 w-full" href="/trips/admin">
          打開遊記編輯
        </Link>
      </section>
    );
  }
}
