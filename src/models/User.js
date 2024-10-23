
const {sequelize}= require('../config/db.config');
const { DataTypes } = require('sequelize');
const Chat = require('./Chat');

const User = () => {
    const User = sequelize.define(
      'User',
      {
        userId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'user_id',
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,

        },
        email: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
        },    
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          field: 'created_at',
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          field: 'updated_at',
        },
      },
      {
        tableName: 'User',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
      },
    );
   
   
    return User;
  };
  
  module.exports = User;