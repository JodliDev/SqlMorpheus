import {beforeEach, describe, expect, it, vi} from "vitest";
import {DatabaseAccess} from "../src";
import {MigrationManager} from "../src/lib/MigrationManager";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import {SqlChanges} from "../src";
import SqliteDialect from "../src/lib/dialects/SqliteDialect";

describe("MigrationManager", () => {
	const mockDb: DatabaseAccess = {
		createBackup: vi.fn(),
		runGetStatement: vi.fn(() => Promise.resolve([])),
		runMultipleWriteStatements: vi.fn(),
	};
	
	let mockDbInstructions: DatabaseInstructions;
	beforeEach(() => {
		mockDbInstructions = {
			dialect: "Sqlite",
			version: 1,
			configPath: `${process.cwd()}/config/`,
			tables: {},
			preMigration: vi.fn(),
			postMigration: vi.fn(),
		};
	});
	
	describe("Version checks", () => {
		it("should throw an error if migrating to version 0 or lower", async() => {
			const manager = new MigrationManager(mockDb, {...mockDbInstructions, version: 0});
			await expect(manager.getMigrateSql()).rejects.toThrow("Cannot migrate to version 0 or lower");
		});
		
		it("should return null if the current version matches the target version", async() => {
			const mockMigrationHistoryManager = {
				getLastHistoryVersion: vi.fn().mockReturnValue(1),
			};
			const manager = new MigrationManager(mockDb, {...mockDbInstructions, version: 1});
			vi.spyOn(manager as any, "migrationHistoryManager", "get").mockReturnValue(mockMigrationHistoryManager);
			
			const result = await manager.getMigrateSql();
			expect(result).toBeNull();
		});
		
		it("should throw an error when trying to migrate to a lower version", async() => {
			const mockMigrationHistoryManager = {
				getLastHistoryVersion: vi.fn().mockReturnValue(2),
			};
			const manager = new MigrationManager(mockDb, {...mockDbInstructions, version: 1});
			vi.spyOn(manager as any, "migrationHistoryManager", "get").mockReturnValue(mockMigrationHistoryManager);
			
			await expect(manager.getMigrateSql()).rejects.toThrow(
				"You cannot create new migrations with a lower version (from 2 to 1)"
			);
		});
		
		it("should create initial migration if history version is 0", async() => {
			const mockMigrationHistoryManager = {
				getLastHistoryVersion: vi.fn().mockReturnValue(0),
			};
			const manager = new MigrationManager(mockDb, {...mockDbInstructions, version: 1});
			vi.spyOn(manager as any, "migrationHistoryManager", "get").mockReturnValue(mockMigrationHistoryManager);
			
			const mockResult: SqlChanges = {
				up: "-- Migration SQL",
				down: "-- Rollback SQL",
			};
			vi.spyOn(manager as any, "createAndDropTables").mockReturnValue(mockResult);
			
			const result = await manager.getMigrateSql();
			
			expect(result).toEqual(mockResult);
		});
		
		it("should generate migration SQL if version increases", async() => {
			const mockMigrationHistoryManager = {
				getLastHistoryVersion: vi.fn().mockReturnValue(1),
			};
			const manager = new MigrationManager(mockDb, {...mockDbInstructions, version: 2});
			vi.spyOn(manager as any, "migrationHistoryManager", "get").mockReturnValue(mockMigrationHistoryManager);
			
			const mockCreateAndDropTablesResult: SqlChanges = {
				up: "-- Create and Drop Tables SQL",
				down: "-- Rollback Create and Drop Tables SQL",
			};
			vi.spyOn(manager as any, "createAndDropTables").mockReturnValue(mockCreateAndDropTablesResult);
			
			const mockMigrateForeignKeysResult: SqlChanges = {
				up: "-- Foreign Key Changes SQL",
				down: "-- Rollback Foreign Key Changes SQL",
			};
			vi.spyOn(manager as any, "migrateForeignKeys").mockReturnValue(mockMigrateForeignKeysResult);
			
			const result = await manager.getMigrateSql();
			
			expect(result?.up).toContain(mockCreateAndDropTablesResult.up);
			expect(result?.up).toContain(mockMigrateForeignKeysResult.up);
			expect(result?.down).toContain(mockCreateAndDropTablesResult.down);
			expect(result?.down).toContain(mockMigrateForeignKeysResult.down);
		});
		
	});
	
	describe("Migration history", () => {
		it("should create a migration history during prepareMigration", async() => {
			const mockCreateMigrationHistory = vi.fn();
			
			const manager = new MigrationManager(mockDb, mockDbInstructions);
			vi.spyOn(manager as any, "migrationHistoryManager", "get").mockReturnValue({
				createMigrationHistory: mockCreateMigrationHistory,
			});
			const mockSqlChanges: SqlChanges = {
				up: "-- Migration SQL",
				down: "-- Rollback SQL",
			};
			vi.spyOn(manager, "getMigrateSql").mockResolvedValue(mockSqlChanges);
			vi.spyOn(manager, "getMigrateSql").mockReturnValue(Promise.resolve(mockSqlChanges));
			
			await manager.prepareMigration();
			
			expect(mockCreateMigrationHistory).toHaveBeenCalledWith(mockDbInstructions.version, mockSqlChanges, undefined);
		});
		
		it("should not create migration history if no changes are detected", async() => {
			const mockCreateMigrationHistory = vi.fn();
			
			const manager = new MigrationManager(mockDb, mockDbInstructions);
			vi.spyOn(manager as any, "migrationHistoryManager", "get").mockReturnValue({
				createMigrationHistory: mockCreateMigrationHistory,
			});
			vi.spyOn(manager, "getMigrateSql").mockResolvedValue(null);
			
			await manager.prepareMigration();
			
			expect(mockCreateMigrationHistory).not.toHaveBeenCalled();
		});
	});
	
	
	it("should correctly rename a column", async() => {
		//create mock DatabaseInstructions:
		mockDbInstructions.tables = {
			TableA: {columns: {
				newColumnA: ""
			}}
		}
		mockDbInstructions.preMigration = (migrations) => {
			migrations.renameColumn("TableA", "oldColumnA", "newColumnA");
		}
		
		//create mock SqliteDialect:
		const sqliteMock = new SqliteDialect();
		sqliteMock.getVersion = () => Promise.resolve(1);
		sqliteMock.getTableNames = () => Promise.resolve(["TableA"]);
		sqliteMock.getColumnInformation = () => Promise.resolve([
			{
				name: "oldColumnA",
				type: sqliteMock.typeString,
				defaultValue: "\"\"",
				isPrimaryKey: false
			}
		]);
		
		//setup manager
		const manager = new MigrationManager(mockDb, {...mockDbInstructions, version: 2});
		vi.spyOn((manager as any), "dialect", "get").mockReturnValue(sqliteMock);
		
		//check results:
		const result = await manager.getMigrateSql();
		expect(result?.up).toContain(sqliteMock.renameColumn("TableA", "oldColumnA", "newColumnA"));
	});
});