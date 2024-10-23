const authRouter = require("./auth");
const embedRouter = require("./embedding");
const putMigration = require("./putMigration");
const { registerRules } = require("./validation/auth");


const router = require("express").Router();

router.use('/auth',authRouter);
router.use('/migration', putMigration);
router.use('/embedding', embedRouter);

module.exports = router;