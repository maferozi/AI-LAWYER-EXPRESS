const { sequelize } = require("../config/db.config");
const { DataTypes } = require("sequelize");
const Chat = require("./Chat");

const Message = sequelize.define(
  "Message",
  {
    messageId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: "message_id",
    },
    chatId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Chats",
        key: "chat_id",
      },
      field:"chat_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    messageText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "message_text",
    },
    messageType: {
      type: DataTypes.ENUM("prompt", "response"),
      allowNull: false,
      field: "message_type",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "Messages",
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: "created_at",
  }
);


module.exports = Message;
