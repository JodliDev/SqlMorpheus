import {describe, expect, it} from "vitest";
import TableObj from "../../src/lib/tableInfo/TableObj";

describe("TableObj", () => {
	describe("create", () => {
		it("should create a new TableObj instance", () => {
			const columns = {id: "number", name: "string"};
			const table = TableObj.create("users", columns) as TableObj<any>;
			
			expect(table).toBeInstanceOf(TableObj);
			expect(table.tableName).toBe('users');
			expect(table.columns).toEqual(columns);
		});
	});
	
	describe("primaryKey", () => {
		it("should set the primary key for the table", () => {
			const columns = {id: "number", name: "string"};
			const table = TableObj.create("users", columns)
				.primaryKey("id");
			
			expect((table as TableObj<any>).tableInfo.primaryKey).toBe("id");
		});
	});
	
	describe("foreignKey", () => {
		it("should add a foreign key to the tableInfo", () => {
			const userColumns = {id: "number", name: "string"};
			const postColumns = {id: "number", userId: "number"};
			
			const userTable = TableObj.create("users", userColumns);
			const postTable = TableObj.create("posts", postColumns)
				.foreignKey("userId", userTable, "id", {onDelete: "CASCADE", onUpdate: "NO ACTION"});
			
			
			expect((postTable as TableObj<any>).tableInfo.foreignKeys).toContainEqual({
				fromTable: "posts",
				fromColumn: "userId",
				toTable: "users",
				toColumn: "id",
				onDelete: "CASCADE",
				onUpdate: "NO ACTION",
			});
		});
	});
	
	describe("dataType", () => {
		it("should define a data type for a column", () => {
			const columns = {id: "number", name: "string"};
			const table = TableObj.create("users", columns)
				.dataType("id", "number");
			
			expect((table as TableObj<any>).tableInfo.dataTypes!["id"]).toBe("number");
		});
	});
	
	describe("isDbTable", () => {
		it("should return true for a valid TableObj instance", () => {
			const table = TableObj.create("users", {});
			expect(TableObj.isDbTable(table)).toBe(true);
		});
		
		it("should return false for an invalid object", () => {
			const invalidObject = {someKey: "someValue"};
			expect(TableObj.isDbTable(invalidObject)).toBe(false);
		});
	});
});