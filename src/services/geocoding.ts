/**
 * Geocoding Service - Convert addresses to GPS coordinates
 */

export class GeocodingError extends Error {
  code: string;
  constructor(message: string, code: string = 'GEOCODING_ERROR') {
    super(message);
    this.name = 'GeocodingError';
    this.code = code;
  }
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  accuracy: string;
}

export interface ReverseGeocodingResult {
  address: string;
  city?: string;
  postcode?: string;
  country?: string;
}

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

interface NominatimSearchResponse {
  place_id: number;
  osm_type: string;
  osm_id: number;
  category: string;
  type: string;
  localname: string;
  calculated_postcode?: string;
  country_code: string;
  centroid: {
    type: string;
    coordinates: [number, number];
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  address: Array<{
    localname: string;
    place_id: number;
    osm_id: number;
    osm_type: string;
    class: string;
    type: string;
    admin_level?: number;
    rank_address: number;
    distance: number;
    isaddress: boolean;
  }>;
}

export class GeocodingService {
  private static instance: GeocodingService;
  
  // Using OpenStreetMap Nominatim API (free, no API key required)
  private readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  
  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * Convert address to GPS coordinates (Forward Geocoding)
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    try {
      const response = await fetch(
        `${this.NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'StaffSync/1.0 (staffsync@example.com)' // Required by Nominatim
          }
        }
      );

      if (!response.ok) {
        throw new GeocodingError(
          `Geocoding request failed with status ${response.status}: ${response.statusText}`,
          'GEOCODING_HTTP_ERROR'
        );
      }

      const data = await response.json() as NominatimSearchResponse[];
      
      if (!data || data.length === 0) {
        throw new GeocodingError(`No results found for address: "${address}"`, 'ADDRESS_NOT_FOUND');
      }

      const result = data[0];
      
      // Extract coordinates from centroid (longitude, latitude order)
      const [longitude, latitude] = result.centroid.coordinates;
      
      // Construct formatted address from address components
      const addressComponents = result.address
        .filter(addr => addr.isaddress)
        .map(addr => addr.localname)
        .reverse(); // Reverse to get most specific last
      
      const formattedAddress = addressComponents.join(', ');
      
      return {
        latitude,
        longitude,
        formattedAddress,
        accuracy: this.getAccuracyLevel(result.type)
      };

    } catch (error) {
      if (error instanceof GeocodingError) throw error;
      console.error('Geocoding error:', error);
      throw new GeocodingError(
        `Unexpected error geocoding address: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GEOCODING_UNEXPECTED_ERROR'
      );
    }
  }

  /**
   * Convert GPS coordinates to address (Reverse Geocoding)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
    if (!this.validateCoordinates(latitude, longitude)) {
      throw new GeocodingError(
        `Invalid coordinates: latitude=${latitude}, longitude=${longitude}`,
        'INVALID_COORDINATES'
      );
    }
    try {
      const response = await fetch(
        `${this.NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            'User-Agent': 'StaffSync/1.0 (staffsync@example.com)'
          }
        }
      );

      if (!response.ok) {
        throw new GeocodingError(
          `Reverse geocoding request failed with status ${response.status}: ${response.statusText}`,
          'GEOCODING_HTTP_ERROR'
        );
      }

      const data = await response.json() as NominatimReverseResponse;
      
      if (!data || data.error) {
        throw new GeocodingError(
          data?.error ?? `No location found for coordinates: ${latitude}, ${longitude}`,
          'LOCATION_NOT_FOUND'
        );
      }

      const address = data.address || {};
      
      return {
        address: data.display_name || '',
        city: address.city || address.town || address.village,
        postcode: address.postcode,
        country: address.country
      };

    } catch (error) {
      if (error instanceof GeocodingError) throw error;
      console.error('Reverse geocoding error:', error);
      throw new GeocodingError(
        `Unexpected error reverse geocoding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GEOCODING_UNEXPECTED_ERROR'
      );
    }
  }

  /**
   * Validate coordinates are within reasonable bounds
   */
  validateCoordinates(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
  }

  /**
   * Get accuracy level from OSM type
   */
  private getAccuracyLevel(type: string): string {
    const accuracyMap: Record<string, string> = {
      'house': 'high',
      'building': 'high', 
      'road': 'medium',
      'street': 'medium',
      'suburb': 'medium',
      'city': 'low',
      'town': 'low',
      'village': 'low'
    };
    
    return accuracyMap[type] || 'unknown';
  }

  /**
   * Batch geocode multiple addresses (with rate limiting)
   */
  async batchGeocode(addresses: string[]): Promise<GeocodingResult[]> {
    const results: GeocodingResult[] = [];
    
    // Process with delay to respect rate limits (1 request per second)
    for (const address of addresses) {
      try {
        const result = await this.geocodeAddress(address);
        results.push(result);
        
        // Rate limiting: wait 1 second between requests
        if (addresses.indexOf(address) < addresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to geocode "${address}":`, error);
        // Continue with other addresses
        continue;
      }
    }
    
    return results;
  }
}
