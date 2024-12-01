const cors = require("cors");
const express = require("express");
const bodyParser = require("body-parser");

const configureMiddleware = (app) => {
  app.use(
    cors({
      origin: [
        "https://backend-eight-phi-75.vercel.app",
        "http://localhost:3000",
        "https://proyek-3-proyek.github.io",
      ],
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
      optionsSuccessStatus: 200,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json());
  app.use(bodyParser.urlencoded({ extended: true }));
};

module.exports = configureMiddleware;
