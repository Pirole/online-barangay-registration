import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "../middleware/errorHandler";

// Ensure uploads directory exists
const baseUploadPath = process.env.UPLOAD_PATH || "./uploads";
const eventUploadPath = path.join(baseUploadPath, "events");

if (!fs.existsSync(eventUploadPath)) {
  fs.mkdirSync(eventUploadPath, { recursive: true });
}

// Allowed image MIME types from .env or fallback default
const allowedImageTypes =
  process.env.ALLOWED_IMAGE_TYPES?.split(",") || [
    "image/jpeg",
    "image/png",
    "image/jpg",
  ];

const maxFileSize = Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // Default 5MB

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, eventUploadPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter for validation
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (!allowedImageTypes.includes(file.mimetype)) {
    return cb(new AppError("Invalid file type. Only JPEG and PNG are allowed.", 400));
  }
  cb(null, true);
};

// Multer uploader for events
export const uploadEventPhoto = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter,
});

