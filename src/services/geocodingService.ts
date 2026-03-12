/**
 * Geocoding Service - Convert addresses to GPS coordinates
 * Uses OpenStreetMap Nominatim API (free, no key required)
 *
 * Changes from original:
 * - Fixed: /search response type (was modelled on /lookup endpoint)
 * - Fixed: coordinate extraction (centroid doesn't exist on /search results)
 * - Fixed: batchGeocode rate-limit check (indexOf breaks on duplicate addresses)
 * - Added: request timeout (AbortController, configurable)
 * - Added: in-memory LRU cache (avoids redundant network calls)
 * - Added: typed custom errors (GeocodingError)
 * - Added: JSDoc on every public method
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  accuracy: "high" | "medium" | "low" | "unknown";
}

export interface ReverseGeocodingResult {
  address: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export class GeocodingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GeocodingError";
  }
}

// ─── Nominatim response shapes ────────────────────────────────────────────────

/** Shape returned by GET /search?format=json */
interface NominatimSearchItem {
  place_id: number;
  lat: string;        // decimal string, e.g. "51.5074"
  lon: string;        // decimal string, e.g. "-0.1278"
  display_name: string;
  type: string;       // e.g. "house", "road", "city"
  importance: number;
}

/** Shape returned by GET /reverse?format=json */
interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    country?: string;
  };
  error?: string;
}

// ─── Simple LRU cache ─────────────────────────────────────────────────────────

class LRUCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly maxSize: number) {}

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    // Re-insert to mark as recently used
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      // Evict least-recently-used (first inserted)
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, value);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface GeocodingServiceOptions {
  /** Nominatim-compliant User-Agent string. Required by the API. */
  userAgent?: string;
  /** Request timeout in milliseconds. Default: 10 000 */
  timeoutMs?: number;
  /** Max entries to cache per method. Default: 200 */
  cacheSize?: number;
}

export class GeocodingService {
  private static instance: GeocodingService;

  private readonly BASE_URL = "https://nominatim.openstreetmap.org";
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  private readonly forwardCache: LRUCache<GeocodingResult>;
  private readonly reverseCache: LRUCache<ReverseGeocodingResult>;

  private constructor(options: GeocodingServiceOptions = {}) {
    this.userAgent = options.userAgent ?? "StaffSync/1.0 (staffsync@example.com)";
    this.timeoutMs = options.timeoutMs ?? 10_000;
    const cacheSize = options.cacheSize ?? 200;
    this.forwardCache = new LRUCache(cacheSize);
    this.reverseCache = new LRUCache(cacheSize);
  }

  static getInstance(options?: GeocodingServiceOptions): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService(options);
    }
    return GeocodingService.instance;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.userAgent },
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new GeocodingError(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private accuracyFromType(type: string): GeocodingResult["accuracy"] {
    const map: Record<string, GeocodingResult["accuracy"]> = {
      house: "high",
      building: "high",
      road: "medium",
      street: "medium",
      suburb: "medium",
      city: "low",
      town: "low",
      village: "low",
    };
    return map[type] ?? "unknown";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Convert a free-text address to GPS coordinates.
   * Results are cached; duplicate calls skip the network entirely.
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    const cacheKey = address.trim().toLowerCase();
    const cached = this.forwardCache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.BASE_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url);
    } catch (err) {
      throw err instanceof GeocodingError
        ? err
        : new GeocodingError("Network error during geocoding", err);
    }

    if (!response.ok) {
      throw new GeocodingError(`Nominatim responded with ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as NominatimSearchItem[];

    if (!Array.isArray(data) || data.length === 0) {
      throw new GeocodingError(`Address not found: "${address}"`);
    }

    const item = data[0];
    const latitude = parseFloat(item.lat);
    const longitude = parseFloat(item.lon);

    if (!this.validateCoordinates(latitude, longitude)) {
      throw new GeocodingError(
        `Nominatim returned invalid coordinates: ${item.lat}, ${item.lon}`,
      );
    }

    const result: GeocodingResult = {
      latitude,
      longitude,
      formattedAddress: item.display_name,
      accuracy: this.accuracyFromType(item.type),
    };

    this.forwardCache.set(cacheKey, result);
    return result;
  }

  /**
   * Convert GPS coordinates to a human-readable address.
   * Results are cached by rounded coordinate key (4 decimal places ≈ 11 m).
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
    if (!this.validateCoordinates(latitude, longitude)) {
      throw new GeocodingError(`Invalid coordinates: ${latitude}, ${longitude}`);
    }

    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}`;

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url);
    } catch (err) {
      throw err instanceof GeocodingError
        ? err
        : new GeocodingError("Network error during reverse geocoding", err);
    }

    if (!response.ok) {
      throw new GeocodingError(`Nominatim responded with ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as NominatimReverseResponse;

    if (!data || data.error) {
      throw new GeocodingError(data?.error ?? "Location not found");
    }

    const addr = data.address ?? {};
    const result: ReverseGeocodingResult = {
      address: data.display_name ?? "",
      city: addr.city ?? addr.town ?? addr.village,
      postcode: addr.postcode,
      country: addr.country,
    };

    this.reverseCache.set(cacheKey, result);
    return result;
  }

  /**
   * Validate that coordinates fall within the WGS84 bounds.
   */
  validateCoordinates(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  /**
   * Geocode multiple addresses, respecting Nominatim's 1 req/sec policy.
   * Failed items are collected and returned alongside successes via the result tuple.
   *
   * @returns [successes, failures] — failures carry the original address and error.
   */
  async batchGeocode(
    addresses: string[],
  ): Promise<[GeocodingResult[], Array<{ address: string; error: GeocodingError }>]> {
    const successes: GeocodingResult[] = [];
    const failures: Array<{ address: string; error: GeocodingError }> = [];

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      try {
        const result = await this.geocodeAddress(address);
        successes.push(result);
      } catch (err) {
        failures.push({
          address,
          error: err instanceof GeocodingError ? err : new GeocodingError(String(err)),
        });
      }

      // Rate limit: 1 req/sec between requests (not after the last one)
      // Use index instead of indexOf to correctly handle duplicate addresses
      if (i < addresses.length - 1) {
        await this.sleep(1_000);
      }
    }

    return [successes, failures];
  }
}
