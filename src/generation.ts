import mysql from "mysql";
import jwt from "jsonwebtoken";
import util from "util";
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

class TokenGeneration {
  private pool: mysql.Pool;
  private hmacKey: Buffer;
  private getConnection: () => Promise<mysql.PoolConnection>;

  constructor(config: mysql.PoolConfig, hmacKey: Buffer) {
    this.pool = mysql.createPool(config);
    this.hmacKey = hmacKey;
    this.getConnection = util.promisify(this.pool.getConnection).bind(this.pool);
  }
  private async getGeneration(id: string): Promise<number> {
    const connection = await this.getConnection();
    const query = util.promisify(connection.query).bind(connection);

    try {
      const q: any = await query(`SELECT generation FROM generation where id="${id}";`);

      //generation이 없는 ID
      if (q.length == 0) {
        query(`INSERT INTO generation values("${id}", 0);`);
        return 0;
      }

      return q[0].generation;
    } finally {
      connection.release();
    }
  }
  async addGeneration(id: string): Promise<void> {
    const connection = await this.getConnection();
    const query = util.promisify(connection.query).bind(connection);

    query(`UPDATE generation set generation=generation+1 where id="${id}";`);
  }
  async checkGeneration(token: IRefreshToken): Promise<boolean> {
    const _generation = await this.getGeneration(token.id);

    if (_generation > token.generation) {
      return false;
    }
    return true;
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
