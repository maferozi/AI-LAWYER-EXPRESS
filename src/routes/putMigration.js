const router = require('express').Router(); 
const User = require('../models/User');


router.get('/start', async(req, res,next) => {
    try {
        await User().sync();
        res.status(200).json({message:'user table create'}

        )
    } catch (error) {
        next(error)
    }
});

module.exports = router;