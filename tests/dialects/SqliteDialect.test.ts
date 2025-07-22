import {describe, expect, test, vi} from "vitest";
import SqliteDialect from "../../src/lib/dialects/SqliteDialect";
import {DatabaseAccess} from "../../src";

describe("SqliteDialect", () => {
	const mockDb = {
		runGetStatement: vi.fn(),
		runMultipleWriteStatements: vi.fn(),
	} satisfies DatabaseAccess;
	
	const sqliteDialect = new SqliteDialect(mockDb);
	
	test("should fetch table names", async() => {
		mockDb.runGetStatement.mockResolvedValueOnce([{name: "table1"}, {name: "table2"}]);
		const tableNames = await sqliteDialect.getTableNames();
		expect(tableNames).toEqual(["table1", "table2"]);
	});
	
	test("should fetch column information", async() => {
		mockDb.runGetStatement.mockResolvedValueOnce([
			{name: "id", type: "INTEGER", dflt_value: null, pk: "1"},
			{name: "name", type: "TEXT", dflt_value: "'default'", pk: "0"},
		]);
		const columnInfo = await sqliteDialect.getColumnInformation("test_table");
		expect(columnInfo).toEqual([
			{name: "id", type: "INTEGER", defaultValue: null, isPrimaryKey: true},
			{name: "name", type: "TEXT", defaultValue: "'default'", isPrimaryKey: false},
		]);
	});
	
	test("should format values to SQL correctly", () => {
		expect(sqliteDialect.formatValueToSql(true, "boolean")).toBe("1");
		expect(sqliteDialect.formatValueToSql(false, "boolean")).toBe("0");
		expect(sqliteDialect.formatValueToSql("2025-07-20", "dateTime")).toBe(
			new Date("2025-07-20").getTime().toString()
		);
	});
	
	test("should fetch foreign keys", async() => {
		mockDb.runGetStatement.mockResolvedValueOnce([
			{
				from: "child_id",
				table: "parent_table",
				to: "id",
				on_update: "CASCADE",
				on_delete: "SET NULL",
			},
		]);
		const foreignKeys = await sqliteDialect.getForeignKeys("child_table");
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
	
	test("should fetch database version", async() => {
		mockDb.runGetStatement.mockResolvedValueOnce([{user_version: 2}]);
		const version = await sqliteDialect.getVersion();
		expect(version).toBe(2);
	});
	
	test("should set database version", async() => {
		await sqliteDialect.setVersion(3);
		expect(mockDb.runMultipleWriteStatements).toHaveBeenCalledWith("PRAGMA user_version = 3;");
	});
});