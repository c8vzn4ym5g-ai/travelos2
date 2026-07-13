# Database Design Draft

## Core Entities

User: id, name, email, image, createdAt, updatedAt.

Trip: id, userId, title, slug, summary, country, city, startDate, endDate, coverPhotoId, visibility, rating, totalCostAmount, totalCostCurrency, createdAt, updatedAt.

JournalEntry: id, tripId, title, body, entryDate, mood, weatherSummary, aiSummary, createdAt, updatedAt.

Photo: id, tripId, storageKey, originalFilename, caption, takenAt, latitude, longitude, cameraMake, cameraModel, createdAt.

Place: id, tripId, type, name, country, city, address, latitude, longitude, rating, notes, createdAt, updatedAt.

Cost: id, tripId, category, amount, currency, paidAt, merchant, notes, createdAt.

## Place Types

hotel, restaurant, attraction, airport, station, shopping, other.

## Cost Categories

flight, hotel, food, transportation, attraction, shopping, insurance, other.
