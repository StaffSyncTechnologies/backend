import { prisma } from '../../lib/prisma';

export class TokenService {
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { token },
    });
    return !!blacklisted;
  }
}
