import {describe, expect, it, test, vi, beforeEach, afterEach} from "vitest";
import SqliteDialect from "../../src/lib/dialects/SqliteDialect";
import {DatabaseAccess} from "../../src";
import BetterSqlite3 from "better-sqlite3";
import {afterAll} from "@vitest/runner";


class SqliteDatabaseAccess implements DatabaseAccess {
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

describe("SqliteDialect", () => {
	const mockAccess = {
		runGetStatement: vi.fn(),
		runMultipleWriteStatements: vi.fn(),
	} satisfies DatabaseAccess;
	
	const mockDialect = new SqliteDialect(mockAccess);
	
	it("changeForeignKeysState", () => {
		expect(mockDialect.changeForeignKeysState(true)).toBe("PRAGMA foreign_keys ON;");
		expect(mockDialect.changeForeignKeysState(false)).toBe("PRAGMA foreign_keys OFF;");
	});
	
	describe("formatValueToSql", () => {
		it("should format string values correctly", () => {
			const result = mockDialect.formatValueToSql("test", "string");
			expect(result).toBe('"test"');
		});
		
		it("should format date values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20"), "date");
			expect(result).toBe(new Date("2025-07-20").getTime().toString());
		});
		
		it("should format datetime values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00"), "dateTime");
			expect(result).toBe(new Date("2025-07-20T15:30:00").getTime().toString());
		});
		
		it("should format time values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00"), "time");
			expect(result).toBe(new Date("2025-07-20T15:30:00").getTime().toString());
		});
		
		it("should format true boolean values correctly", () => {
			const result = mockDialect.formatValueToSql(true, "boolean");
			expect(result).toBe("1");
		});
		
		it("should format false boolean values correctly", () => {
			const result = mockDialect.formatValueToSql(false, "boolean");
			expect(result).toBe("0");
		});
	});
	
	test("getForeignKeys", async() => {
		mockAccess.runGetStatement.mockResolvedValueOnce([
			{
				from: "child_id",
				table: "parent_table",
				to: "id",
				on_update: "CASCADE",
				on_delete: "SET NULL",
			},
		]);
		const foreignKeys = await mockDialect.getForeignKeys("child_table");
		expect(foreignKeys).toEqual([
			{
				fromTable: "child_table",
				fromColumn: "child_id",
				toTable: "parent_table",
				toColumn: "id",
				on_update: "CASCADE",
				on_delete: "SET NULL",
			},
		]);
	});
	
	test("getVersion", async() => {
		mockAccess.runGetStatement.mockResolvedValueOnce([{user_version: 2}]);
		const version = await mockDialect.getVersion();
		expect(version).toBe(2);
	});
	
	test("setVersion", async() => {
		await mockDialect.setVersion(3);
		expect(mockAccess.runMultipleWriteStatements).toHaveBeenCalledWith("PRAGMA user_version = 3;");
	});
	
	
	describe("Integration Tests", () => {
		const databaseAccess = new SqliteDatabaseAccess();
		const sqlDialect = new SqliteDialect(databaseAccess);
		
		afterAll(() => {
			databaseAccess.close();
		});
		describe("createTable", () => {
			//TODO add tests for all methods
			it("should create a table successfully", async() => {
				const tableName = "users";
				const entries = [
					sqlDialect.columnDefinition("id", sqlDialect.types.number, sqlDialect.formatValueToSql(3, "number"), true),
					sqlDialect.columnDefinition("name", sqlDialect.types.string, sqlDialect.formatValueToSql("test", "string"), false),
					sqlDialect.columnDefinition("AccountValue", sqlDialect.types.bigint, sqlDialect.formatValueToSql(BigInt(5), "bigint"), false),
					sqlDialect.columnDefinition("isSmart", sqlDialect.types.boolean, sqlDialect.formatValueToSql(true, "boolean"), false),
					sqlDialect.columnDefinition("birthday", sqlDialect.types.date, sqlDialect.formatValueToSql(new Date("2025-07-25"), "date"), false),
					sqlDialect.columnDefinition("wokenUpAt", sqlDialect.types.time, sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "time"), false),
					sqlDialect.columnDefinition("lastHouseFire", sqlDialect.types.dateTime, sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "dateTime"), false),
					sqlDialect.columnDefinition("royalTitle", sqlDialect.types.string, sqlDialect.types.null, false)
				];
				
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.createTable(tableName, entries)
				);
				
				
				const tables = await sqlDialect.getTableNames();
				expect(tables).toEqual(["users"]);
				
				const tableInfo = await sqlDialect.getColumnInformation("users");
				expect(tableInfo).toEqual([
					{name: "id", type: sqlDialect.types.number, defaultValue: sqlDialect.formatValueToSql(3, "number"), isPrimaryKey: true},
					{name: "name", type: sqlDialect.types.string, defaultValue: sqlDialect.formatValueToSql("test", "string"), isPrimaryKey: false},
					{name: "AccountValue", type: sqlDialect.types.bigint, defaultValue: sqlDialect.formatValueToSql(BigInt(5), "bigint"), isPrimaryKey: false},
					{name: "isSmart", type: sqlDialect.types.boolean, defaultValue: sqlDialect.formatValueToSql(true, "boolean"), isPrimaryKey: false},
					{name: "birthday", type: sqlDialect.types.date, defaultValue: sqlDialect.formatValueToSql(new Date("2025-07-25"), "date"), isPrimaryKey: false},
					{name: "wokenUpAt", type: sqlDialect.types.time, defaultValue: sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "time"), isPrimaryKey: false},
					{name: "lastHouseFire", type: sqlDialect.types.dateTime, defaultValue: sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "time"), isPrimaryKey: false},
					{name: "royalTitle", type: sqlDialect.types.string, defaultValue: sqlDialect.types.null, isPrimaryKey: false},
				]);
			});
		});
		
		describe("Table operations", () => {
			beforeEach(async() => {
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.createTable("users", ["id INTEGER PRIMARY KEY", "name TEXT"])
				);
			});
			afterEach(async() => {
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.dropTable("users")
				);
			});
			
			it("renameTable", async() => {
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.renameTable("users", "accounts")
				);
				
				const tables = await sqlDialect.getTableNames();
				expect(tables).toEqual(["accounts"]);
				
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.dropTable("accounts")
				);
			});
			it("dropTable", async() => {
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.dropTable("users")
				);
				
				const tables = await sqlDialect.getTableNames();
				expect(tables).toEqual([]);
			});
		});
		
		describe("Column operations", () => {
			beforeEach(async() => {
				// Create table
				const createQuery = sqlDialect.dropTable("users") + sqlDialect.createTable("users", ["id INTEGER PRIMARY KEY", "name TEXT"]);
				await databaseAccess.runMultipleWriteStatements(createQuery);
			});
			
			it("createColumn", async() => {
				const addColumnQuery = sqlDialect.createColumn("users", "new TEXT");
				await databaseAccess.runMultipleWriteStatements(addColumnQuery);
				
				const tableInfo = await sqlDialect.getColumnInformation("users");
				expect(tableInfo).toEqual([
					{name: "id", type: "INTEGER", defaultValue: null, isPrimaryKey: true},
					{name: "name", type: "TEXT", defaultValue: null, isPrimaryKey: false},
					{name: "new", type: "TEXT", defaultValue: null, isPrimaryKey: false},
				]);
			});
			it("renameColumn", async() => {
				const renameColumnQuery = sqlDialect.renameColumn("users", "name", "newName");
				await databaseAccess.runMultipleWriteStatements(renameColumnQuery);
				
				const tableInfo = await sqlDialect.getColumnInformation("users");
				expect(tableInfo).toEqual([
					{name: "id", type: "INTEGER", defaultValue: null, isPrimaryKey: true},
					{name: "newName", type: "TEXT", defaultValue: null, isPrimaryKey: false}
				]);
			});
			it("dropColumn", async() => {
				const dropColumnQuery = sqlDialect.dropColumn("users", "name");
				await databaseAccess.runMultipleWriteStatements(dropColumnQuery);
				
				const tableInfo = await sqlDialect.getColumnInformation("users");
				expect(tableInfo).toEqual([
					{name: "id", type: "INTEGER", defaultValue: null, isPrimaryKey: true}
				]);
			});
		});
		
		describe("Query Operations", () => {
			beforeEach(async () => {
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.createTable("test_table", [
						sqlDialect.columnDefinition("id", sqlDialect.types.number, "0", true),
						sqlDialect.columnDefinition("name", sqlDialect.types.string, "\"\"", false)
					])
				);
			});
			afterEach(async() => {
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.dropTable("test_table")
				);
			});
			
			it("select", async () => {
				// Insert test data
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.insert("test_table", sqlDialect.insertValues(["id", "name"], "VALUES (1, 'test1')"))+
					sqlDialect.insert("test_table", sqlDialect.insertValues(["id", "name"], "VALUES (2, 'test2')"))
				);
				
				// Test basic select
				let result = await databaseAccess.runGetStatement(
					sqlDialect.select("test_table", ["id", "name"])
				);
				expect(result).toEqual([
					{id: 1, name: "test1"},
					{id: 2, name: "test2"}
				]);
				
				// Test select with where clause
				result = await databaseAccess.runGetStatement(
					sqlDialect.select("test_table", ["id", "name"], "id = 1")
				);
				expect(result).toEqual([{id: 1, name: "test1"}]);
			});
			
			it("insert", async () => {
				const insertQuery = sqlDialect.insert("test_table",
					sqlDialect.insertValues(["id", "name"], "VALUES (1, 'test')")
				);
				await databaseAccess.runMultipleWriteStatements(insertQuery);
				
				const result = await databaseAccess.runGetStatement(
					sqlDialect.select("test_table", ["id", "name"])
				);
				expect(result).toEqual([{id: 1, name: "test"}]);
			});
		});
		
		describe("foreignKey", () => {
			it("should create foreign key constraints", async () => {
				// Create parent table
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.createTable("parentTable", [
						sqlDialect.columnDefinition("id", sqlDialect.types.number, "0", true)
					])
				);
				
				// Create child table with foreign key
				const childTableQuery = sqlDialect.createTable("childTable", [
					sqlDialect.columnDefinition("id", sqlDialect.types.number, "0", true),
					sqlDialect.columnDefinition("parent_id", sqlDialect.types.number, "0", false),
					sqlDialect.foreignKey("parent_id", "parentTable", "id", "CASCADE", "CASCADE")
				]);
				await databaseAccess.runMultipleWriteStatements(childTableQuery);
				
				// Insert parent record
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.insert("parentTable", sqlDialect.insertValues(["id"], "VALUES (1)"))
				);
				
				// Test foreign key constraint
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.insert("childTable", sqlDialect.insertValues(["id", "parent_id"], "VALUES (1, 1)"))
				);
				
				// Verify data
				const result = await databaseAccess.runGetStatement(
					sqlDialect.select("childTable", ["id", "parent_id"])
				);
				expect(result).toEqual([{ id: 1, parent_id: 1 }]);
				
				// Test foreign key constraint violation
				await expect(
					databaseAccess.runMultipleWriteStatements(
						sqlDialect.insert("childTable", sqlDialect.insertValues(["id", "parent_id"], "VALUES (2, 999)"))
					)
				).rejects.toThrow();
				
				// Remove parent entry
				await databaseAccess.runMultipleWriteStatements("DELETE FROM parentTable WHERE id = 1");
				
				// Verify parent entry being removed
				const resultParent = await databaseAccess.runGetStatement(
					sqlDialect.select("parentTable", ["id"])
				);
				expect(resultParent).toEqual([]);
				
				// Verify child entry being removed
				const resultChild = await databaseAccess.runGetStatement(
					sqlDialect.select("childTable", ["id"])
				);
				expect(resultChild).toEqual([]);
			});
		});
		
		describe("setVersion and getVersion", () => {
			beforeEach(async() => {
				// Create table
				await databaseAccess.runMultipleWriteStatements(
					sqlDialect.createTable("test_table", [
						sqlDialect.columnDefinition("id", sqlDialect.types.number, "0", true),
						sqlDialect.columnDefinition("name", sqlDialect.types.string, "\"\"", false)
					])
				);
			});
			
			
			it("should return the correct version", async() => {
				expect(await sqlDialect.getVersion()).toBe(0);
				await sqlDialect.setVersion(5)
				expect(await sqlDialect.getVersion()).toBe(5);
			});
		});
	});
});