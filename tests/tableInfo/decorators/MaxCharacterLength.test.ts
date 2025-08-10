import {describe, expect, it} from "vitest";
import MaxCharacterLength from "../../../src/lib/tableInfo/decorators/MaxCharacterLength";

import {getTableStructure} from "../../../src/lib/tableInfo/getTableStructure";

class TestClass2 {
	id: number = 5;
}

class TestClass {
	id: number = 3;
	@MaxCharacterLength(5)
	var1: number = 1;
	var2: number = 1;
}

describe("MaxCharacterLength", () => {
	it("should save data correctly", () =>  {
		const info = getTableStructure(TestClass);
		expect(info.columns["var1"]).toBeDefined();
		expect(info.columns["var1"].maxLength).toEqual(5);
	});
	
	it("should not have data when no decorator exists", () =>  {
		expect(getTableStructure(TestClass2).columns).toEqual({});
	});
});