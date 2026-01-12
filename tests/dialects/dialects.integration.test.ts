import {afterEach, beforeEach, describe, expect, it} from "vitest";
import SqliteDialect from "../../src/lib/dialects/SqliteDialect";
import {afterAll} from "@vitest/runner";
import MySqlDialect from "../../src/lib/dialects/MySqlDialect";
import {ColumnInfo} from "../../src/lib/typings/ColumnInfo";
import {MySqlContainer} from "@testcontainers/mysql";
import {DatabaseAccess} from "../../src";
import BetterSqlite3 from "better-sqlite3";
import mysql from "mysql2/promise";

export function createSQLiteAccess(): DatabaseAccess {
	const db = new BetterSqlite3(":memory:");
	return {
		runReadStatement: async (query: string) => db.prepare(query).all(),
		runWriteStatement: async (query: string) => db.prepare(query).run(),
		runTransaction: async (query: string) => {
			const transaction = db.transaction(() => db.exec(query));
			transaction();
		}
	}
}

describe.each([
	{type: "SQLite", createDb: async () => {
		const db = new BetterSqlite3(":memory:");
		const dbAccess = createSQLiteAccess();
		const sqlDialect = new SqliteDialect(dbAccess);
		return {databaseAccess: dbAccess, sqlDialect: sqlDialect, close: db.close};
	}},
	{type: "MySql", createDb: async () => {
		const container = await new MySqlContainer("mysql").start();
		
		const db = await mysql.createConnection({
			host: container.getHost(),
			port: container.getPort(),
			database: container.getDatabase(),
			user: container.getUsername(),
			password: container.getUserPassword(),
			multipleStatements : true,
		});
		await db.connect();
		
		const dbAccess: DatabaseAccess = {
			runReadStatement: async (query: string) => {
				const [results, _fields] = await db.query(query);
				return results as any[];
			},
			runWriteStatement: async (query: string) => await db.query(query),
			runTransaction: async (query: string) => {
				try {
					await db.beginTransaction();
					await db.query(query);
					await db.commit();
				}
				catch(e) {
					await db.rollback();
					throw e;
				}
			}
		}
		
		const sqlDialect = new MySqlDialect(dbAccess);
		return {databaseAccess: dbAccess, sqlDialect: sqlDialect, close: db.destroy};
	}}
])("Integration Tests: $type", async ({createDb}) => {
	const {databaseAccess, sqlDialect, close} = await createDb();
	
	afterAll(() => {
		close();
	});
	
	describe("createTable", () => {
		it("should create a table successfully", async() => {
			const tableName = "users";
			const entries = [
				sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, sqlDialect.formatValueToSql(3, "number")),
				sqlDialect.columnDefinition("name", sqlDialect.getSqlType("string", {maxLength: 100} as ColumnInfo), false, sqlDialect.formatValueToSql("test", "string")),
				sqlDialect.columnDefinition("accountValue", sqlDialect.getSqlType("bigint"), false, sqlDialect.formatValueToSql(BigInt(5), "bigint")),
				sqlDialect.columnDefinition("isSmart", sqlDialect.getSqlType("boolean"), false, sqlDialect.formatValueToSql(true, "boolean")),
				sqlDialect.columnDefinition("isStupid", sqlDialect.getSqlType("boolean"), false, sqlDialect.formatValueToSql(false, "boolean")),
				sqlDialect.columnDefinition("birthday", sqlDialect.getSqlType("date"), false, sqlDialect.formatValueToSql(new Date("2025-07-25"), "date")),
				sqlDialect.columnDefinition("wokenUpAt", sqlDialect.getSqlType("time"), false, sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "time")),
				sqlDialect.columnDefinition("lastHouseFire", sqlDialect.getSqlType("dateTime"), false, sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "dateTime")),
				sqlDialect.columnDefinition("royalTitle", sqlDialect.getSqlType("string", {maxLength: 100} as ColumnInfo), false, sqlDialect.nullType)
			];
			
			await databaseAccess.runTransaction(
				sqlDialect.createTable(tableName, entries)
			);
			
			
			const tables = await sqlDialect.getTableNames();
			expect(tables).toEqual(["users"]);
			
			const tableInfo = await sqlDialect.getColumnInformation("users");
			expect(tableInfo).to
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.formatValueToSql(3, "number"), isPrimaryKey: true},
				name: {name: "name", sqlType: sqlDialect.getSqlType("string"), defaultValue: sqlDialect.formatValueToSql("test", "string"), isPrimaryKey: false},
				accountValue: {name: "accountValue", sqlType: sqlDialect.getSqlType("bigint"), defaultValue: sqlDialect.formatValueToSql(BigInt(5), "bigint"), isPrimaryKey: false},
				isSmart: {name: "isSmart", sqlType: sqlDialect.getSqlType("boolean"), defaultValue: sqlDialect.formatValueToSql(true, "boolean"), isPrimaryKey: false},
				isStupid: {name: "isStupid", sqlType: sqlDialect.getSqlType("boolean"), defaultValue: sqlDialect.formatValueToSql(false, "boolean"), isPrimaryKey: false},
				birthday: {name: "birthday", sqlType: sqlDialect.getSqlType("date"), defaultValue: sqlDialect.formatValueToSql(new Date("2025-07-25"), "date"), isPrimaryKey: false},
				wokenUpAt: {name: "wokenUpAt", sqlType: sqlDialect.getSqlType("time"), defaultValue: sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "time"), isPrimaryKey: false},
				lastHouseFire: {name: "lastHouseFire", sqlType: sqlDialect.getSqlType("dateTime"), defaultValue: sqlDialect.formatValueToSql(new Date("2025-07-25 09:30"), "dateTime"), isPrimaryKey: false},
				royalTitle: {name: "royalTitle", sqlType: sqlDialect.getSqlType("string"), defaultValue: sqlDialect.nullType, isPrimaryKey: false},
			} satisfies Record<string, ColumnInfo>);
		});
	});
	
	describe("Table operations", () => {
		beforeEach(async() => {
			await databaseAccess.runTransaction(
				sqlDialect.createTable("users", ["id INTEGER PRIMARY KEY", "name TEXT"])
			);
		});
		afterEach(async() => {
			await databaseAccess.runTransaction(
				sqlDialect.dropTable("users")
			);
		});
		
		it("renameTable", async() => {
			await databaseAccess.runTransaction(
				sqlDialect.renameTable("users", "accounts")
			);
			
			const tables = await sqlDialect.getTableNames();
			expect(tables).toEqual(["accounts"]);
			
			await databaseAccess.runTransaction(
				sqlDialect.dropTable("accounts")
			);
		});
		it("dropTable", async() => {
			await databaseAccess.runTransaction(
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
			await databaseAccess.runTransaction(createQuery);
		});
		
		it("createColumn", async() => {
			const addColumnQuery = sqlDialect.createColumn("users", "new TEXT");
			await databaseAccess.runTransaction(addColumnQuery);
			
			const tableInfo = await sqlDialect.getColumnInformation("users");
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.nullType, isPrimaryKey: true},
				name: {name: "name", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false},
				new: {name: "new", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false},
			});
		});
		it("renameColumn", async() => {
			const renameColumnQuery = sqlDialect.renameColumn("users", "name", "newName");
			await databaseAccess.runTransaction(renameColumnQuery);
			
			const tableInfo = await sqlDialect.getColumnInformation("users");
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.nullType, isPrimaryKey: true},
				newName: {name: "newName", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false}
			});
		});
		it("dropColumn", async() => {
			const dropColumnQuery = sqlDialect.dropColumn("users", "name");
			await databaseAccess.runTransaction(dropColumnQuery);
			
			const tableInfo = await sqlDialect.getColumnInformation("users");
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.nullType, isPrimaryKey: true}
			});
		});
		it("alterColumnStructure", async() => {
			if(!sqlDialect.canAlterColumnStructure) {
				console.log("alterColumnStructure is not supported by this dialect. Skipping test.")
				return;
			}
			
			// Change column type and add default value
			await databaseAccess.runTransaction(sqlDialect.alterColumnStructure("users", "id", sqlDialect.types.bigint, "6"));
			
			expect(await sqlDialect.getColumnInformation("users")).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("bigint"), defaultValue: "6", isPrimaryKey: true},
				name: {name: "name", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false}
			});
			
			// Remove column default value
			await databaseAccess.runTransaction(sqlDialect.alterColumnStructure("users", "id", sqlDialect.types.bigint, undefined));
			
			expect(await sqlDialect.getColumnInformation("users")).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("bigint"), defaultValue: sqlDialect.nullType, isPrimaryKey: true},
				name: {name: "name", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false}
			});
		});
	});
	
	describe("Query Operations", () => {
		beforeEach(async () => {
			await databaseAccess.runTransaction(
				sqlDialect.createTable("test_table", [
					sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
					sqlDialect.columnDefinition("name", sqlDialect.getSqlType("text"), false)
				])
			);
		});
		afterEach(async() => {
			await databaseAccess.runTransaction(
				sqlDialect.dropTable("test_table")
			);
		});
		
		it("select", async () => {
			// Insert test data
			await databaseAccess.runTransaction(
				sqlDialect.insert("test_table", sqlDialect.insertValues(["id", "name"], "VALUES (1, 'test1')"))+
				sqlDialect.insert("test_table", sqlDialect.insertValues(["id", "name"], "VALUES (2, 'test2')"))
			);
			
			// Test basic select
			let result = await databaseAccess.runReadStatement(
				sqlDialect.select("test_table", ["id", "name"])
			);
			expect(result).toEqual([
				{id: 1, name: "test1"},
				{id: 2, name: "test2"}
			]);
			
			// Test select with where clause
			result = await databaseAccess.runReadStatement(
				sqlDialect.select("test_table", ["id", "name"], "id = 1")
			);
			expect(result).toEqual([{id: 1, name: "test1"}]);
		});
		
		it("insert", async () => {
			const insertQuery = sqlDialect.insert("test_table",
				sqlDialect.insertValues(["id", "name"], "VALUES (1, 'test')")
			);
			await databaseAccess.runTransaction(insertQuery);
			
			const result = await databaseAccess.runReadStatement(
				sqlDialect.select("test_table", ["id", "name"])
			);
			expect(result).toEqual([{id: 1, name: "test"}]);
		});
	});
	
	describe("foreignKey", () => {
		beforeEach(async() => {
			// Create parent table
			await databaseAccess.runTransaction(
				sqlDialect.createTable("ParentTable", [
					sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
					sqlDialect.columnDefinition("name", sqlDialect.getSqlType("text"), false, "")
				])
			);
			
			// Create child table with foreign key
			const childTableQuery = sqlDialect.createTable("ChildTable", [
				sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
				sqlDialect.columnDefinition("parentId", sqlDialect.getSqlType("number"), false, "0"),
				sqlDialect.columnDefinition("name", sqlDialect.getSqlType("text"), false, ""),
				sqlDialect.foreignKey("parentId", "ParentTable", "id", "SET NULL", "CASCADE")
			]);
			await databaseAccess.runTransaction(childTableQuery);
		});
		afterEach(async() => {
			const tables = await sqlDialect.getTableNames();
			
			await databaseAccess.runTransaction(
				tables.map(table => sqlDialect.dropTable(table)).join("")
			);
		});
		
		it("should create foreign key constraints", async () => {
			// Insert parent record
			await databaseAccess.runTransaction(
				sqlDialect.insert("ParentTable", sqlDialect.insertValues(["id", "name"], "VALUES (1, 'Parent 1')"))
			);
			
			// Test foreign key constraint
			await databaseAccess.runTransaction(
				sqlDialect.insert("ChildTable", sqlDialect.insertValues(["id", "parentId", "name"], "VALUES (1, 1, 'Child 1')"))
			);
			
			// Verify data
			const result = await databaseAccess.runReadStatement(
				sqlDialect.select("ChildTable", ["id", "parentId", "name"])
			);
			expect(result).toEqual([{ id: 1, parentId: 1, name: 'Child 1' }]);
			
			// Test foreign key constraint violation
			await expect(
				databaseAccess.runTransaction(
					sqlDialect.insert("ChildTable", sqlDialect.insertValues(["id", "parentId", "name"], "VALUES (2, 999, 'Child 2')"))
				)
			).rejects.toThrow();
			
			// Remove parent entry
			await databaseAccess.runTransaction(`DELETE FROM ${sqlDialect.formatIdentifier("ParentTable")} WHERE id = 1`);
			
			// Verify parent entry being removed
			const resultParent = await databaseAccess.runReadStatement(
				sqlDialect.select("ParentTable", ["id"])
			);
			expect(resultParent).toEqual([]);
			
			// Verify child entry being removed
			const resultChild = await databaseAccess.runReadStatement(
				sqlDialect.select("ChildTable", ["id"])
			);
			expect(resultChild).toEqual([]);
			
			//cleanup:
			await databaseAccess.runTransaction(
				sqlDialect.dropTable("users")
			);
		});
		
		it("should return the correct foreign key data", async() => {
			// Create child table with foreign key
			const childTable2Query = sqlDialect.createTable("ChildTable2", [
				sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
				sqlDialect.columnDefinition("parentId", sqlDialect.getSqlType("number"), false, "0"),
				sqlDialect.foreignKey("parentId", "ParentTable", "id", "SET DEFAULT")
			]);
			const childTable3Query = sqlDialect.createTable("ChildTable3", [
				sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
				sqlDialect.columnDefinition("parentId", sqlDialect.getSqlType("number"), false, "0"),
				sqlDialect.foreignKey("parentId", "ParentTable", "id", undefined, "SET NULL")
			]);
			await databaseAccess.runTransaction(childTable2Query + childTable3Query);
			
			const foreignKeys = await sqlDialect.getForeignKeys("ChildTable");
			expect(foreignKeys).toEqual([
				{
					fromTable: "ChildTable",
					fromColumn: "parentId",
					toTable: "ParentTable",
					toColumn: "id",
					onUpdate: "SET NULL",
					onDelete: "CASCADE"
				},
			]);
			
			const foreignKeys2 = await sqlDialect.getForeignKeys("ChildTable2");
			expect(foreignKeys2).toEqual([
				{
					fromTable: "ChildTable2",
					fromColumn: "parentId",
					toTable: "ParentTable",
					toColumn: "id",
					onUpdate: "SET DEFAULT",
					onDelete: "NO ACTION"
				},
			]);
			
			const foreignKeys3 = await sqlDialect.getForeignKeys("ChildTable3");
			expect(foreignKeys3).toEqual([
				{
					fromTable: "ChildTable3",
					fromColumn: "parentId",
					toTable: "ParentTable",
					toColumn: "id",
					onUpdate: "NO ACTION",
					onDelete: "SET NULL",
				},
			]);
			
			
			//cleanup
			await databaseAccess.runTransaction(
				sqlDialect.dropTable("ChildTable2") +
				sqlDialect.dropTable("ChildTable3")
			);
		});
		
		it("should successfully disable foreign keys", async () => {
			//setup:
			
			const rootTableQuery = sqlDialect.createTable("RootTable", [
				sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
				sqlDialect.columnDefinition("name", sqlDialect.getSqlType("text"), false, "")
			]);
			const rootInsertQuery = sqlDialect.insert("RootTable", sqlDialect.insertValues(["id", "name"], "VALUES (1, 'Root entry')"));
			const parentInsertQuery = sqlDialect.insert("ParentTable", sqlDialect.insertValues(["id", "name"], "VALUES (10, 'Parent entry')"));
			const childInsertQuery = sqlDialect.insert("ChildTable", sqlDialect.insertValues(["id", "parentId", "name"], "VALUES (100, 10, 'Child entry')"));
			
			await databaseAccess.runTransaction(rootTableQuery + rootInsertQuery + parentInsertQuery + childInsertQuery);
			
			// Change ParentTable structure by adding a column with a foreign key:
			// (we recreate ParentTable to test if ChildTable gets cascaded):
			
			await sqlDialect.changeForeignKeysState(false);
			
			const recreateTableQuery = sqlDialect.createTable("Parent__backup", [
				sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
				sqlDialect.columnDefinition("name", sqlDialect.getSqlType("text"), false, ""),
				sqlDialect.columnDefinition("rootId", sqlDialect.getSqlType("number"), false, "0"),
				sqlDialect.foreignKey("rootId", "RootTable", "id", undefined, "CASCADE")
			]);
			const copyDataQuery = sqlDialect.insert("Parent__backup", sqlDialect.insertValues(["id", "name"], "SELECT id, name FROM ParentTable"));
			const replaceTableQuery = "DROP TABLE IF EXISTS ParentTable; ALTER TABLE Parent__backup RENAME TO ParentTable;";
			const updateQuery = "UPDATE ParentTable SET rootId = 1;";
			
			await databaseAccess.runTransaction(recreateTableQuery + copyDataQuery + replaceTableQuery + updateQuery);
			await sqlDialect.changeForeignKeysState(true);
			
			
			// test:
			// We expect that ChildTable still has all its entries (and was not cascaded)
			// and that ParenTable has its entries even though its new foreign key constraint was not fulfilled for a second
			
			const rootEntries = await databaseAccess.runReadStatement("SELECT id, name FROM RootTable");
			expect(rootEntries).toEqual([{id: 1, name: "Root entry"}]);
			
			const parentEntries = await databaseAccess.runReadStatement("SELECT id, name, rootId FROM ParentTable");
			expect(parentEntries).toEqual([{id: 10, name: "Parent entry", rootId: 1}]);
			
			const childEntries = await databaseAccess.runReadStatement("SELECT id, name, parentId FROM ChildTable");
			expect(childEntries).toEqual([{id: 100, name: "Child entry", parentId: 10}]);
			
			
			const parentForeignKeys = await sqlDialect.getForeignKeys("ParentTable");
			expect(parentForeignKeys).toEqual([
				{
					fromTable: "ParentTable",
					fromColumn: "rootId",
					toTable: "RootTable",
					toColumn: "id",
					onUpdate: "NO ACTION",
					onDelete: "CASCADE"
				},
			]);
			
			const childForeignKeys = await sqlDialect.getForeignKeys("ChildTable");
			expect(childForeignKeys).toEqual([
				{
					fromTable: "ChildTable",
					fromColumn: "parentId",
					toTable: "ParentTable",
					toColumn: "id",
					onUpdate: "SET NULL",
					onDelete: "CASCADE"
				},
			]);
		});
	});
	
	describe("setVersion and getVersion", () => {
		beforeEach(async() => {
			// Create table
			await databaseAccess.runTransaction(
				sqlDialect.createTable("test_table", [
					sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
					sqlDialect.columnDefinition("name", sqlDialect.getSqlType("string"), false, "'q'")
				])
			);
		});
		
		
		it("should return the correct version", async() => {
			expect(await sqlDialect.getVersion()).toBe(0);
			await sqlDialect.setChanges(0, 5, {up: "", down: ""});
			expect(await sqlDialect.getVersion()).toBe(5);
		});
	});
})