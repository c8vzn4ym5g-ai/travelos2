"use client";

import { useState } from "react";
import type { CoffeePhoto, CoffeeShop, GeoPoint } from "@/lib/types";

type CoffeeWorldMapProps = {
  shops: CoffeeShop[];
};

function isRenderablePhoto(photo: CoffeePhoto | null | undefined) {
  return Boolean(photo && (photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/")));
}

function getCoverPhoto(shop: CoffeeShop) {
  return shop.photos.find((photo) => isRenderablePhoto(photo)) ?? null;
}

function getGeoBounds(points: GeoPoint[]) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  return {
    maxLat: Math.max(...latitudes),
    maxLng: Math.max(...longitudes),
    minLat: Math.min(...latitudes),
    minLng: Math.min(...longitudes),
  };
}

function chooseZoom(points: GeoPoint[]) {
  const bounds = getGeoBounds(points);
  const span = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);

  if (span > 90) {
    return 2;
  }

  if (span > 35) {
    return 3;
  }

  if (span > 12) {
    return 4;
  }

  return 6;
}

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom;
}

function getTileBounds(points: GeoPoint[]) {
  const zoom = chooseZoom(points);
  const xs = points.map((point) => longitudeToTileX(point.longitude, zoom));
  const ys = points.map((point) => latitudeToTileY(point.latitude, zoom));
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const pad = Math.max(0.7, Math.max(xSpan, ySpan) * 0.22);

  return {
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    zoom,
  };
}

function getMapTiles(bounds: ReturnType<typeof getTileBounds>) {
  const tileCount = 2 ** bounds.zoom;
  const minX = Math.floor(bounds.minX);
  const maxX = Math.floor(bounds.maxX);
  const minY = Math.max(0, Math.floor(bounds.minY));
  const maxY = Math.min(tileCount - 1, Math.floor(bounds.maxY));

  return Array.from({ length: maxY - minY + 1 }).flatMap((_, rowIndex) =>
    Array.from({ length: maxX - minX + 1 }).map((__, columnIndex) => {
      const x = minX + columnIndex;
      const y = minY + rowIndex;
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      return {
        key: `${bounds.zoom}-${wrappedX}-${y}`,
        src: `https://tile.openstreetmap.org/${bounds.zoom}/${wrappedX}/${y}.png`,
        style: {
          height: `${(1 / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100}%`,
          left: `${((x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100}%`,
          top: `${((y - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100}%`,
          width: `${(1 / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100}%`,
        },
      };
    }),
  );
}

function project(point: GeoPoint, bounds: ReturnType<typeof getTileBounds>) {
  const x = ((longitudeToTileX(point.longitude, bounds.zoom) - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100;
  const y = ((latitudeToTileY(point.latitude, bounds.zoom) - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100;

  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(92, Math.max(8, y)),
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(date));
}

export function CoffeeWorldMap({ shops }: CoffeeWorldMapProps) {
  const mappedShops = shops.filter((shop) => shop.coordinates);
  const [selectedShopId, setSelectedShopId] = useState(mappedShops[0]?.id ?? null);
  const selectedShop = mappedShops.find((shop) => shop.id === selectedShopId) ?? mappedShops[0] ?? null;
  const bounds = getTileBounds(mappedShops.length > 0 ? mappedShops.map((shop) => shop.coordinates as GeoPoint) : [{ latitude: 22.3, longitude: 114.1 }]);
  const mapTiles = getMapTiles(bounds);

  if (mappedShops.length === 0) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Coffee map</p>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Add coordinates in coffee admin to show cafe pins here.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Coffee map</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Cafe memories by place</h2>
        </div>
        <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900">
          {mappedShops.length} pins
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative min-h-[28rem] overflow-hidden bg-[#dff5f0]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#dff5f0_0%,#fef3c7_100%)]" />
          {mapTiles.map((tile) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="absolute max-w-none select-none object-cover" draggable={false} key={tile.key} loading="lazy" src={tile.src} style={tile.style} />
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.24))]" />
          {mappedShops.map((shop, index) => {
            const point = project(shop.coordinates as GeoPoint, bounds);
            const selected = shop.id === selectedShop?.id;
            return (
              <button
                className="absolute grid h-10 w-10 -translate-x-1/2 -translate-y-full place-items-center transition hover:scale-110"
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                style={{ left: `${point.x}%`, top: `${point.y}%`, zIndex: selected ? 30 : 10 + index }}
                title={shop.name}
                type="button"
              >
                <span
                  className={`grid h-8 w-8 rotate-45 place-items-center rounded-[50%_50%_50%_0] border-2 text-[0.68rem] font-bold shadow-[0_12px_28px_rgba(15,23,42,.22)] ${
                    selected ? "border-white bg-rose-600 text-white ring-4 ring-white/80" : "border-white bg-teal-700 text-white"
                  }`}
                >
                  <span className="-rotate-45">{index + 1}</span>
                </span>
              </button>
            );
          })}
          <div className="absolute bottom-3 left-3 rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[0.68rem] font-semibold text-slate-700 shadow-sm">
            Tap cafe pins
          </div>
          <a className="absolute bottom-3 right-3 rounded-full bg-white/85 px-2 py-1 text-[0.62rem] font-semibold text-slate-600 shadow-sm" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
            OpenStreetMap
          </a>
        </div>

        <aside className="space-y-3 border-t border-zinc-100 bg-stone-50/80 p-3 lg:border-l lg:border-t-0">
          <div className="rounded-2xl border border-zinc-100 bg-white/85 p-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cafe list</p>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[0.62rem] font-semibold text-zinc-600">{mappedShops.length}</span>
            </div>
            <div className="mt-2 grid gap-1">
              {mappedShops.map((shop, index) => (
                <button
                  className={`grid grid-cols-[1.35rem_1fr] items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-[0.72rem] font-semibold leading-4 transition ${
                    selectedShop?.id === shop.id ? "border-rose-200 bg-rose-50 text-rose-800 shadow-sm" : "border-transparent bg-white/70 text-zinc-700 hover:border-teal-100 hover:bg-teal-50"
                  }`}
                  key={`coffee-stop-${shop.id}`}
                  onClick={() => setSelectedShopId(shop.id)}
                  title={shop.name}
                  type="button"
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] ${selectedShop?.id === shop.id ? "bg-rose-600 text-white" : "bg-zinc-900 text-white"}`}>
                    {index + 1}
                  </span>
                  <span className="line-clamp-2">{shop.name}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedShop ? (
            <div className="rounded-2xl border border-zinc-100 bg-white/85 p-3 shadow-sm">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-teal-700">
                {selectedShop.city}, {selectedShop.country}
              </p>
              <h3 className="mt-1 text-base font-semibold leading-5 text-zinc-950">{selectedShop.name}</h3>
              <p className="mt-2 text-xs font-semibold text-zinc-600">
                {formatDate(selectedShop.visitedAt)} / {selectedShop.coffeeOrdered}
              </p>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-600">{selectedShop.lifeNote || selectedShop.comments}</p>
              {isRenderablePhoto(getCoverPhoto(selectedShop)) ? (
                <div className="mt-3 overflow-hidden rounded-xl bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={getCoverPhoto(selectedShop)?.caption ?? selectedShop.name}
                    className="h-24 w-full object-cover"
                    src={getCoverPhoto(selectedShop)?.storageKey}
                  />
                </div>
              ) : (
                <div className="mt-3 grid h-20 place-items-center rounded-xl bg-stone-100 px-3 text-center text-xs text-zinc-500">
                  Photo ready when uploaded
                </div>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
