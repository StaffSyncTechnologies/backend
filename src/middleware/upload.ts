import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config';
import { AppError } from '../utils/AppError';

// Check if Supabase is configured — use memory storage if so, disk otherwise
const useSupabase = !!(config.supabase.url && config.supabase.serviceKey);

// Ensure upload directory exists (for local fallback)
const uploadDir = path.join(process.cwd(), config.upload.uploadDir);
if (!useSupabase) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Create subdirectories for different document types
  const docTypeDirs = ['documents', 'certifications', 'rtw', 'profile', 'logos', 'covers'];
  docTypeDirs.forEach(dir => {
    const dirPath = path.join(uploadDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

// File filter for allowed types
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only PDF, JPEG, PNG, HEIC allowed.', 400, 'INVALID_FILE_TYPE'));
  }
};

// Image-only filter for profile pictures, logos, covers
const imageFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG, PNG, HEIC allowed for images.', 400, 'INVALID_FILE_TYPE'));
  }
};

// Helper: build disk storage for a specific subdirectory
function makeDiskStorage(subdir: string, prefix: string = '') {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(uploadDir, subdir));
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${prefix}${Date.now()}-${uniqueSuffix}${ext}`);
    },
  });
}

// Helper: pick storage — memory if Supabase, disk otherwise
function getStorage(subdir: string, prefix: string = '') {
  return useSupabase ? multer.memoryStorage() : makeDiskStorage(subdir, prefix);
}

// ── Document uploads ───────────────────────────────
export const uploadSingle = multer({
  storage: getStorage('documents'),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('file');

export const uploadMultiple = multer({
  storage: getStorage('documents'),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 5 },
}).array('files', 5);

export const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('file');

// ── Certification uploads ──────────────────────────
export const uploadCertification = multer({
  storage: getStorage('certifications', 'cert-'),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('file');

export const uploadCertifications = multer({
  storage: getStorage('certifications', 'cert-'),
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 10 },
}).array('files', 10);

// ── Profile picture uploads ────────────────────────
export const uploadProfilePic = multer({
  storage: getStorage('profile', 'profile-'),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('file');

// ── Organisation logo uploads ──────────────────────
export const uploadLogo = multer({
  storage: getStorage('logos', 'logo-'),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('file');

// ── Organisation cover image uploads ───────────────
export const uploadCoverImage = multer({
  storage: getStorage('covers', 'cover-'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');
