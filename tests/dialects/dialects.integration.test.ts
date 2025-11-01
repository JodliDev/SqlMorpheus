import {afterEach, beforeEach, describe, expect, it} from "vitest";
import SqliteDialect from "../../src/lib/dialects/SqliteDialect";
import {afterAll} from "@vitest/runner";
import MySqlDialect from "../../src/lib/dialects/MySqlDialect";
import {MySqlDatabaseAccess} from "./MySqlDatabaseAccess";
import {SqliteDatabaseAccess} from "./SqliteDatabaseAccess";
import {ColumnInfo} from "../../src/lib/typings/ColumnInfo";

describe.each([
	{type: "Sqlite", createDb: async () => {
		const databaseAccess = new SqliteDatabaseAccess();
		const sqlDialect = new SqliteDialect(databaseAccess);
		return {databaseAccess: databaseAccess, sqlDialect: sqlDialect};
	}},
	{type: "MySql", createDb: async () => {
		const databaseAccess = await MySqlDatabaseAccess.create();
		const sqlDialect = new MySqlDialect(databaseAccess);
		return {databaseAccess: databaseAccess, sqlDialect: sqlDialect};
	}}
])("Integration Tests: $type", async ({createDb}) => {
	const {databaseAccess, sqlDialect} = await createDb();
	
	afterAll(() => {
		databaseAccess.close();
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
			
			await databaseAccess.runMultipleWriteStatements(
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
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.nullType, isPrimaryKey: true},
				name: {name: "name", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false},
				new: {name: "new", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false},
			});
		});
		it("renameColumn", async() => {
			const renameColumnQuery = sqlDialect.renameColumn("users", "name", "newName");
			await databaseAccess.runMultipleWriteStatements(renameColumnQuery);
			
			const tableInfo = await sqlDialect.getColumnInformation("users");
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.nullType, isPrimaryKey: true},
				newName: {name: "newName", sqlType: sqlDialect.getSqlType("text"), defaultValue: sqlDialect.nullType, isPrimaryKey: false}
			});
		});
		it("dropColumn", async() => {
			const dropColumnQuery = sqlDialect.dropColumn("users", "name");
			await databaseAccess.runMultipleWriteStatements(dropColumnQuery);
			
			const tableInfo = await sqlDialect.getColumnInformation("users");
			expect(tableInfo).toEqual({
				id: {name: "id", sqlType: sqlDialect.getSqlType("number"), defaultValue: sqlDialect.nullType, isPrimaryKey: true}
			});
		});
	});
	
	describe("Query Operations", () => {
		beforeEach(async () => {
			await databaseAccess.runMultipleWriteStatements(
				sqlDialect.createTable("test_table", [
					sqlDialect.columnDefinition("id", sqlDialect.getSqlType("number"), true, "0"),
					sqlDialect.columnDefinition("name", sqlDialect.getSqlType("text"), false)
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
		beforeEach(async() => {
			// Create parent table
			await databaseAccess.runMultipleWriteStatements(
				sqlDialect.createTable("parentTable", [
					sqlDialect.columnDefinition("id", sqlDialect.types.number, true, "0")
				])
			);
			
			// Create child table with foreign key
			const childTableQuery = sqlDialect.createTable("childTable", [
				sqlDialect.columnDefinition("id", sqlDialect.types.number, true, "0"),
				sqlDialect.columnDefinition("parent_id", sqlDialect.types.number, false, "0"),
				sqlDialect.foreignKey("parent_id", "parentTable", "id", "SET NULL", "CASCADE")
			]);
			await databaseAccess.runMultipleWriteStatements(childTableQuery);
		});
		afterEach(async() => {
			await databaseAccess.runMultipleWriteStatements(
				sqlDialect.dropTable("childTable") +
				sqlDialect.dropTable("parentTable")
			);
		});
		it("should create foreign key constraints", async () => {
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
			
			//cleanup:
			await databaseAccess.runMultipleWriteStatements(
				sqlDialect.dropTable("users")
			);
		});
		
		
		it("should return the correct foreign key data", async() => {
			// Create child table with foreign key
			const childTable2Query = sqlDialect.createTable("childTable2", [
				sqlDialect.columnDefinition("id", sqlDialect.types.number, true, "0"),
				sqlDialect.columnDefinition("parent_id", sqlDialect.types.number, false, "0"),
				sqlDialect.foreignKey("parent_id", "parentTable", "id", "SET DEFAULT")
			]);
			const childTable3Query = sqlDialect.createTable("childTable3", [
				sqlDialect.columnDefinition("id", sqlDialect.types.number, true, "0"),
				sqlDialect.columnDefinition("parent_id", sqlDialect.types.number, false, "0"),
				sqlDialect.foreignKey("parent_id", "parentTable", "id", undefined, "SET NULL")
			]);
			await databaseAccess.runMultipleWriteStatements(childTable2Query + childTable3Query);
			
			const foreignKeys = await sqlDialect.getForeignKeys("childTable");
			expect(foreignKeys).toEqual([
				{
					fromTable: "childTable",
					fromColumn: "parent_id",
					toTable: "parentTable",
					toColumn: "id",
					onUpdate: "SET NULL",
					onDelete: "CASCADE"
				},
			]);
			
			const foreignKeys2 = await sqlDialect.getForeignKeys("childTable2");
			expect(foreignKeys2).toEqual([
				{
					fromTable: "childTable2",
					fromColumn: "parent_id",
					toTable: "parentTable",
					toColumn: "id",
					onUpdate: "SET DEFAULT",
					onDelete: "NO ACTION"
				},
			]);
			
			const foreignKeys3 = await sqlDialect.getForeignKeys("childTable3");
			expect(foreignKeys3).toEqual([
				{
					fromTable: "childTable3",
					fromColumn: "parent_id",
					toTable: "parentTable",
					toColumn: "id",
					onUpdate: "NO ACTION",
					onDelete: "SET NULL",
				},
			]);
			
			
			//cleanup
			await databaseAccess.runMultipleWriteStatements(
				sqlDialect.dropTable("childTable2") +
				sqlDialect.dropTable("childTable3")
			);
		});
	});
	
	describe("setVersion and getVersion", () => {
		beforeEach(async() => {
			// Create table
			await databaseAccess.runMultipleWriteStatements(
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