import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { haversineKm } from '../utils/geo';

export class NearbyAgencyController {
  /**
   * GET /api/v1/agencies/nearby?lat=&lng=&radiusMiles=
   * Public endpoint — no auth required.
   * Returns organisations with their primary location, sorted by distance.
   */
  getNearby = async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusMiles = parseFloat(req.query.radiusMiles as string) || 50;

    // If no coordinates provided, return all agencies (limited)
    if (isNaN(lat) || isNaN(lng)) {
      const orgs = await prisma.organization.findMany({
        where: { onboardingComplete: true },
        select: {
          id: true,
          name: true,
          address: true,
          logoUrl: true,
          primaryColor: true,
          email: true,
          website: true,
          locations: {
            where: { isPrimary: true, isActive: true },
            select: { address: true, latitude: true, longitude: true, contactPhone: true, contactName: true },
            take: 1,
          },
        },
        take: 50,
        orderBy: { name: 'asc' },
      });

      const data = orgs.map((org) => {
        const loc = org.locations[0];
        return {
          id: org.id,
          name: org.name,
          address: loc?.address || org.address || null,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          email: org.email,
          website: org.website,
          phone: loc?.contactPhone || null,
          contactName: loc?.contactName || null,
          latitude: loc ? Number(loc.latitude) : null,
          longitude: loc ? Number(loc.longitude) : null,
          distance: null,
        };
      });

      return res.json({ success: true, data });
    }

    const orgs = await prisma.organization.findMany({
      where: { onboardingComplete: true },
      select: {
        id: true,
        name: true,
        address: true,
        logoUrl: true,
        primaryColor: true,
        email: true,
        website: true,
        locations: {
          where: { isActive: true },
          select: { address: true, latitude: true, longitude: true, isPrimary: true, contactPhone: true, contactName: true },
        },
      },
    });

    // Calculate distance for each org using its primary (or first) location
    const withDistance = orgs
      .map((org) => {
        const loc = org.locations.find((l) => l.isPrimary) || org.locations[0];
        if (!loc) return null;

        const locLat = Number(loc.latitude);
        const locLng = Number(loc.longitude);
        const distKm = haversineKm(lat, lng, locLat, locLng);
        const distMiles = distKm / 1.60934;

        if (distMiles > radiusMiles) return null;

        return {
          id: org.id,
          name: org.name,
          address: loc.address || org.address || null,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          email: org.email,
          website: org.website,
          phone: loc.contactPhone || null,
          contactName: loc.contactName || null,
          latitude: locLat,
          longitude: locLng,
          distance: Math.round(distMiles * 10) / 10,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.distance ?? 999) - (b!.distance ?? 999))
      .slice(0, 50);

    res.json({ success: true, data: withDistance });
  };
}
