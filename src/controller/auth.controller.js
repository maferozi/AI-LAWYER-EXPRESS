const bcrypt = require('bcrypt');

const mod = require('../models/User');
const User = mod();
const { sequelize } = require('../config/db.config');
const { generateToken } = require('../helper/jwt');

const me = (req, res, _next) => {
  res.status(200).json({
    message: "IT me",
    user: req.user,
    token: req.token,
  })
};


const register = async (req, res, next) => {
    const {
      username, password, email
    } = req.body;
    
    try {
      const userExists = await User.findOne({
        where: { email },
      });
      if (userExists) {
        return res.status(409).json({
          status: '409',
          message: 'email_already_registered',
        });
      }
  
      return await sequelize.transaction(async (t) => {
       
        const hashedPassword = await bcrypt.hash(password,10);
        const newUser = await User.create(
          {
            username,
            email,
            password: hashedPassword,
          },
  
          { transaction: t },
        );
  
    
        return res.status(200).send({
          message: 'user_registered_successfully',
          user: newUser,
        });
      });
    } catch (error) {
      return next(error);
    }
  };
  
  const login = async (req, res, next) => {
    const { email, password } = req.body;
  
    try {
      const user = await User.findOne({
        where: { email },
      });
  
      if (!user) {
        const error = new Error('User Not Exists');
        error.statusCode = 401;
        throw error;
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        const error = new Error('invalid_Password');
        error.statusCode = 401;
        throw error;
      }
          
  
      const token = generateToken(
        {
          userId: user.userId,
          email: user.email,
        },
        '1h'
      );
  
      res.status(200).send({
        message: 'user_loggedin_successfully',
        token,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
        },
      });
    } catch (err) {
      next(err);
    }
  };
  

  module.exports = {me, register, login};