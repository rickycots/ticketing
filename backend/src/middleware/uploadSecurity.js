const fs = require('fs');
const path = require('path');

// Dangerous extensions that must NEVER be uploaded
const DANGEROUS_EXTENSIONS = new Set([
  '.php', '.php3', '.php4', '.php5', '.php7', '.phtml', '.phar',
  '.asp', '.aspx', '.jsp', '.jspx', '.cgi', '.pl', '.py', '.rb',
  '.sh', '.bash', '.bat', '.cmd', '.com', '.exe', '.msi', '.dll',
  '.htaccess', '.htpasswd', '.ini', '.env', '.config',
  '.shtml', '.shtm', '.svg', '.swf',
]);

// Magic byte signatures for known file types
const MAGIC_BYTES = {
  '.jpg':  [Buffer.from([0xFF, 0xD8, 0xFF])],
  '.jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  '.png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  '.gif':  [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  '.bmp':  [Buffer.from('BM')],
  '.webp': [Buffer.from('RIFF')],
  '.pdf':  [Buffer.from('%PDF')],
  '.zip':  [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
  '.rar':  [Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07])],
  '.7z':   [Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])],
  '.doc':  [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
  '.xls':  [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
  '.ppt':  [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
  '.docx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  '.xlsx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  '.pptx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
};

/**
 * Check if filename contains any dangerous extension (double-extension attack)
 */
function hasDangerousExtension(filename) {
  const parts = filename.toLowerCase().split('.');
  parts.shift(); // remove basename
  return parts.some(part => DANGEROUS_EXTENSIONS.has('.' + part));
}

/**
 * Validate file magic bytes match declared extension
 * @returns {boolean} true if valid or extension has no known signature
 */
function validateMagicBytes(filePath, ext) {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return true; // no signature to check (txt, md, csv, etc.)

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    return signatures.some(sig => buf.subarray(0, sig.length).equals(sig));
  } catch {
    return false;
  }
}

/**
 * Create a multer fileFilter that validates extensions + blocks double-extensions
 * @param {string[]} allowedExts - e.g. ['.jpg', '.png', '.pdf']
 */
function createFileFilter(allowedExts) {
  return (req, file, cb) => {
    // Check double-extension attack
    if (hasDangerousExtension(file.originalname)) {
      return cb(new Error('Nome file non consentito (estensione pericolosa)'));
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return cb(new Error(`Formato non supportato: ${ext}`));
    }

    cb(null, true);
  };
}

/**
 * Express middleware: validate magic bytes of uploaded files AFTER multer saves them
 * Deletes files that fail validation and returns 400
 */
function validateUploadedFiles(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!validateMagicBytes(file.path, ext)) {
      // Delete the invalid file
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({
        error: `Il contenuto del file "${file.originalname}" non corrisponde all'estensione dichiarata`,
      });
    }
  }
  next();
}

module.exports = { createFileFilter, validateUploadedFiles, hasDangerousExtension, validateMagicBytes };
