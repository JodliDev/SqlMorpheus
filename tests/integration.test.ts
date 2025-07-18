import {test, describe, expect, beforeEach} from "vitest";
import BetterSqlite3 from "better-sqlite3";
import * as fs from "node:fs";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import {prepareAndRunMigration, rollback} from "../src";

describe("Integration tests", () => {
	const configPath = `${process.cwd()}/config/`;
	async function runTest(runGetStatement: (query: string) => Promise<unknown>, runMultipleWriteStatements: (query: string) => Promise<void>, getTables: () => Promise<string[]>) {
		//Create tables:
		
		const characters = {
			id: 0,
			firstName: "Drummer",
			age: 0
		}
		const places = {
			id: 0,
			planets: 1,
			colonized: true,
			name: "Earth"
		}
		const instructions = {
			dialect: "Sqlite",
			tables: {
				characters: {columns: characters, tableInfo: {primaryKey: "id"}},
				places: {columns: places, tableInfo: {primaryKey: "id"}},
			},
			version: 1,
			configPath: configPath,
			alwaysAllowedMigrations: {
				alterPrimaryKey: true,
				recreateTable: true
			},
			throwIfNotAllowed: true,
		} satisfies DatabaseInstructions;
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		expect(await getTables()).toEqual(["characters", "places"]);
		
		
		//Fill entries:
		
		const entry1 = {...characters, firstName: "Holden", age: 30};
		const entry2 = {...characters, firstName: "Naomi", age: 28};
		await runMultipleWriteStatements(`INSERT INTO characters (firstName, age) VALUES ('${entry1.firstName}', ${entry1.age});`);
		await runMultipleWriteStatements(`INSERT INTO characters (firstName, age) VALUES ('${entry2.firstName}', ${entry2.age});`);
		
		let entries = await runGetStatement(`SELECT * FROM characters;`);
		expect(entries, "id column should have been incremented").toEqual([
			{...entry1, id: 1},
			{...entry2, id: 2}
		]);
		
		
		//Change table structure:
		
		++instructions.version;
		(instructions.tables.characters.columns as any).newId = 0;
		instructions.tables.characters.tableInfo.primaryKey = "newId";
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		entries = await runGetStatement(`SELECT * FROM characters;`);
		expect(entries, "newId column should be created").toEqual([
			{...entry1, id: 1, newId: 1},
			{...entry2, id: 2, newId: 2}
		]);
		
		
		//Rollback one step:
		
		await rollback({runGetStatement, runMultipleWriteStatements}, instructions, instructions.version - 1);
		entries = await runGetStatement(`SELECT * FROM characters;`);
		expect(entries, "Tables should be in first state").toEqual([
			{...entry1, id: 1},
			{...entry2, id: 2}
		]);
		
		
		//Rollback to empty state:
		
		await rollback({runGetStatement, runMultipleWriteStatements}, instructions, instructions.version - 1);
		expect(await getTables()).toEqual([]);
	}
	
	beforeEach(() => {
		const migrationPath = `${configPath}migrations`;
		const versionPath = `${configPath}last_version.txt`;
		
		if(fs.existsSync(migrationPath))
			fs.rmSync(migrationPath, { recursive: true, force: true });
		if(fs.existsSync(versionPath))
			fs.rmSync(versionPath);
	});
	
	test("Sqlite", async () => {
		const db = new BetterSqlite3(":memory:");
		
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
