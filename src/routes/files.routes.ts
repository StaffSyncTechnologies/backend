import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storage';

const router = Router();

/**
 * GET /api/v1/files/*
 * Proxy endpoint for Supabase private bucket files.
 * Generates a short-lived signed URL and redirects the client to it.
 * The signed URL expires after 1 hour, preventing permanent public access.
 */
router.get('/*', async (req: Request, res: Response) => {
  try {
    // Extract the storage path from the URL (everything after /files/)
    const storagePath = req.params[0];

    if (!storagePath) {
      return res.status(400).json({ success: false, message: 'File path is required' });
    }

    if (!StorageService.isUsingSupabase()) {
      return res.status(404).json({ success: false, message: 'File storage not configured' });
    }

    // Generate a signed URL (valid for 1 hour)
    const signedUrl = await StorageService.getSignedUrl(storagePath);

    // Redirect the browser/client to the signed URL
    return res.redirect(signedUrl);
  } catch (error: any) {
    console.error('File proxy error:', error.message);
    return res.status(404).json({ success: false, message: 'File not found' });
  }
});

export default router;
