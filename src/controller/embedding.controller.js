require('dotenv').config();
const { generateEmbedding } = require("../helper/embeddingOpenai");
const { upsertVector, queryVector } = require("../helper/pineconeServices");
const Chat = require("../models/Chat");
const { v4: uuidv4 } = require("uuid");
const Message = require("../models/Message");
const fs = require('fs');
const pdf = require('pdf-parse');
const { chunkText, batchEmbeddings } = require("../helper/chunkText");
const { createPineconeConnection } = require("../config/pinecone.config");
const path = require('path');


const pineconeClient = createPineconeConnection();
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const PINECONE_NAMESPACE_NAME = process.env.PINECONE_NAMESPACE_NAME;


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


const uploadPdf = async (req, res) => {
  try {
    const { pdfName,chunkSize } = req.body;
    const filePath = path.join(__dirname, './../../', pdfName);
    const pdfBuffer = fs.readFileSync(filePath);
    const data = await pdf(pdfBuffer);
    const text = data.text;
    
    const chunks = chunkText(text, chunkSize);

    const chunkEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const vector = await generateEmbedding(chunk);
        return {
          id: `penal-pdf-chunk-${index}`,
          values: vector,
          metadata: { chunkIndex: index, text: chunk },
        };
      })  
    );

    console.log(chunkEmbeddings.length);
    const batches =  batchEmbeddings(chunkEmbeddings, 100)
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
  
        await index.namespace(PINECONE_NAMESPACE_NAME).upsert(
          batch
        );
        console.log(`Batch ${i + 1}/${batches.length} upserted successfully.`);
      } catch (error) {
        console.error(`Error upserting batch ${i + 1}:`, error);
      }
    }

    try {
      
  
      console.log("Vector upserted successfully:");
    } catch (error) {
      console.error("Error upserting vector:", error);
      throw new Error("Error upserting vector");
    }

    res.status(200)
      .json({ message: "File Embedded and stored successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { searchEmbedding, createEmbedding, getChatMessage, getAllChats, testSearchEmbedding, uploadPdf };
