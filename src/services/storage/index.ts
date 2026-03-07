import path from 'path';
import fs from 'fs';
import { config } from '../../config';

const uploadDir = path.join(process.cwd(), config.upload.uploadDir);

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
   * Get the public URL for a file
   */
  static getFileUrl(filename: string, subdir: string = 'documents'): string {
    // In production, this would return S3/CDN URL
    // For now, return local server path
    return `/uploads/${subdir}/${filename}`;
  }

  /**
   * Process uploaded file and return metadata
   */
  static processUpload(
    file: Express.Multer.File,
    subdir: string = 'documents'
  ): UploadedFile {
    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: this.getFileUrl(file.filename, subdir),
      path: file.path,
    };
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(filename: string, subdir: string = 'documents'): Promise<boolean> {
    try {
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
}
