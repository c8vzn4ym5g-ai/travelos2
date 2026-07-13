# API Specification Draft

The MVP may begin with server actions or route handlers. Keep behavior consistent even if the transport changes.

## Trips

- `GET /api/trips`: returns the current user's trips ordered by start date descending.
- `POST /api/trips`: creates a trip.
- `GET /api/trips/:id`: returns one trip with journal entries, places, photos, and costs.
- `PATCH /api/trips/:id`: updates trip metadata.
- `DELETE /api/trips/:id`: deletes or archives a trip. Prefer archive behavior before production.

## Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A readable error message.",
    "details": {}
  }
}
```
