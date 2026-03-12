# Automatic Geocoding Feature

## Overview
This feature automatically converts addresses to GPS coordinates when creating or updating organization locations, eliminating the need for manual latitude/longitude entry.

## How It Works

### 🗺️ Geocoding Service
- **Service**: OpenStreetMap Nominatim API (free, no API key required)
- **Function**: Converts addresses to coordinates (forward geocoding)
- **Fallback**: Manual coordinates still supported if geocoding fails

### 📍 Address to Coordinates Flow

#### **Before (Manual Entry)**
```json
POST /locations
{
  "name": "Main Office",
  "address": "123 Main Street, London, UK",
  "latitude": 51.5074,     // ❌ Manual entry required
  "longitude": -0.1278,   // ❌ Manual entry required
  "geofenceRadius": 300
}
```

#### **After (Automatic Geocoding)**
```json
POST /locations
{
  "name": "Main Office", 
  "address": "123 Main Street, London, UK",
  "geofenceRadius": 300
}
// ✅ latitude & longitude auto-generated!
```

### 🔧 Implementation Details

#### **Updated Location Schema**
```typescript
const locationSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),  // Now optional
  longitude: z.number().min(-180).max(180).optional(), // Now optional
  geofenceRadius: z.number().int().min(50).max(5000).default(100),
});
```

#### **Auto-Geocoding Logic**
```typescript
// If coordinates not provided, geocode the address
if (!latitude || !longitude) {
  const geocoded = await geocodingService.geocodeAddress(address);
  latitude = geocoded.latitude;
  longitude = geocoded.longitude;
}
```

## API Endpoints

### **1. Create Location (with Auto-Geocoding)**
```
POST /api/locations
```

**Request:**
```json
{
  "name": "Warehouse A",
  "address": "100 Industrial Way, Manchester, UK",
  "geofenceRadius": 200
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location created",
  "data": {
    "id": "uuid-123",
    "name": "Warehouse A",
    "address": "100 Industrial Way, Manchester, UK",
    "latitude": 53.4808,
    "longitude": -2.2426,
    "geofenceRadius": 200,
    "organizationId": "uuid-org"
  }
}
```

### **2. Update Location (with Auto-Geocoding)**
```
PUT /api/locations/:locationId
```

**Request:**
```json
{
  "address": "150 Industrial Way, Manchester, UK"
}
// Coordinates will be auto-updated
```

### **3. Validate Address (Helper Endpoint)**
```
GET /api/locations/validate-address?address=123 Main St, London
```

**Response:**
```json
{
  "success": true,
  "message": "Address validated and geocoded",
  "data": {
    "originalAddress": "123 Main St, London",
    "formattedAddress": "123 Main Street, London, UK",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "accuracy": "high"
  }
}
```

## Error Handling

### **Geocoding Failures**
If automatic geocoding fails:
- **Error Response**: `400 GEOCODING_FAILED`
- **Message**: "Failed to geocode address: [error]. Please provide coordinates manually."
- **Solution**: User can still manually enter coordinates

### **Invalid Coordinates**
- **Error Response**: `400 INVALID_COORDINATES`
- **Validation**: Latitude (-90 to 90), Longitude (-180 to 180)

## Rate Limiting

### **Nominatim API Limits**
- **Free Tier**: 1 request per second
- **Batch Processing**: Automatic 1-second delays between requests
- **User Agent**: Required (StaffSync/1.0)

### **Implementation**
```typescript
// Rate limiting in batch operations
for (const address of addresses) {
  await geocodingService.geocodeAddress(address);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
}
```

## Accuracy Levels

The geocoding service returns accuracy based on OSM types:

| OSM Type | Accuracy | Example |
|----------|----------|---------|
| `house`, `building` | **High** | Specific building address |
| `road`, `street` | **Medium** | Street level |
| `city`, `town` | **Low** | City center |

## Benefits

### **✅ For Admin Users**
- **No Manual GPS Lookup**: Just enter the address
- **Reduced Errors**: No coordinate typos
- **Faster Setup**: Quick location creation
- **Validation**: Address verification before saving

### **✅ For System**
- **Data Quality**: Consistent, accurate coordinates
- **Geofencing**: Reliable distance calculations
- **User Experience**: Streamlined location management

### **✅ For Developers**
- **Fallback Support**: Manual coordinates still work
- **Error Handling**: Graceful failure modes
- **Rate Limiting**: Built-in API protection

## Future Enhancements

1. **Multiple Providers**: Google Maps, Mapbox as backup
2. **Address Autocomplete**: Suggest addresses as user types
3. **Batch Import**: Geocode multiple addresses at once
4. **Visual Map**: Pin location on map for confirmation
5. **Reverse Geocoding**: Convert coordinates back to addresses

## Usage Examples

### **Frontend Integration**
```javascript
// Create location with auto-geocoding
const createLocation = async (locationData) => {
  const response = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: locationData.name,
      address: locationData.address,
      geofenceRadius: locationData.radius
      // No latitude/longitude needed!
    })
  });
  
  const result = await response.json();
  return result.data; // Includes auto-generated coordinates
};
```

### **Address Validation**
```javascript
// Validate address before submission
const validateAddress = async (address) => {
  const response = await fetch(`/api/locations/validate-address?address=${encodeURIComponent(address)}`);
  const result = await response.json();
  
  if (result.success) {
    console.log(`Geocoded to: ${result.data.latitude}, ${result.data.longitude}`);
    return result.data;
  } else {
    console.error('Invalid address:', result.message);
    return null;
  }
};
```

## Migration Notes

Existing locations with manual coordinates will continue to work unchanged. The new auto-geocoding only applies when:
- Creating new locations without coordinates
- Updating existing locations where coordinates are omitted
- Using the validation endpoint

This ensures backward compatibility while providing enhanced functionality for new data entry.
