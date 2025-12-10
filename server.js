require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const pHash = require('phash-im');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// === MongoDB Schema ===
const artworkSchema = new mongoose.Schema({
  perceptualHash: { type: String, required: true, unique: true },
  certificationId: { type: String, required: true, unique: true },
  originalName: String,
  filePath: String,
  uploadedAt: { type: Date, default: Date.now },
  ipAddress: String,
  // optional: track uploader
});

const Artwork = mongoose.model('Artwork', artworkSchema);

// === Uploads Folder ===
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'artFile' && !file.mimetype.startsWith('image/')) {
      return cb(new Error('Artwork must be an image'));
    }
    cb(null, true);
  }
});

// Serve static files (HTML, CSS, uploaded images)
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

// Compute perceptual hash
async function computePHash(filePath) {
  try {
    const hashBuffer = await pHash.compute(filePath);
    return hashBuffer.toString('hex');
  } catch (err) {
    throw new Error('Failed to compute perceptual hash: ' + err.message);
  }
}

// Hamming distance (for near-duplicate detection)
function hammingDistance(h1, h2) {
  let distance = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) distance++;
  }
  return distance;
}

// === Upload Route ===
app.post('/upload', upload.fields([
  { name: 'artFile', maxCount: 1 },
  { name: 'proofFiles', maxCount: 10 }
]), async (req, res) => {
  try {
    const artFile = req.files['artFile']?.[0];
    if (!artFile) {
      return res.status(400).json({ error: 'Artwork file is required' });
    }

    const filePath = artFile.path;
    const pHashHex = await computePHash(filePath);

    // Step 1: Check for exact match
    const exactMatch = await Artwork.findOne({ perceptualHash: pHashHex });
    if (exactMatch) {
      return res.json({
        status: 'duplicate',
        message: 'This exact artwork was already certified.',
        previousUpload: {
          certificationId: exactMatch.certificationId,
          uploadedAt: exactMatch.uploadedAt,
          filename: exactMatch.originalName
        }
      });
    }

    // Step 2: Check for very similar images (optional fuzzy match)
    const allArts = await Artwork.find({});
    for (const art of allArts) {
      const distance = hammingDistance(pHashHex, art.perceptualHash);
      if (distance <= 10) { // very similar (tune this threshold)
        return res.json({
          status: 'similar',
          message: 'A very similar artwork was already uploaded.',
          similarityScore: 100 - (distance / 64) * 100, // rough %
          previousUpload: {
            certificationId: art.certificationId,
            uploadedAt: art.uploadedAt,
            filename: art.originalName
          }
        });
      }
    }

    // Step 3: It's original → certify it!
    const certId = 'CERT-' + crypto.randomBytes(8).toString('hex').toUpperCase();

    const newArtwork = new Artwork({
      perceptualHash: pHashHex,
      certificationId: certId,
      originalName: artFile.originalname,
      filePath: filePath,
      ipAddress: req.ip || req.connection.remoteAddress
    });

    await newArtwork.save();

    res.json({
      status: 'success',
      message: 'Artwork certified as original!',
      certificationId: certId,
      uploadedAt: newArtwork.uploadedAt,
      previewUrl: `/uploads/${path.basename(filePath)}`
    });

  } catch (err) {
    console.error('Upload error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'This image was already certified (hash collision)' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Optional: API to verify a certification ID
app.get('/verify/:certId', async (req, res) => {
  const art = await Artwork.findOne({ certificationId: req.params.certId });
  if (!art) return res.status(404).json({ error: 'Not found' });
  res.json({
    valid: true,
    certificationId: art.certificationId,
    originalName: art.originalName,
    uploadedAt: art.uploadedAt,
    previewUrl: art.filePath ? `/uploads/${path.basename(art.filePath)}` : null
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Upload page: http://localhost:${PORT}/upload.html`);
});