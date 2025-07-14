import {test, describe, expect} from "vitest";
import {MigrationManager} from "../src/lib/MigrationManager";
import {TestInstructions, TestTable1, TestTable1Variation1, TestTable2, TestTable2Variation1} from "./TestInstructions";
import BetterSqlite3 from "better-sqlite3";
import * as fs from "node:fs";


describe("Integration tests", () => {
	let instructions = new TestInstructions();
	
	async function runTest(runGetStatement: (query: string) => Promise<unknown>, runMultipleWriteStatements: (query: string) => Promise<void>, getTables: () => Promise<string[]>) {
		//Create tables:
		
		await new MigrationManager({runGetStatement, runMultipleWriteStatements}, instructions)
			.prepareAndRunMigration();
		
		expect(await getTables()).toEqual([TestTable1.name, TestTable2.name]);
		
		
		//Fill entries:
		
		const entry1 = new TestTable1();
		entry1.s1 = "test1";
		entry1.n1 = 25;
		
		const entry2 = new TestTable1();
		entry2.s1 = "test2";
		entry2.n1 = 35;
		
		await runMultipleWriteStatements(`INSERT INTO ${TestTable1.name} (s1, n1) VALUES ('${entry1.s1}', ${entry1.n1});`);
		await runMultipleWriteStatements(`INSERT INTO ${TestTable1.name} (s1, n1) VALUES ('${entry2.s1}', ${entry2.n1});`);
		
		let entries = await runGetStatement(`SELECT * FROM ${TestTable1.name};`);
		expect(entries, "id column should have been incremented").toEqual([{...entry1, id: 1, b1: 1}, {...entry2, id: 2, b1: 1}]);
		
		
		//Change table structure:
		
		++instructions.version;
		instructions.tables = [TestTable1Variation1, TestTable2Variation1];
		await new MigrationManager({runGetStatement, runMultipleWriteStatements}, instructions)
			.prepareAndRunMigration();
		
		entries = await runGetStatement(`SELECT * FROM ${TestTable1.name};`);
		expect(entries, "New id2 table should be created").toEqual([{...entry1, id: 1, id2: 1, b1: 1}, {...entry2, id: 2, id2: 2, b1: 1}]);
		
		
		//Rollback one step:
		
		await new MigrationManager({runGetStatement, runMultipleWriteStatements}, instructions).rollback(instructions.version - 1);
		entries = await runGetStatement(`SELECT * FROM ${TestTable1.name};`);
		expect(entries, "Tables should be in first state").toEqual([{...entry1, id: 1, b1: 1}, {...entry2, id: 2, b1: 1}]);
		
		
		//Rollback to empty state:
		
		await new MigrationManager({runGetStatement, runMultipleWriteStatements}, instructions).rollback(instructions.version - 1);
		expect(await getTables()).toEqual([]);
	}
	
	beforeEach(() => {
		instructions = new TestInstructions();
		const migrationPath = `${instructions.configPath}migrations`;
		const versionPath = `${instructions.configPath}last_version.txt`;
		
		if(fs.existsSync(migrationPath))
			fs.rmSync(migrationPath, { recursive: true, force: true });
		if(fs.existsSync(versionPath))
			fs.rmSync(versionPath);
	});
	
	test("Sqlite", async () => {
		const path = `${instructions.configPath}testDb.db`;
		fs.unlinkSync(path);
		console.log(`Using db at ${path}`);
		const db = new BetterSqlite3(path);
		
		await runTest(
			(query: string): Promise<unknown> => {
				return Promise.resolve(db.prepare(query).all());
			},
			(query: string): Promise<void> => {
				const transaction = db.transaction(() => {
					db.exec(query);
				});
				transaction();
				
				return Promise.resolve();
			},
			() => {
				return Promise.resolve(
					(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Record<string, string>[])
						.map((obj) => obj.name)
				);
			}
		);
	});
})
