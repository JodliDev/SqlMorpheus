import {describe, expect, it} from "vitest";
import TableObj from "../../src/lib/tableInfo/TableObj";
import {TableObjHelper} from "../../src/lib/tableInfo/TableObjHelper";

describe("TableObjHelper", () => {
	describe("isTableObj", () => {
		it("should return true for a valid TableObj instance", () => {
			const table = TableObj.create("users", {});
			expect(TableObjHelper.isTableObj(table)).toBe(true);
		});
		
		it("should return false for an invalid object", () => {
			const invalidObject = {someKey: "someValue"};
			expect(TableObjHelper.isTableObj(invalidObject)).toBe(false);
		});
	});
	
	describe("getColumnEntry", () => {
		it("should return InputColumnInfo for a valid primitive value", () => {
			const result = TableObjHelper.getColumnEntry("field1", "test_string");
			expect(result).toEqual({
				name: "field1",
				sqlType: "",
				defaultValue: "",
				isPrimaryKey: false,
				inputType: "string",
				inputDefaultValue: "test_string",
			});
		});
		
		it("should return null for unsupported type (function)", () => {
			const result = TableObjHelper.getColumnEntry("field2", (() => {}) as any);
			expect(result).toBeNull();
		});
		
		it("should return null for unsupported type (class)", () => {
			class TestClass {}
			const result = TableObjHelper.getColumnEntry("field2", new TestClass() as any);
			expect(result).toBeNull();
		});
		
		it("should return null for unsupported type (symbol)", () => {
			const result = TableObjHelper.getColumnEntry("field2", Symbol() as any);
			expect(result).toBeNull();
		});
		
		it("should handle Date objects correctly", () => {
			const testDate = new Date();
			const result = TableObjHelper.getColumnEntry("field4", testDate);
			expect(result).toEqual({
				name: "field4",
				sqlType: "",
				defaultValue: "",
				isPrimaryKey: false,
				inputType: "date",
				inputDefaultValue: testDate,
			});
		});
		
		it("should return InputColumnInfo for null values with string type", () => {
			const result = TableObjHelper.getColumnEntry("nullable_field", null);
			expect(result).toEqual({
				name: "nullable_field",
				sqlType: "",
				defaultValue: "",
				isPrimaryKey: false,
				inputType: "string",
				inputDefaultValue: null,
			});
		});
	});
});