const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

// Storage for images
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'diary-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

// Storage for voice notes
const voiceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'voice-notes',
    resource_type: 'video', // Cloudinary handles audio as video
    allowed_formats: ['mp3', 'wav', 'm4a', 'webm'],
    transformation: [{ audio_codec: 'aac' }]
  }
});

// Create multer upload instances
const uploadImage = multer({ 
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadVoice = multer({ 
  storage: voiceStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

module.exports = { uploadImage, uploadVoice, cloudinary };