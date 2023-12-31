require('dotenv').config()

const express = require('express')
const morgan = require('morgan')
// const redis = require("./lib/ioredis")
// const redis = require("redis")

const api = require('./api')
const { connectToDb } = require('./lib/mongo')
const { connectToRabbitMQ } = require('./lib/rabbitmq')
const {connectToRedis, rateLimit} = require('./lib/redis')

const app = express()
const port = process.env.PORT || 8000

app.use(morgan('dev'))
app.use(express.json())

app.use(async function(req, res, next){
    rateLimit(req, res, next)
});

app.use('/', api)

app.use('*', function (req, res, next) {
    res.status(404).json({
        error: "Requested resource " + req.originalUrl + " does not exist"
    })
})

/*
 * This route will catch any errors thrown from our API endpoints and return
 * a response with a 500 status to the client.
 */
app.use('*', function (err, req, res, next) {
    console.error("== Error:", err)
    res.status(500).send({
        err: "Server error.  Please try again later."
    })
})

connectToDb(async function () {
    // setTimeout(async () => {
    //     await connectToRabbitMQ(queueName);              For connecting to RabbitMQ
    //   }, 15000);
    app.listen(port, function () {
        console.log("== Server is running on port", port)
    })
})

connectToRedis()

