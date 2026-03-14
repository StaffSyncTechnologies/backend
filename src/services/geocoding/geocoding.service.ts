import { prisma } from '../../lib/prisma';

/**
 * Geocoding helper service
 * Converts addresses to GPS coordinates using OpenStreetMap Nominatim
 */
export class GeocodingService {
  private static readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly USER_AGENT = 'StaffSync/1.0 (staffsync@example.com)';

  /**
   * Convert address to GPS coordinates
   */
  static async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address || !address.trim()) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.NOMINATIM_BASE_URL}?format=json&q=${encodeURIComponent(address.trim())}&limit=1`,
        {
          headers: {
            'User-Agent': this.USER_AGENT,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Geocoding service responded with status: ${response.status}`);
      }

      const data = await response.json() as any[];

      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      if (isNaN(lat) || isNaN(lon)) {
        return null;
      }

      return { lat, lng: lon };
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Batch geocode multiple addresses
   */
  static async geocodeAddresses(addresses: string[]): Promise<Array<{ address: string; coordinates: { lat: number; lng: number } | null }>> {
    const results = [];
    
    for (const address of addresses) {
      const coordinates = await this.geocodeAddress(address);
      results.push({ address, coordinates });
      
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Reverse geocoding: Get address from coordinates
   */
  static async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.NOMINATIM_BASE_URL.replace('/search', '/reverse')}?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'User-Agent': this.USER_AGENT,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      return data?.display_name || null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Validate coordinates
   */
  static validateCoordinates(lat: number, lng: number): boolean {
    return (
      !isNaN(lat) && 
      !isNaN(lng) && 
      lat >= -90 && lat <= 90 && 
      lng >= -180 && lng <= 180
    );
  }

  /**
   * Get default coordinates (London center)
   */
  static getDefaultCoordinates(): { lat: number; lng: number } {
    return { lat: 51.5074, lng: -0.1278 };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
