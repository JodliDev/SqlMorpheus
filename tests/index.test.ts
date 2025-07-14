import {test, describe, expect, beforeEach} from "vitest";
import BetterSqlite3 from "better-sqlite3";
import * as fs from "node:fs";
import Entity from "../src/lib/decorators/Entity";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import {BackendTable, Class} from "../src/lib/typings/BackendTable";
import {PublicMigrations} from "../src/lib/typings/Migrations";
import {SqlChanges} from "../src/lib/typings/SqlChanges";
import {prepareAndRunMigration, rollback} from "../src/index";


@Entity("TestTable1", "id")
export class TestTable1 {
	id: number = 0;
	s1: string = "s1";
	n1: number = 5;
	b1: boolean = true;
}

@Entity("TestTable1", "id2")
export class TestTable1Variation1 extends TestTable1 {
	id2: number = 0;
}


@Entity("TestTable2", "id")
export class TestTable2 {
	id: number = 0;
	ss1: string = "s1";
	nn1: number = 1;
	bb1: boolean = true;
	table1_id: number = 0;
}

@Entity("TestTable2", "id")
export class TestTable2Variation1 extends TestTable2 {
	newValue: string = "newValue";
}

export class TestInstructions implements DatabaseInstructions {
	dialect = "Sqlite";
	version: number = 1;
	configPath: string = `${process.cwd()}/configs/`;
	tables: Class<BackendTable>[] = [
		TestTable1,
		TestTable2
	];
	preMigration(migrations: PublicMigrations, fromVersion: number, toVersion: number): SqlChanges | void {
		migrations.alwaysAllow("alterPrimaryKey", "recreateTable");
	}
}

describe("Integration tests", () => {
	let instructions = new TestInstructions();
	
	async function runTest(runGetStatement: (query: string) => Promise<unknown>, runMultipleWriteStatements: (query: string) => Promise<void>, getTables: () => Promise<string[]>) {
		//Create tables:
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
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
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		entries = await runGetStatement(`SELECT * FROM ${TestTable1.name};`);
		expect(entries, "New id2 table should be created").toEqual([{...entry1, id: 1, id2: 1, b1: 1}, {...entry2, id: 2, id2: 2, b1: 1}]);
		
		
		//Rollback one step:
		
		await rollback({runGetStatement, runMultipleWriteStatements}, instructions, instructions.version - 1);
		entries = await runGetStatement(`SELECT * FROM ${TestTable1.name};`);
		expect(entries, "Tables should be in first state").toEqual([{...entry1, id: 1, b1: 1}, {...entry2, id: 2, b1: 1}]);
		
		
		//Rollback to empty state:
		
		await rollback({runGetStatement, runMultipleWriteStatements}, instructions, instructions.version - 1);
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
