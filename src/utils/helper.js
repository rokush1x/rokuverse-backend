const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');

const signToken = (user) =>
  jwt.sign({ uid: user.id, username: user.username, admin: user.is_admin }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const stripUser = (u) => ({
  id: u.id,
  username: u.username,
  balance: Number(u.balance),
  xp: u.xp,
  badge: u.badge,
  avatar_url: u.avatar_url || '',
  special_expiry: u.special_expiry,
  token_remaining: u.token_remaining,
  token_limit: u.token_limit
});

const levelFromXP = (xp) => Math.max(1, Math.min(999, Math.floor(xp / 100)));

function sanitize(str, max = 2000) {
  if (typeof str !== 'string') return '';
  return str.replace(/\0/g, '').slice(0, max);
}

module.exports = { signToken, stripUser, levelFromXP, sanitize };
