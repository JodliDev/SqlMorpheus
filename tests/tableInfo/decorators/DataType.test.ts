import {describe, expect, it} from "vitest";
import DataType from "../../../src/lib/tableInfo/decorators/DataType";
import {getTableInfo} from "../../../src/lib/tableInfo/TableInfo";

class TestClass2 {
	id: number = 5;
}

class TestClass {
	id: number = 3;
	@DataType("string")
	var1: number = 1;
	var2: number = 1;
}

describe("DataType", () => {
	it("should save data correctly", () =>  {
		const info = getTableInfo(TestClass);
		expect(info.dataTypes).toBeDefined();
		expect(info.dataTypes).toEqual({var1: "string"});
	});
	
	it("should not have data when no decorator exists", () =>  {
		expect(getTableInfo(TestClass2).dataTypes).toBeUndefined();
	});
});