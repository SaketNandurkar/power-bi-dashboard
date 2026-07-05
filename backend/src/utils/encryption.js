const crypto = require('crypto');

// Use a fixed key from environment or generate one
// In production, this should be a strong secret key stored securely
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'apothecon-dashboard-encryption-key-2026-change-me!!';
const ALGORITHM = 'aes-256-cbc';

// Derive a 32-byte key from the encryption key
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:encrypted
 */
function encrypt(text) {
  if (!text) return text;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV and encrypted data separated by :
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted text in format: iv:encrypted
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    // If decryption fails, return as-is (might be unencrypted legacy value)
    return encryptedText;
  }
}

module.exports = { encrypt, decrypt };
