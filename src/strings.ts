import express from "express";
import path from "path";

class Strings {
  router: express.Router;

  constructor() {
    this.router = express.Router();
    this.router.use(express.static(path.join(__dirname, "../strings"), { extensions: ["json"] }));
  }
  use(app: express.Express) {
    app.use("/strings", this.router);
  }
}

export default Strings;
