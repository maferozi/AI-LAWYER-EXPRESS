const authRouter = require("./auth");
const putMigration = require("./putMigration");
const { registerRules } = require("./validation/auth");


const router = require("express").Router();

router.use('/auth',authRouter);
router.use('/migration', putMigration);


module.exports = router;