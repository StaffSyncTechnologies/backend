import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { haversineKm } from '../utils/geo';

export class NearbyAgencyController {
  /**
   * GET /api/v1/agencies/nearby?lat=&lng=&radiusMiles=&city=
   * Public endpoint — no auth required.
   * Returns organisations with their primary location, sorted by distance.
   * Supports filtering by radius and city name.
   */
  getNearby = async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusMiles = parseFloat(req.query.radiusMiles as string) || 50;
    const city = (req.query.city as string || '').trim().toLowerCase();

    const orgSelect = {
      id: true,
      name: true,
      address: true,
      logoUrl: true,
      primaryColor: true,
      email: true,
      website: true,
      locations: {
        where: { isActive: true } as any,
        select: {
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          isPrimary: true,
          contactPhone: true,
          contactName: true,
        },
      },
    };

    const orgs = await prisma.organization.findMany({
      where: { onboardingComplete: true },
      select: orgSelect,
    });

    const hasCoords = !isNaN(lat) && !isNaN(lng);

    const results = orgs
      .map((org) => {
        const loc = org.locations.find((l: any) => l.isPrimary) || org.locations[0];

        const address = loc?.address || org.address || null;

        // City filter — match against any location address/name, org address, or org name
        if (city) {
          const orgAddr = (org.address || '').toLowerCase();
          const orgName = org.name.toLowerCase();
          const anyLocMatch = org.locations.some((l: any) =>
            (l.address || '').toLowerCase().includes(city) ||
            (l.name || '').toLowerCase().includes(city)
          );
          if (!anyLocMatch && !orgAddr.includes(city) && !orgName.includes(city)) {
            return null;
          }
        }

        let distance: number | null = null;

        if (hasCoords && loc) {
          const locLat = Number(loc.latitude);
          const locLng = Number(loc.longitude);
          const distKm = haversineKm(lat, lng, locLat, locLng);
          const distMiles = distKm / 1.60934;

          // Apply radius filter only when coordinates are provided and no city filter
          if (!city && distMiles > radiusMiles) return null;

          distance = Math.round(distMiles * 10) / 10;
        }

        return {
          id: org.id,
          name: org.name,
          address,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          email: org.email,
          website: org.website,
          phone: loc?.contactPhone || null,
          contactName: loc?.contactName || null,
          latitude: loc ? Number(loc.latitude) : null,
          longitude: loc ? Number(loc.longitude) : null,
          distance,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.distance ?? 999) - (b!.distance ?? 999))
      .slice(0, 50);

    res.json({ success: true, data: results });
  };
}
