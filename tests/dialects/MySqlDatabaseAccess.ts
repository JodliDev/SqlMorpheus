import {DatabaseAccess} from "../../src";
import mysql from "mysql2/promise";
import {MySqlContainer} from "@testcontainers/mysql";

export class MySqlDatabaseAccess implements DatabaseAccess {
	private db: mysql.Connection;
	
	constructor(connection: mysql.Connection) {
		this.db = connection;
	}
	
	public async runGetStatement(query: string): Promise<any[]> {
		const [results, _fields] = await this.db.query(query);
		return results as any[];
	}
	
	public async runMultipleWriteStatements(query: string): Promise<void> {
		try {
			await this.db.beginTransaction();
			await this.db.query(query);
			await this.db.commit();
		}
		catch(e) {
			await this.db.rollback();
			throw e;
		}
	}
	
	public close(): void {
		this.db.destroy();
	}
	
	public static async create() {
		const container = await new MySqlContainer("mysql").start();
		const client = await mysql.createConnection({
			host: container.getHost(),
			port: container.getPort(),
			database: container.getDatabase(),
			user: container.getUsername(),
			password: container.getUserPassword(),
			multipleStatements : true,
		});
		client.connect();
		return new MySqlDatabaseAccess(client);
	}
}