import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';

const uploadDir = path.join(process.cwd(), config.upload.uploadDir);

// Signed URL lifetime in seconds (1 hour)
const SIGNED_URL_EXPIRY = 3600;

// Initialize Supabase client (lazy — only if configured)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  if (config.supabase.url && config.supabase.serviceKey) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    return supabase;
  }
  return null;
}

function isSupabaseEnabled(): boolean {
  return !!getSupabase();
}

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  path: string;
}

export class StorageService {
  /**
   * Upload a file buffer to Supabase Storage (private bucket)
   */
  static async uploadToSupabase(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    subdir: string = 'documents'
  ): Promise<{ storagePath: string }> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase storage is not configured');

    const ext = path.extname(originalName);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const storagePath = `${subdir}/${uniqueName}`;

    const { error } = await sb.storage
      .from(config.supabase.bucket)
      .upload(storagePath, buffer, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return { storagePath };
  }

  /**
   * Generate a signed URL for a Supabase storage path (time-limited access)
   */
  static async getSignedUrl(storagePath: string, expiresIn: number = SIGNED_URL_EXPIRY): Promise<string> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase storage is not configured');

    const { data, error } = await sb.storage
      .from(config.supabase.bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Supabase signed URL error:', error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Process uploaded file — uploads to Supabase if configured, otherwise uses local path.
   * Stores the Supabase storage path as a proxy URL: /api/v1/files/<storagePath>
   */
  static async processUploadAsync(
    file: Express.Multer.File,
    subdir: string = 'documents'
  ): Promise<UploadedFile> {
    if (isSupabaseEnabled() && file.buffer) {
      const { storagePath } = await this.uploadToSupabase(
        file.buffer,
        file.originalname,
        file.mimetype,
        subdir
      );

      return {
        filename: storagePath,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: `/api/v1/files/${storagePath}`,
        path: storagePath,
      };
    }

    // Fallback: local disk (file already saved by multer diskStorage)
    return this.processUpload(file, subdir);
  }

  /**
   * Get the URL for a file — returns proxy path for Supabase, local path otherwise
   */
  static getFileUrl(filename: string, subdir: string = 'documents'): string {
    if (isSupabaseEnabled()) {
      const storagePath = filename.includes('/') ? filename : `${subdir}/${filename}`;
      return `/api/v1/files/${storagePath}`;
    }
    return `/uploads/${subdir}/${filename}`;
  }

  /**
   * Process uploaded file and return metadata (sync — local disk only, kept for backward compat)
   */
  static processUpload(
    file: Express.Multer.File,
    subdir: string = 'documents'
  ): UploadedFile {
    return {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: this.getFileUrl(file.filename || file.originalname, subdir),
      path: file.path || '',
    };
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(filename: string, subdir: string = 'documents'): Promise<boolean> {
    try {
      if (isSupabaseEnabled()) {
        const sb = getSupabase()!;
        const storagePath = filename.includes('/') ? filename : `${subdir}/${filename}`;
        const { error } = await sb.storage.from(config.supabase.bucket).remove([storagePath]);
        if (error) {
          console.error('Supabase delete error:', error);
          return false;
        }
        return true;
      }

      // Fallback: local disk
      const filePath = path.join(uploadDir, subdir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Check if file exists
   */
  static fileExists(filename: string, subdir: string = 'documents'): boolean {
    const filePath = path.join(uploadDir, subdir, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Get file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if Supabase storage is active
   */
  static isUsingSupabase(): boolean {
    return isSupabaseEnabled();
  }
}
