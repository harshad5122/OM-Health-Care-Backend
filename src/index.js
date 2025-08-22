require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http').createServer(app);
const cloudinary = require('cloudinary').v2;

const session = require('express-session');

  app.use(cors({ origin: '*' }));

const connectDb = require('./configs/db');
connectDb();

const routes = require('./routes');
const { logger } = require('./utils');

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use('/api', routes);

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const port = process.env.PORT || 3003;

http.listen(port, () => {
    logger.info(`Server Started in port : ${port}!`);
});

module.exports = app;