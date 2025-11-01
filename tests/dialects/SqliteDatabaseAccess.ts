import {DatabaseAccess} from "../../src";
import BetterSqlite3 from "better-sqlite3";

export class SqliteDatabaseAccess implements DatabaseAccess {
	private db: BetterSqlite3.Database;
	
	constructor() {
		this.db = new BetterSqlite3(':memory:');
	}
	
	public async runGetStatement(query: string): Promise<any[]> {
		return this.db.prepare(query).all();
	}
	
	public async runMultipleWriteStatements(query: string): Promise<void> {
		this.db.exec(query);
	}
	
	public close(): void {
		this.db.close();
	}
}