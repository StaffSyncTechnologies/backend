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

    console.log('File proxy request for:', storagePath);

    if (!storagePath) {
      return res.status(400).json({ success: false, message: 'File path is required' });
    }

    if (!StorageService.isUsingSupabase()) {
      console.log('File storage not configured');
      return res.status(404).json({ success: false, message: 'File storage not configured' });
    }

    // Generate a signed URL (valid for 1 hour)
    console.log('Generating signed URL for:', storagePath);
    const signedUrl = await StorageService.getSignedUrl(storagePath);
    console.log('Generated signed URL:', signedUrl);

    // For React Native compatibility, we'll proxy the image directly instead of redirecting
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(signedUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    client.get(signedUrl, (imageResponse: any) => {
      console.log('Image response status:', imageResponse.statusCode);
      
      // Set appropriate headers
      res.setHeader('Content-Type', imageResponse.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (imageResponse.statusCode !== 200) {
        console.error('Failed to fetch image:', imageResponse.statusCode);
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      
      // Pipe the image data directly to the response
      imageResponse.pipe(res);
    }).on('error', (error: any) => {
      console.error('Error fetching image:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch image' });
    });

  } catch (error: any) {
    console.error('File proxy error:', error.message);
    return res.status(404).json({ success: false, message: 'File not found' });
  }
});

export default router;
