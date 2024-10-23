const { generateEmbedding } = require("../helper/embeddingOpenai");
const { upsertVector, queryVector } = require("../helper/pineconeServices");
const Chat = require("../models/Chat");
const { v4: uuidv4 } = require("uuid");
const Message = require("../models/Message");

const createEmbedding = async (req, res) => {
  try {
    const { data } = req.body;
    const texts = data.map((item) => item.text);

    if (
      !Array.isArray(texts) ||
      !texts.every((item) => typeof item === "string")
    ) {
      return res
        .status(400)
        .json({ error: "Invalid input, expected an array of strings." });
    }

    for (const text of texts) {
      let embedding = await generateEmbedding(text);
      await upsertVector(embedding, text);
    }

    res
      .status(200)
      .json({ message: "Embedding created and stored successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const searchEmbedding = async (req, res, next) => {
  try {
    const { text, chatId } = req.body;
    let cha = chatId;
    const user = req.user;
    const embedding = await generateEmbedding(text);
    const results = await queryVector(embedding, text);

    if (cha == -99) {
      try {
        cha = await Chat.create({
          userId: user.userId,
          chatTitle: text,
        });
      } catch (error) {
        next(error);
      }
    }
    try {
      await Message.create({
        chatId: cha.chatId ? cha.chatId: cha,
        messageText: text,
        messageType: "prompt",
      });

      await Message.create({
        chatId: cha.chatId || cha,
        messageText: results,
        messageType: "response",
      });
    } catch (error) {
      next(error);
    }

    const respon = {
      text: results,
      type: "response",
      chatId: cha.chatId || cha,
      chatTitle: cha.chatTitle,
    };
    res.status(200).json(respon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const testSearchEmbedding = async (req, res, next) => {
  try {
    const { text } = req.body;
    const embedding = await generateEmbedding(text);
    const results = await queryVector(embedding, text);

    const respon = {
      text: results,
      type: "response",
    };
    res.status(200).json(respon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}




const getChatMessage = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    
    const messages = await Message.findAll({
      where: {
        chatId: chatId,
      },
    });
    const respon = {
      data: messages.map((item) => ({
        text: item.messageText,
        type: item.messageType,
      })),
      chatId,
    };
  
    res.status(200).json(respon);
  } catch (error) {
    next(error)
  }
};

const getAllChats = async (req, res, next) => {
try {
  const user = req.user;
  const chats = await Chat.findAll({
    where: {
      userId: user.userId,
    },
  });
  const respon = {
    data: chats.map((item) => ({
      chatTitle: item.chatTitle,
      chatId: item.chatId,
    })),
  };
  
  res.status(200).json(respon);
  
} catch (error) {
  next(error)
}

};

module.exports = { searchEmbedding, createEmbedding, getChatMessage, getAllChats, testSearchEmbedding };
