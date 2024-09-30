const { register, login, me } = require("../controller/auth.controller");
const authenticateToken = require("../middleware/authenticateToken");
const { registerRules, loginRules } = require("./validation/auth");

const authRouter = require("express").Router();

authRouter.get('/test',(req,res)=>res.status(200).json({message:"Route testing ok!"}))
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authenticateToken, me);

module.exports = authRouter;