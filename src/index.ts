import TokenGeneration from "token-generation";
import fs from "fs";
import mysql from "mysql";
import express from "express";
import Strings from "./strings";
import { v4 as createUUID } from "uuid";
import { env } from "./env";

const hmacKey = Buffer.from(fs.readFileSync("../hmacKey").toString(), "hex"); //HMAC KEY

const dbConfig = {
  host: env.db_host,
  user: env.db_user,
  password: env.db_password,
  database: env.db_database,
};
const pool = mysql.createPool(dbConfig);

const generation = new TokenGeneration(dbConfig, hmacKey);

const app = express();

app.use(express.json());
app.set("etag", false);
app.disable("x-powered-by");

interface IReminder {
  id: string;
  title: string | null;
  data: string | null;
  uuid: string;
}
interface IReminderDB {
  id: string;
  title: Buffer;
  data: Buffer;
  uuid: string;
}

const reminderTest = (reminder: IReminder) => {
  const titleTest = reminder.title && Buffer.from(reminder.title, "utf-8").byteLength <= 50;
  const dataTest = reminder.data && Buffer.from(reminder.data, "utf-8").byteLength <= 3000;
  const uuidTest = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(reminder.uuid);

  return titleTest && dataTest && uuidTest;
};

const updateReminderTest = (reminder: IReminder) => {
  const titleTest = reminder.title && Buffer.from(reminder.title, "utf-8").byteLength <= 50;
  const dataTest = reminder.data && Buffer.from(reminder.data, "utf-8").byteLength <= 3000;
  const uuidTest = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(reminder.uuid);

  return (titleTest || dataTest) && uuidTest;
};

const mapToEquationString = (map: Map<any, any>) => {
  let text = "";

  let i = 0;
  map.forEach((value, key) => {
    text += `${key}=${value}`;
    if (i != map.size - 1) {
      text += ",";
    }
    i++;
  });
  return text;
};

const reminderDBToReminder = (reminderDB: IReminderDB) => {
  return {
    id: reminderDB.id,
    title: reminderDB.title.toString("utf-8"),
    data: reminderDB.data.toString("utf-8"),
    uuid: reminderDB.uuid,
  };
};

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.get("/", (req, res) => {
  const tokenString = req.headers.authorization;
  const token = generation.verifyAccessToken(tokenString);
  if (!token) {
    return res.status(400).send({
      reason: "TOKEN_WRONG",
    });
  }
  const { id } = token;
  const { start, size } = req.body;

  if (!start && !size && typeof start != "number" && typeof size != "number") {
    return res.status(400).send({
      reason: "START_OR_SIZE_WRONG",
    });
  }

  pool.getConnection((err, connection) => {
    try {
      if (err) {
        return res.status(400).send({
          reason: "UNKNOWN_ERROR",
        });
      }
      connection.query(
        `SELECT * FROM reminder as i join (SELECT uuid FROM reminder WHERE id=? LIMIT ${start}, ${size}) AS t on i.uuid = t.uuid;`,
        [id],
        (err, results: Array<IReminderDB>) => {
          if (err) {
            return res.status(400).send({
              reason: "UNKNOWN_ERROR",
            });
          }

          const result: Array<IReminder> = new Array();
          results.forEach((value) => {
            result.push(reminderDBToReminder(value));
          });

          res.status(200).send(result);
        }
      );
    } finally {
      connection.release();
    }
  });
});

app.post("/", async (req, res) => {
  const tokenString = req.headers.authorization;
  const token = generation.verifyAccessToken(tokenString);
  if (!token) {
    return res.status(400).send({
      reason: "TOKEN_WRONG",
    });
  }
  const { id } = token;

  const { title, data } = req.body;
  const reminder: IReminder = { id: id, title: title, data: data, uuid: createUUID() };

  if (!reminderTest(reminder)) {
    return res.status(400).send({
      reason: "REMINDER_WRONG",
    });
  }

  pool.getConnection((err, connection) => {
    try {
      if (err) {
        return res.status(400).send({
          reason: "UNKNOWN_ERROR",
        });
      }
      connection.query(`INSERT INTO reminder VALUES(?,?,?,?);`, [id, title, data, reminder.uuid], (err) => {
        if (err) {
          return res.status(400).send({
            reason: "UNKNOWN_ERROR",
          });
        }
        res.status(200).send(reminder);
      });
    } finally {
      connection.release();
    }
  });
});
app.put("/", async (req, res) => {
  const tokenString = req.headers.authorization;
  const token = generation.verifyAccessToken(tokenString);
  if (!token) {
    return res.status(400).send({
      reason: "TOKEN_WRONG",
    });
  }
  const { id } = token;

  const { title, data, uuid } = req.body;

  const reminder: IReminder = { id: id, title: title, data: data, uuid: uuid };

  if (!updateReminderTest(reminder)) {
    return res.status(400).send({
      reason: "REMINDER_WRONG",
    });
  }

  pool.getConnection((err, connection) => {
    try {
      if (err) {
        return res.status(400).send({
          reason: "UNKNOWN_ERROR",
        });
      }

      const valuesMap = new Map();
      if (title) valuesMap.set("title", "?");
      if (data) valuesMap.set("data", "?");

      const values = new Array();
      if (title) values.push(title);
      if (data) values.push(data);
      values.push(id);
      values.push(uuid);

      connection.query(
        `UPDATE reminder SET ${mapToEquationString(valuesMap)} WHERE id=? AND uuid=?`,
        values,
        (err, result) => {
          if (err) {
            return res.status(400).send({
              reason: "UNKNOWN_ERROR",
            });
          }

          if (result.affectedRows > 0) {
            return res.status(200).send();
          } else {
            return res.status(400).send({
              reason: "REMINDER_NOT_FOUND",
            });
          }
        }
      );
    } finally {
      connection.release();
    }
  });
});

app.delete("/", async (req, res) => {
  const tokenString = req.headers.authorization;
  const token = generation.verifyAccessToken(tokenString);
  if (!token) {
    return res.status(400).send({
      reason: "TOKEN_WRONG",
    });
  }
  const { id } = token;

  const { uuid } = req.body;

  pool.getConnection((err, connection) => {
    try {
      if (err) {
        return res.status(400).send({
          reason: "UNKNOWN_ERROR",
        });
      }
      connection.query(`DELETE FROM reminder WHERE uuid=? AND id=?`, [uuid, id], (err, result) => {
        if (err) {
          return res.status(400).send({
            reason: "UNKNOWN_ERROR",
          });
        }

        if (result.affectedRows > 0) {
          return res.status(200).send();
        } else {
          return res.status(400).send({
            reason: "REMINDER_NOT_FOUND",
          });
        }
      });
    } finally {
      connection.release();
    }
  });
});

const strings = new Strings();
strings.use(app);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).send(`Error ${err.status || 500}`);
});

app.listen(env.port, () => {
  console.log(`The program is running on port ${env.port}`);
});
