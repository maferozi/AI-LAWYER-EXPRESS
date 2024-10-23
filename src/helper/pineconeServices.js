
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { createPineconeConnection } = require("../config/pinecone.config");
const { generateTextFromEmbedding } = require("./embeddingOpenai");

const pineconeClient = createPineconeConnection();

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

async function upsertVector(embedding,text) {
  try {
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    await index.namespace('thirstyCrow').upsert(
      [{
        id: uuidv4(),
        values: embedding,
        metadata:{
          text: text
        }
      }]
    );

    console.log("Vector upserted successfully:");
  } catch (error) {
    console.error("Error upserting vector:", error);
    throw new Error("Error upserting vector");
  }
}

async function queryVector(embedding, topK = 5) {
  try {
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    const queryResponse = await index.namespace('thirstyCrow').query({
      topK: topK,
      vector: embedding,
      includeMetadata: true,
    });
    const textsArray = queryResponse.matches.map(match => match.metadata.text);
    return textsArray;
  } catch (error) {
    console.error("Error querying vector:", error.message);
    throw new Error("Error querying vector");
  }
}

async function initializeIndex() {
  try {
    const existingIndexes = await pineconeClient.listIndexes();
    // !existingIndexes.indexes.name === PINECONE_INDEX_NAME
    if (1) {
      await pineconeClient.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 1536,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(`Created Pinecone index: ${PINECONE_INDEX_NAME}`);
    } else {
      console.log(`Pinecone index '${PINECONE_INDEX_NAME}' already exists.`);
    }
  } catch (error) {
    console.error("Error initializing index:", error.message);
    throw new Error("Error initializing index");
  }
}



module.exports = {
  upsertVector,
  queryVector,
  initializeIndex,
};
