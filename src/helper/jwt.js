const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY
const generateToken = (data, expiresIn = '1h') => {
  const options = {
    expiresIn,
  };
  return jwt.sign(data, JWT_SECRET_KEY, options);
};

const verifyToken = (token) => jwt.verify(token, JWT_SECRET_KEY);

const decode = (token) => jwt.decode(token, JWT_SECRET_KEY);

module.exports = {
  generateToken,
  verifyToken,
  decode,
};
