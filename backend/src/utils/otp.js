import crypto from 'node:crypto';

// Generate a cryptographically secure numeric OTP (default 6 digits).
export const generateOtp = (length = 6) =>
  crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');

// Hash an OTP with SHA-256 so it is never stored in plain text.
export const hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');

// Compare a plain OTP with a stored hash in constant time.
export const verifyOtp = (otp, hash) => {
  if (!otp || !hash) return false;
  const a = Buffer.from(hashOtp(otp), 'hex');
  const b = Buffer.from(String(hash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
