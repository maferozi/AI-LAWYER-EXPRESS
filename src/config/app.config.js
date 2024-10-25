require('dotenv').config();
const express = require('express');
const {startServer} = require('./db.config');
const app = express();
const PORT = process.env.PORT;
const cors = require("cors");
const router = require('../routes');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const { initializeIndex } = require('../helper/pineconeServices');
const us = User();


app.use(cors());
app.use(express.json()); 
app.use("/api",router);
app.use((error, req, res, next) => {
    if (!error) {
      return next();
    } else {
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal Server Error';
      console.log(message)
      return res.status(statusCode).json({
        message,
      });
    }
  });







  Message.belongsTo(Chat, {
    foreignKey: 'chatId',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE',  
  });
  Chat.hasMany(Message, {
    foreignKey: 'chatId',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE',   
  });
  Chat.belongsTo(us, {
    foreignKey: 'userId',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE',   
  });
  us.hasMany(Chat, {
    foreignKey: 'userId',
    onDelete: 'CASCADE', 
    onUpdate: 'CASCADE', 
  });
  

const appConfig = async ()=>{
  try {
    await startServer();
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
}

module.exports = {appConfig};