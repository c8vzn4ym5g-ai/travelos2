export type TravelVisibility = "private" | "shared" | "public";

export type PlaceType =
  | "hotel"
  | "restaurant"
  | "attraction"
  | "airport"
  | "station"
  | "shopping"
  | "other";

export type CostCategory =
  | "flight"
  | "hotel"
  | "food"
  | "transportation"
  | "attraction"
  | "shopping"
  | "insurance"
  | "other";

export type CurrencyCode = "CNY" | "EUR" | "GBP" | "JPY" | "THB" | "USD" | (string & {});

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface TimestampedRecord {
  createdAt: string;
  updatedAt: string;
}

export interface Trip extends TimestampedRecord {
  id: string;
  userId: string;
  title: string;
  slug: string;
  summary: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  coverPhotoId: string | null;
  visibility: TravelVisibility;
  rating: number | null;
  totalCost: Money | null;
  coordinates: GeoPoint | null;
}

export interface JournalEntry extends TimestampedRecord {
  id: string;
  tripId: string;
  title: string;
  body: string;
  entryDate: string;
  mood: string | null;
  weatherSummary: string | null;
  aiSummary: string | null;
}

export interface Photo {
  id: string;
  tripId: string;
  storageKey: string;
  originalFilename: string;
  caption: string | null;
  takenAt: string | null;
  coordinates: GeoPoint | null;
  cameraMake: string | null;
  cameraModel: string | null;
  createdAt: string;
}

export interface MusicTrack {
  id: string;
  tripId: string;
  title: string;
  audioUrl: string;
  triggerLabel: string;
  volume: number;
  enabled: boolean;
  createdAt: string;
}

export interface Place extends TimestampedRecord {
  id: string;
  tripId: string;
  type: PlaceType;
  name: string;
  country: string;
  city: string;
  address: string | null;
  coordinates: GeoPoint | null;
  rating: number | null;
  notes: string | null;
}

export interface Cost {
  id: string;
  tripId: string;
  category: CostCategory;
  amount: number;
  currency: CurrencyCode;
  paidAt: string;
  merchant: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TripDetail extends Trip {
  journalEntries: JournalEntry[];
  photos: Photo[];
  places: Place[];
  costs: Cost[];
  musicTracks: MusicTrack[];
}

export interface TripListItem {
  id: Trip["id"];
  title: Trip["title"];
  slug: Trip["slug"];
  summary: Trip["summary"];
  country: Trip["country"];
  city: Trip["city"];
  startDate: Trip["startDate"];
  endDate: Trip["endDate"];
  rating: Trip["rating"];
  totalCost: Trip["totalCost"];
  coverPhotoId: Trip["coverPhotoId"];
}

export type CoffeeMood =
  | "focused"
  | "quiet"
  | "social"
  | "reflective"
  | "inspired"
  | "tired"
  | "other";

export interface CoffeePhoto {
  id: string;
  coffeeShopId: string;
  storageKey: string;
  originalFilename: string;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
}

export interface CoffeeShop extends TimestampedRecord {
  id: string;
  userId: string;
  name: string;
  slug: string;
  country: string;
  city: string;
  address: string;
  mapUrl: string | null;
  websiteUrl: string | null;
  visitedAt: string;
  coffeeOrdered: string;
  rating: number | null;
  mood: CoffeeMood;
  tags: string[];
  comments: string;
  lifeNote: string;
  linkedTripId: string | null;
  coordinates: GeoPoint | null;
  photos: CoffeePhoto[];
}

export interface CoffeeShopListItem {
  id: CoffeeShop["id"];
  name: CoffeeShop["name"];
  slug: CoffeeShop["slug"];
  country: CoffeeShop["country"];
  city: CoffeeShop["city"];
  address: CoffeeShop["address"];
  visitedAt: CoffeeShop["visitedAt"];
  coffeeOrdered: CoffeeShop["coffeeOrdered"];
  rating: CoffeeShop["rating"];
  mood: CoffeeShop["mood"];
  tags: CoffeeShop["tags"];
  comments: CoffeeShop["comments"];
  lifeNote: CoffeeShop["lifeNote"];
  mapUrl: CoffeeShop["mapUrl"];
  websiteUrl: CoffeeShop["websiteUrl"];
  photoCount: number;
}
