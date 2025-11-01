// Migrations.test.ts
import {beforeEach, describe, expect, it} from "vitest";
import {Migrations} from "../src/lib/Migrations";
import {DatabaseInstructions} from "../src";
import {ALLOWED, NO_COLUMN, USED} from "../src/lib/typings/AllowedMigrations";

describe("Migrations", () => {
	let migrations: Migrations;
	let dbInstructions: DatabaseInstructions;
	
	beforeEach(() => {
		dbInstructions = {
			version: 5,
			alwaysAllowedMigrations: [],
			throwIfNotAllowed: true,
			dialect: "Sqlite",
			tables: [],
			configPath: `${process.cwd()}/config/`,
		};
		migrations = new Migrations();
	});
	
	describe("reset", () => {
		it("should reset migration data and update versions", () => {
			dbInstructions.version = 5;
			migrations.reset(dbInstructions, 3);
			const migrationData = migrations.getMigrationData();
			
			expect(migrationData).toEqual({});
			expect(migrations["fromVersion"]).toBe(3);
			expect(migrations["toVersion"]).toBe(5);
			expect(migrations["alwaysAllowed"]).toEqual(dbInstructions.alwaysAllowedMigrations);
		});
	});
	
	describe("versionIsRelevant", () => {
		it("should return true for relevant versions and update lastUsedVersion", () => {
			dbInstructions.version = 5;
			migrations.reset(dbInstructions, 2);
			
			expect(migrations["versionIsRelevant"](3)).toBe(true);
			expect(migrations["lastUsedVersion"]).toBe(3);
		});
		
		it("should return false for versions outside range", () => {
			dbInstructions.version = 5;
			migrations.reset(dbInstructions, 2);
			
			expect(migrations["versionIsRelevant"](2)).toBe(false);
			expect(migrations["versionIsRelevant"](6)).toBe(false);
		});
		
		it("should throw an error for out-of-order versions", () => {
			dbInstructions.version = 5;
			migrations.reset(dbInstructions, 2);
			migrations["lastUsedVersion"] = 4;
			
			expect(() => migrations["versionIsRelevant"](3)).toThrow("Migrations in preMigration() have to be ordered by version (beginning with the lowest version)."
			);
		});
	});
	
	describe("verifyRenamingTasks", () => {
		it("should return an error if table is renamed to itself", () => {
			migrations["migrationData"] = {
				testTable: {
					tableRenaming: {oldName: "testTable", newName: "testTable"},
					renamedColumns: [],
					allowedMigrations: {},
					recreate: false,
				},
			};
			
			const result = migrations.verifyRenamingTasks({});
			expect(result).toEqual(new Error("You set table \"testTable\" to be renamed to itself!"));
		});
	});
	
	describe("verifyAllowedMigrations", () => {
		it("should return an error if there are unused allowed migrations", () => {
			migrations["migrationData"] = {
				testTable: {
					allowedMigrations: {dropTable: {[NO_COLUMN] : ALLOWED}},
					renamedColumns: [],
					recreate: false,
				},
			};
			
			const result = migrations.verifyAllowedMigrations();
			expect(result).toEqual(new Error("Migration \"dropTable\" for testTable was allowed but not needed.\n"));
		});
		
		it("should return an error if there are unused columns in allowed migrations", () => {
			migrations["migrationData"] = {
				testTable: {
					allowedMigrations: {dropColumn: {"test1" : USED, "test2" : ALLOWED}},
					renamedColumns: [],
					recreate: false,
				},
			};
			
			const result = migrations.verifyAllowedMigrations();
			expect(result).toEqual(new Error("Migration \"dropColumn\" for testTable.test2 was allowed but not needed.\n"));
		});
		
		it("should not return an error if migrations were used", () => {
			migrations["migrationData"] = {
				testTable: {
					allowedMigrations: {
						dropColumn: {"test1" : USED, "test2" : USED},
						dropTable: {[NO_COLUMN] : USED}
					},
					renamedColumns: [],
					recreate: false,
				},
			};
			
			const result = migrations.verifyAllowedMigrations();
			expect(result).toEqual(void 0);
		});
	});
	
	describe("compareWithAllowedMigration", () => {
		it("should add migration to notAllowedChanges if not allowed", () => {
			migrations["toVersion"] = 5;
			migrations.compareWithAllowedMigration("testTable", "dropColumn", "columnName");
			
			expect(migrations["notAllowedChanges"]).toEqual([
				{version: 5, tableName: "testTable", column: "columnName", type: "dropColumn"},
			]);
		});
	});
	
	describe("recreateTable", () => {
		it("should mark a table for recreation if the version is relevant", () => {
			dbInstructions.version = 5;
			const table = {name: "testTable"};
			migrations.reset(dbInstructions, 3);
			
			migrations.recreateTable(4, table);
			
			expect(migrations.willBeRecreated(table.name)).toBe(true);
		});
		
		it("should not mark a table for recreation if the version is not relevant", () => {
			dbInstructions.version = 5;
			const table = {name: "testTable"};
			migrations.reset(dbInstructions, 3);
			
			migrations.recreateTable(2, table);
			
			expect(migrations.willBeRecreated(table.name)).toBe(undefined);
		});
	});
	
	describe("renameTable", () => {
		it("should rename a table if the version is relevant", () => {
			migrations.reset(dbInstructions, 3);
			migrations.renameTable(4, "oldTableName", {name: "newTableName"});
			
			expect(migrations.getNewestTableName("oldTableName")).toBe("newTableName");
		});
	});
	
	describe("renameColumn", () => {
		it("should rename a column if the version is relevant", () => {
			migrations.reset(dbInstructions, 3);
			migrations.renameColumn(4, {name: "testTable"}, "oldColumn", "newColumn");
			
			expect(migrations.getNewestColumnName("testTable", "oldColumn")).toBe("newColumn");
		});
	});
});