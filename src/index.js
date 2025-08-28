require('dotenv').config();

const express = require('express');

const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http').createServer(app);
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const session = require('express-session');

const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

require('./socket')(io);


app.use(cors({
  origin: '*',
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "*",
}));

// app.options("*", cors());
app.options(/.*/, cors());


const connectDb = require('./configs/db');
connectDb();

const routes = require('./routes');
const { logger } = require('./utils');

app.set('socketio', io);

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

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/files', express.static(path.join(__dirname, '../files')));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const filesDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
  console.log("Created 'files' directory");
}

// require('./socket')(io);

const port = process.env.PORT || 3005;

http.listen(port, () => {
  logger.info(`Server Started in port : ${port}!`);
});

module.exports = app;