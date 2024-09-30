require('dotenv').config();
const express = require('express');
const {startServer} = require('./db.config');
const app = express();
const PORT = process.env.PORT;
const cors = require("cors");
const User = require('../models/User');
const router = require('../routes');


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
  


module.exports = ()=>{
startServer();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
}