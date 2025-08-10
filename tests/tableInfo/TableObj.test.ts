import {describe, expect, it} from "vitest";
import TableObj from "../../src/lib/tableInfo/TableObj";

describe("TableObj", () => {
	describe("create", () => {
		it("should create a new TableObj instance", () => {
			const columns = {id: 5, name: "a string"};
			const table = TableObj.create("users", columns) as TableObj<any>;
			
			expect(table).toBeInstanceOf(TableObj);
			expect(table.tableName).toBe("users");
			console.log(table.tableStructure)
			expect(table.tableStructure.columns).toHaveProperty("id");
			expect(table.tableStructure.columns["id"].inputDefaultValue).toEqual(5);
			expect(table.tableStructure.columns["id"].inputType).toEqual("number");
			expect(table.tableStructure.columns).toHaveProperty("name");
			expect(table.tableStructure.columns["name"].inputDefaultValue).toEqual("a string");
			expect(table.tableStructure.columns["name"].inputType).toEqual("string");
		});
	});
	
	describe("primaryKey", () => {
		it("should set the primary key for the table", () => {
			const columns = {id: "number", name: "string"};
			const table = TableObj.create("users", columns)
				.primaryKey("id");
			
			expect((table as TableObj<any>).tableStructure.primaryKey).toBe("id");
		});
	});
	
	describe("foreignKey", () => {
		it("should add a foreign key to the tableInfo", () => {
			const userColumns = {id: "number", name: "string"};
			const postColumns = {id: "number", userId: "number"};
			
			const userTable = TableObj.create("users", userColumns);
			const postTable = TableObj.create("posts", postColumns)
				.foreignKey("userId", userTable, "id", {onDelete: "CASCADE", onUpdate: "NO ACTION"});
			
			
			expect((postTable as TableObj<any>).tableStructure.foreignKeys).toContainEqual({
				fromTable: "posts",
				fromColumn: "userId",
				toTable: "users",
				toColumn: "id",
				onDelete: "CASCADE",
				onUpdate: "NO ACTION",
			});
		});
	});
	
	
	describe("maxLength", () => {
		it("should define max length for a column", () => {
			const columns = {id: "number", name: "string"};
			const table = TableObj.create("users", columns)
				.maxCharacterLength("id", 6);
			
			expect((table as TableObj<any>).tableStructure.columns["id"].maxLength).toBe(6);
		});
	});
	
	describe("dataType", () => {
		it("should define a data type for a column", () => {
			const columns = {id: "number", name: "string"};
			const table = TableObj.create("users", columns)
				.dataType("id", "number");
			
			expect((table as TableObj<any>).tableStructure.columns["id"].type).toBe("number");
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