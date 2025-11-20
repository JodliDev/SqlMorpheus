import {describe, expect, it} from "vitest";
import TableObj from "../../src/lib/tableInfo/TableObj";

describe("TableObj", () => {
	describe("create", () => {
		it("should create a new TableObj instance", () => {
			const columns = {id: 5, name: "a string"};
			const table = TableObj.create("users", columns) as any as TableObj<any>;
			
			expect(table).toBeInstanceOf(TableObj);
			expect(table.tableName).toBe("users");
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
			const table = TableObj.create("users", {id: ["number", {primaryKey: true}], name: "string"});
			
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
			const table = TableObj.create("users", {id: ["number", {maxCharacterLength: 6}], name: "string"});
			
			expect((table as TableObj<any>).tableStructure.columns["id"].maxLength).toBe(6);
		});
	});
	
	describe("dataType", () => {
		it("should define a data type for a column", () => {
			const table = TableObj.create("users", {id: ["number", {dataType: "number"}], name: "string"});
			
			expect((table as TableObj<any>).tableStructure.columns["id"].inputType).toBe("number");
		});
	});
});