import {beforeEach, describe, expect, it, vi} from "vitest";
import {DatabaseAccess} from "../src";
import {MigrationManager} from "../src/lib/MigrationManager";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import {SqlChanges} from "../src";
import DefaultSql from "../src/lib/dialects/DefaultSql";
import {ColumnInfo} from "../src/lib/typings/ColumnInfo";
import NotAllowedException from "../src/lib/exceptions/NotAllowedException";
import TableObj from "../src/lib/tableInfo/TableObj";
import {ForeignKeyInfo} from "../src/lib/typings/ForeignKeyInfo";
import {NO_COLUMN} from "../src/lib/typings/AllowedMigrations";

class DefaultDialect extends DefaultSql {
    public changeForeignKeysState(enabled: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
	getColumnInformation(_: string): Promise<Record<string, ColumnInfo>> {
		return Promise.resolve({});
	}
	
	getTableNames(): Promise<string[]> {
		return Promise.resolve([]);
	}
	
	async getForeignKeys(): Promise<ForeignKeyInfo[]> {
		return Promise.resolve([]);
	}
}

describe("MigrationManager", () => {
	const mockDb: DatabaseAccess = {
		createBackup: vi.fn(),
		runReadStatement: vi.fn(() => Promise.resolve([])),
		runWriteStatement: vi.fn(() => Promise.resolve()),
		runTransaction: vi.fn(),
	};
	let mockDialect: DefaultDialect
	
	let mockDbInstructions: DatabaseInstructions;
	beforeEach(() => {
		mockDialect = new DefaultDialect(mockDb);
		mockDbInstructions = {
			dialect: "Sqlite",
			version: 1,
			tables: [],
			preMigration: vi.fn(),
			postMigration: vi.fn(),
		};
	});
	
	describe("Version checks", () => {
		it("should throw an error if migrating to version 0 or lower", async() => {
			const manager = new MigrationManager(mockDialect);
			
			
			await expect(
				manager.generateSqlChanges({...mockDbInstructions, version: 0})
			).rejects.toThrow("Cannot migrate to version 0 or lower");
		});
		
		it("should return null if the current version matches the target version", async() => {
			mockDialect.getVersion = () => Promise.resolve(1);
			const manager = new MigrationManager(mockDialect);
			
			const result = await manager.generateSqlChanges({...mockDbInstructions, version: 1});
			
			
			expect(result).toBeNull();
		});
		
		it("should throw an error when trying to migrate to a lower version", async() => {
			mockDialect.getVersion = () => Promise.resolve(2);
			const manager = new MigrationManager(mockDialect)
			
			
			await expect(manager.generateSqlChanges({...mockDbInstructions, version: 1})).rejects.toThrow(
				"You cannot create new migrations with a lower version (from 2 to 1)"
			);
		});
		
		it("should create initial migration if history version is 0", async() => {
			mockDialect.getVersion = () => Promise.resolve(0);
			const mockResult: SqlChanges = {
				up: "-- Migration SQL",
				down: "-- Rollback SQL",
			};
			
			const manager = new MigrationManager(mockDialect);
			vi.spyOn(manager as any, "createAndDropTables").mockReturnValue(mockResult);
			
			const result = await manager.generateSqlChanges({...mockDbInstructions, version: 1});
			
			
			expect(result?.changes.up).toEqual(mockResult.up);
			expect(result?.changes.down).toEqual(mockResult.down);
		});
		
		it("should generate migration SQL if version increases", async() => {
			mockDialect.getVersion = () => Promise.resolve(1);
			const mockCreateAndDropTablesResult: SqlChanges = {
				up: "-- Create and Drop Tables SQL",
				down: "-- Rollback Create and Drop Tables SQL",
			};
			const mockMigrateForeignKeysResult: SqlChanges = {
				up: "-- Foreign Key Changes SQL",
				down: "-- Rollback Foreign Key Changes SQL",
			};
			
			const manager = new MigrationManager(mockDialect);
			vi.spyOn(manager as any, "createAndDropTables").mockReturnValue(mockCreateAndDropTablesResult);
			vi.spyOn(manager as any, "migrateForeignKeys").mockReturnValue(mockMigrateForeignKeysResult);
			
			const result = await manager.generateSqlChanges({...mockDbInstructions, version: 2});
			
			expect(result?.changes.up).toContain(mockCreateAndDropTablesResult.up);
			expect(result?.changes.up).toContain(mockMigrateForeignKeysResult.up);
			expect(result?.changes.down).toContain(mockCreateAndDropTablesResult.down);
			expect(result?.changes.down).toContain(mockMigrateForeignKeysResult.down);
		});
		
	});
	
	it("should correctly rename a column", async() => {
		//alter DatabaseInstructions:
		const tableA = TableObj.create("TableA", {newColumnA: ""});
		mockDbInstructions.tables = [tableA];
		mockDbInstructions.preMigration = (migrations) => {
			migrations.renameColumn(2, "TableA", "oldColumnA", "newColumnA");
		}
		
		//alter dialect:
		mockDialect.getVersion = () => Promise.resolve(1);
		mockDialect.getTableNames = () => Promise.resolve(["TableA"]);
		mockDialect.getColumnInformation = () => Promise.resolve({
			oldColumnA: {
				name: "oldColumnA",
				sqlType: mockDialect.getSqlType("string"),
				defaultValue: "\"\"",
				isPrimaryKey: false
			}
		});
		
		//setup manager
		const manager = new MigrationManager(mockDialect);
		
		//check results:
		const result = await manager.generateSqlChanges({...mockDbInstructions, version: 2});
		expect(result?.changes.up).toContain("ALTER TABLE TableA RENAME COLUMN oldColumnA TO newColumnA");
	});
	
	it("should throw if not allowed", async() => {
		//alter DatabaseInstructions:
		mockDbInstructions.tables = [];
		
		//alter dialect:
		mockDialect.getVersion = () => Promise.resolve(1);
		mockDialect.getTableNames = () => Promise.resolve(["TableA"]);
		mockDialect.getColumnInformation = () => Promise.resolve({
			oldColumnA: {
				name: "oldColumnA",
				sqlType: mockDialect.getSqlType("string"),
				defaultValue: "\"\"",
				isPrimaryKey: false
			}
		});
		
		//setup manager
		const manager = new MigrationManager(mockDialect);
		
		//check results:
		await expect(
			manager.generateSqlChanges({...mockDbInstructions, version: 2})
		).rejects.toThrow(new NotAllowedException([{version: 2, tableName: "TableA", type: "dropTable", column: NO_COLUMN}]));
	});
	
	it("should correctly rename a column", async() => {
		//alter DatabaseInstructions:
		const tableA = TableObj.create("TableA", {newColumnA: ""});
		mockDbInstructions.tables = [tableA];
		mockDbInstructions.preMigration = (migrations) => {
			migrations.renameColumn(2, "TableA", "oldColumnA", "newColumnA");
		}
		
		//alter dialect:
		mockDialect.getVersion = () => Promise.resolve(1);
		mockDialect.getTableNames = () => Promise.resolve(["TableA"]);
		mockDialect.getColumnInformation = () => Promise.resolve({
			oldColumnA: {
				name: "oldColumnA",
				sqlType: mockDialect.getSqlType("string"),
				defaultValue: "\"\"",
				isPrimaryKey: false
			}
		});
		
		//setup manager
		const manager = new MigrationManager(mockDialect);
		
		//check results:
		const result = await manager.generateSqlChanges({...mockDbInstructions, version: 2});
		expect(result?.changes.up).toContain("ALTER TABLE TableA RENAME COLUMN oldColumnA TO newColumnA");
	});
});