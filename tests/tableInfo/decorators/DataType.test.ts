import {describe, expect, it} from "vitest";
import DataType from "../../../src/lib/tableInfo/decorators/DataType";
import {getTableStructure} from "../../../src/lib/tableInfo/getTableStructure";

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
		const info = getTableStructure(TestClass);
		expect(info.columns["var1"]).toBeDefined();
		expect(info.columns["var1"].inputType).toEqual("string");
	});
	
	it("should not have data when no decorator exists", () =>  {
		expect(getTableStructure(TestClass2).columns).toEqual({});
	});
});