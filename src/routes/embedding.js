const { createEmbedding, searchEmbedding, getChatMessage, getAllChats } = require("../controller/embedding.controller");
const authenticateToken = require("../middleware/authenticateToken");


const embedRouter = require("express").Router();

embedRouter.post('/search', authenticateToken, searchEmbedding);
embedRouter.post('/upsert', authenticateToken, createEmbedding);
embedRouter.post('/getMessage', authenticateToken, getChatMessage);
embedRouter.get('/getAllChats', authenticateToken, getAllChats);

module.exports = embedRouter;