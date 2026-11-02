// JWT creation and HTTP-only cookie helpers.
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'token';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const cookieOptions = () => {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: prod,
    // Frontend (Vercel) and backend (Render) live on different domains in production.
    sameSite: prod ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
};

const setAuthCookie = (res, userId) => res.cookie(COOKIE_NAME, generateToken(userId), cookieOptions());
const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });

module.exports = { generateToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };
