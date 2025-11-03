import {DatabaseAccess} from "../../src";
import BetterSqlite3 from "better-sqlite3";

export class SqliteDatabaseAccess implements DatabaseAccess {
	private db: BetterSqlite3.Database;
	
	constructor() {
		this.db = new BetterSqlite3(':memory:');
	}
	
	public async runReadStatement(query: string): Promise<any[]> {
		return this.db.prepare(query).all();
	}
	
	public async runWriteStatement(query: string): Promise<void> {
		this.db.prepare(query).run();
	}
	
	public async runTransaction(query: string): Promise<void> {
		const transaction = this.db.transaction(() => {
			this.db.exec(query);
		});
		transaction();
	}
	
	/**
	 * Only used in dialects.integration.test.ts
	 */
	public close(): void {
		this.db.close();
	}
}