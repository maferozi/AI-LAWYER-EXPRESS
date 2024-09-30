const { Sequelize } = require('sequelize');

require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT,
});

const startServer = async ()=>{
try {
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  console.error('Unable to connect to the database:', error);
}
// sequelize.close();
// console.log('Connection has been disonnected successfully.');
}

module.exports = {startServer,sequelize};
