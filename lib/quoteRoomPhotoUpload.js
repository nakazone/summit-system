import multer from 'multer';
import path from 'path';
import fs from 'fs';

const quoteRoomPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = req.params.id;
    const dir = path.join(process.cwd(), 'uploads', 'quotes', String(id), 'rooms');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const uploadQuoteRoomPhoto = multer({
  storage: quoteRoomPhotoStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.includes(ext) || (file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new Error('Unsupported format. Use JPG, PNG, WebP, HEIC or HEIF'));
  },
});

const floorPlanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = req.params.id;
    const dir = path.join(process.cwd(), 'uploads', 'quotes', String(id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `floorplan_${Date.now()}${ext}`);
  },
});

export const uploadQuoteFloorPlan = multer({
  storage: floorPlanStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.includes(ext) || (file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new Error('Unsupported floor plan image format'));
  },
});
