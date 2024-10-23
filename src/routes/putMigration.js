const router = require('express').Router(); 
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const us = User();

router.get('/start', async(req, res,next) => {
    try {
        await us.sync({force:true})
        await Chat.sync({force:true})
        await Message.sync({force:true})
        res.status(200).json({message:'user table create'}

        )
    } catch (error) {
        next(error)
    }
});

module.exports = router;