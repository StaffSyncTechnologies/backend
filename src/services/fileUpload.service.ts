import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export interface UploadResult {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  thumbnailUrl?: string;
}

export class FileUploadService {
  private static getUploadDir(type: 'images' | 'documents' | 'audio' | 'video'): string {
    return path.join(process.cwd(), 'uploads', 'chat', type);
  }

  private static ensureDirExists(dir: string): void {
    if (!require('fs').existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
  }

  private static getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'WORD';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'EXCEL';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'POWERPOINT';
    return 'OTHER';
  }

  private static getUploadDirByType(fileType: string): 'images' | 'documents' | 'audio' | 'video' {
    switch (fileType) {
      case 'IMAGE':
        return 'images';
      case 'VIDEO':
        return 'video';
      case 'AUDIO':
        return 'audio';
      default:
        return 'documents';
    }
  }

  static async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    duration?: number
  ): Promise<UploadResult> {
    const fileType = this.getFileType(mimeType);
    const uploadDir = this.getUploadDirByType(fileType);
    const dir = this.getUploadDir(uploadDir);
    
    this.ensureDirExists(dir);

    const fileId = uuidv4();
    const fileExtension = path.extname(originalName);
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(dir, fileName);

    // Write file to disk
    await fs.writeFile(filePath, buffer);

    // Generate file URL
    const relativePath = path.relative(process.cwd(), filePath);
    const cleanPath = relativePath.replace(/\\/g, '/');
    // Remove 'uploads/' prefix if it exists at the beginning
    const finalPath = cleanPath.replace(/^uploads\//, '');
    const fileUrl = `${config.upload.baseUrl}/${finalPath}`;

    const fileSize = buffer.length;

    // Generate thumbnail for images (simplified - in production you'd use a proper image processing library)
    let thumbnailUrl: string | undefined;
    if (fileType === 'IMAGE') {
      thumbnailUrl = fileUrl; // For now, use same URL as thumbnail
    }

    return {
      id: fileId,
      fileName: originalName,
      fileUrl,
      fileType,
      fileSize,
      mimeType,
      duration,
      thumbnailUrl,
    };
  }

  static async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const relativePath = fileUrl.replace(`${config.upload.baseUrl}/`, '');
      const filePath = path.join(process.cwd(), relativePath);
      
      // Check if file exists and delete it
      if (require('fs').existsSync(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error - file deletion shouldn't break the flow
    }
  }

  static async getAudioDuration(filePath: string): Promise<number> {
    // This is a placeholder - in production you'd use a proper audio analysis library
    // like node-ffprobe or music-metadata
    return 0; // Duration in seconds
  }
}
