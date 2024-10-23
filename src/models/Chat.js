const { sequelize } = require("../config/db.config");
const { DataTypes } = require("sequelize");
const User = require("./User");

const Chat = sequelize.define(
  "Chat",
  {
    chatId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: "chat_id",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "User",
        key: "user_id",
      },
      field: "user_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    chatTitle: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "chat_title",
      },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    tableName: "Chats",
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: "created_at",
  }
);



module.exports = Chat;
