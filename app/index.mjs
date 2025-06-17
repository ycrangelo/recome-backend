import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import spotifyRoute from './routes/spotifyRoute.mjs'

dotenv.config();
const app = express();
// Add these middleware
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing form data

// CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB with retry logic
const connectWithRetry = async () => {
  try {
    await mongoose.connect("mongodb+srv://lornayocor:cXqrgEX74ex576j3@juntos.n0m0ol6.mongodb.net/?retryWrites=true&w=majority&appName=juntos");
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    setTimeout(connectWithRetry, 5000);
  }
};

// Initialize the model (lazy load)
let classifier;
async function getClassifier() {
  if (!classifier) {
    classifier = await pipeline('image-classification', 'Xenova/facial_emotions_image_detection');
  }
  return classifier;
}

// Test route
app.get('/', (req, res) => {
  res.send('Server is running spotify-reco');
});

// API endpoint for URL-based image processing
app.get('/predict', async (req, res) => {
  try {
    const { imageUrl } = req.query;
    if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

    const model = await getClassifier();
    const output = await model(imageUrl, { topk: 3 });
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const s3 = new S3Client({ 
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// for storing image to aws
app.get('/get-presigned-url', async (req, res) => {
  try {
    const fileType = req.query.type || 'jpg'; // Default to JPEG
    const fileName = `images/${Date.now()}.${fileType}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      ContentType: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`, // Correct MIME type
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url, fileName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// // API endpoint for file uploads
// app.post('/upload', upload.single('image'), async (req, res) => {
//   try {
//     const model = await getClassifier();
//     const output = await model(req.file.path, { topk: 3 });
//     res.json(output);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

app.use('/', spotifyRoute);

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Initialize connections
connectWithRetry();