import mysql from "mysql";
import jwt from "jsonwebtoken";
import { addDays, addMinutes } from "./time";

interface IToken {
  type: string;
  expires: number;
}
interface IRefreshToken extends IToken {
  id: string;
  generation: number;
}
interface IAccessToken extends IToken {
  id: string;
}
interface IGeneration {
  id: string;
  generation: number;
}

class TokenGeneration {
  private pool: mysql.Pool;
  private hmacKey: Buffer;

  constructor(config: mysql.PoolConfig, hmacKey: Buffer) {
    this.pool = mysql.createPool(config);
    this.hmacKey = hmacKey;
  }
  private async getGeneration(id: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        try {
          if (err) {
            return reject(err);
          }

          connection.query(`SELECT generation FROM generation WHERE id=?`, [id], (err, results: Array<IGeneration>) => {
            if (err) {
              return reject(err);
            }

            //ID without generation
            if (results.length == 0) {
              connection.query(`INSERT INTO generation VALUES(?, 0)`, [id]);
              return resolve(0);
            }

            return resolve(results[0].generation);
          });
        } finally {
          connection.release();
        }
      });
    });
  }
  async addGeneration(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) {
          return reject(err);
        }

        try {
          connection.query(`UPDATE generation SET generation=generation+1 WHERE id=?;`, [id]);
          resolve();
        } finally {
          connection.release();
        }
      });
    });
  }
  async checkGeneration(token: IRefreshToken): Promise<boolean> {
    try {
      const _generation = await this.getGeneration(token.id);

      if (_generation > token.generation) {
        return false;
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
  async createRefreshToken(id: string, days: number): Promise<IRefreshToken> {
    const refreshToken: IRefreshToken = {
      type: "refresh",
      expires: addDays(days).getTime(),
      id: id,
      generation: await this.getGeneration(id),
    };
    return refreshToken;
  }
  async updateRefreshToken(token: IRefreshToken, days: number): Promise<IRefreshToken | null> {
    if (!(await this.checkGeneration(token))) return null;
    token.expires = addDays(days).getTime();

    return token;
  }
  async createAccessToken(refreshToken: IRefreshToken, minutes: number): Promise<IAccessToken | null> {
    const { id } = refreshToken;
    if (!(await this.checkGeneration(refreshToken))) return null;

    const accessToken: IAccessToken = {
      type: "access",
      expires: addMinutes(minutes).getTime(),
      id: id,
    };

    return accessToken;
  }
  tokenToString(token: IToken): string {
    return jwt.sign(token, this.hmacKey, { algorithm: "HS256", noTimestamp: true });
  }
  private verifyToken(tokenString: string): IToken | null {
    try {
      const token = jwt.verify(tokenString, this.hmacKey) as IToken;
      if (token.expires < new Date().getTime()) return null;
      return token;
    } catch (e) {
      return null;
    }
  }
  close() {
    this.pool.end();
  }
  verifyRefreshToken(refreshToken: string | undefined): IRefreshToken | null {
    if (!refreshToken) return null;
    const token = this.verifyToken(refreshToken);
    if (!token) return null;

    if (token.type !== "refresh") return null;
    else return token as IRefreshToken;
  }
  verifyAccessToken(accessToken: string | undefined): IAccessToken | null {
    if (!accessToken) return null;
    const token = this.verifyToken(accessToken);
    if (!token) return null;

    if (token.type !== "access") return null;
    else return token as IAccessToken;
  }
}

export default TokenGeneration;
export { IToken, IRefreshToken, IAccessToken };
