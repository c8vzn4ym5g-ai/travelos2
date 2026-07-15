import type { CoffeeShop, CoffeeShopListItem } from "@/lib/types";

const coffeeShops: CoffeeShop[] = [
  {
    id: "coffee_paris_left_bank_2024",
    userId: "user_travelos_owner",
    name: "Left Bank Reading Table",
    slug: "left-bank-reading-table-paris-2024",
    country: "France",
    city: "Paris",
    address: "Saint-Germain-des-Pres, Paris",
    mapUrl: "https://maps.google.com/?q=Saint-Germain-des-Pres+Paris+cafe",
    websiteUrl: null,
    visitedAt: "2024-12-06",
    coffeeOrdered: "Cafe creme",
    rating: 5,
    mood: "reflective",
    tags: ["reading", "quiet afternoon", "museum break"],
    comments: "A good table for slowing down between museums. Not too loud in the afternoon.",
    lifeNote:
      "This stop felt like a small pause button in the trip. I wrote better after sitting here for twenty minutes.",
    linkedTripId: "trip_paris_2024",
    coordinates: { latitude: 48.8534, longitude: 2.3335 },
    createdAt: "2024-12-06T14:00:00.000Z",
    updatedAt: "2024-12-06T14:10:00.000Z",
    photos: [
      {
        id: "coffee_photo_paris_table",
        coffeeShopId: "coffee_paris_left_bank_2024",
        storageKey: "placeholder/coffee-paris-table.jpg",
        originalFilename: "coffee-paris-table.jpg",
        caption: "Notebook beside the cafe creme.",
        takenAt: "2024-12-06T14:02:00.000Z",
        createdAt: "2024-12-06T14:08:00.000Z",
      },
    ],
  },
  {
    id: "coffee_bangkok_riverside_2025",
    userId: "user_travelos_owner",
    name: "Riverside Espresso Stop",
    slug: "riverside-espresso-stop-bangkok-2025",
    country: "Thailand",
    city: "Bangkok",
    address: "Charoen Krung Road, Bangkok",
    mapUrl: "https://maps.google.com/?q=Charoen+Krung+Road+Bangkok+cafe",
    websiteUrl: null,
    visitedAt: "2025-03-16",
    coffeeOrdered: "Iced americano",
    rating: 4,
    mood: "focused",
    tags: ["riverside", "hot day", "route planning"],
    comments: "Useful cooling stop after the river route. Good place to check the next boat timing.",
    lifeNote:
      "The drink was simple, but the timing was perfect. I remember the relief more than the coffee.",
    linkedTripId: "trip_bangkok_2025",
    coordinates: { latitude: 13.722, longitude: 100.514 },
    createdAt: "2025-03-16T15:30:00.000Z",
    updatedAt: "2025-03-16T15:40:00.000Z",
    photos: [
      {
        id: "coffee_photo_bangkok_cup",
        coffeeShopId: "coffee_bangkok_riverside_2025",
        storageKey: "placeholder/coffee-bangkok-cup.jpg",
        originalFilename: "coffee-bangkok-cup.jpg",
        caption: "Iced coffee after the boat route.",
        takenAt: "2025-03-16T15:31:00.000Z",
        createdAt: "2025-03-16T15:39:00.000Z",
      },
    ],
  },
  {
    id: "coffee_sapporo_morning_2025",
    userId: "user_travelos_owner",
    name: "Sapporo Morning Filter",
    slug: "sapporo-morning-filter-2025",
    country: "Japan",
    city: "Sapporo",
    address: "Chuo Ward, Sapporo",
    mapUrl: "https://maps.google.com/?q=Chuo+Ward+Sapporo+coffee",
    websiteUrl: null,
    visitedAt: "2025-10-05",
    coffeeOrdered: "Hand drip coffee",
    rating: 5,
    mood: "quiet",
    tags: ["morning", "slow start", "market walk"],
    comments: "Clean filter coffee before the market became busy. Worth returning early.",
    lifeNote:
      "A quiet cup made the whole day feel less rushed. This is the kind of morning I want TravelOS to remember.",
    linkedTripId: "trip_hokkaido_2025",
    coordinates: { latitude: 43.0584, longitude: 141.3554 },
    createdAt: "2025-10-05T08:00:00.000Z",
    updatedAt: "2025-10-05T08:12:00.000Z",
    photos: [],
  },
];

export const coffeeShopListItems: CoffeeShopListItem[] = coffeeShops.map((shop) => ({
  id: shop.id,
  name: shop.name,
  slug: shop.slug,
  country: shop.country,
  city: shop.city,
  address: shop.address,
  visitedAt: shop.visitedAt,
  coffeeOrdered: shop.coffeeOrdered,
  rating: shop.rating,
  mood: shop.mood,
  tags: shop.tags,
  comments: shop.comments,
  lifeNote: shop.lifeNote,
  mapUrl: shop.mapUrl,
  websiteUrl: shop.websiteUrl,
  photoCount: shop.photos.length,
}));

export function getCoffeeShopsByVisitDate(): CoffeeShopListItem[] {
  return [...coffeeShopListItems].sort((firstShop, secondShop) =>
    secondShop.visitedAt.localeCompare(firstShop.visitedAt),
  );
}

export function getCoffeeShopDetailsByVisitDate(): CoffeeShop[] {
  return [...coffeeShops].sort((firstShop, secondShop) =>
    secondShop.visitedAt.localeCompare(firstShop.visitedAt),
  );
}

export function getCoffeeShopBySlug(slug: string): CoffeeShop | undefined {
  return coffeeShops.find((shop) => shop.slug === slug);
}

export function getCoffeeStats() {
  return {
    shops: coffeeShops.length,
    countries: new Set(coffeeShops.map((shop) => shop.country)).size,
    cities: new Set(coffeeShops.map((shop) => shop.city)).size,
    photos: coffeeShops.reduce((total, shop) => total + shop.photos.length, 0),
  };
}
