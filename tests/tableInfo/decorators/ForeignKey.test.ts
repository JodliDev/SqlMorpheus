import {describe, expect, it} from "vitest";
import ForeignKey from "../../../src/lib/tableInfo/decorators/ForeignKey";
import {ForeignKeyInfo} from "../../../src/lib/typings/ForeignKeyInfo";

import {getTableStructure} from "../../../src/lib/tableInfo/getTableStructure";

class TestClass2 {
	id: number = 5;
}

class TestClass {
	id: number = 3;
	@ForeignKey(TestClass2,  "id", {onUpdate: "SET DEFAULT", onDelete: "CASCADE"})
	foreignKey1: number = 1;
}


describe("Foreign Key", () => {
	it("should save data correctly", () =>  {
		const info = getTableStructure(TestClass);
		expect(info.foreignKeys).toBeDefined();
		expect(info.foreignKeys).toHaveLength(1);
		expect(info.foreignKeys![0]).toEqual({
			fromTable: "",
			fromColumn: "foreignKey1",
			toTable: "TestClass2",
			toColumn: "id",
			onDelete: "CASCADE",
			onUpdate: "SET DEFAULT",
		} satisfies ForeignKeyInfo);
	});
	
	it("should not have data when no decorator exists", () =>  {
		expect(getTableStructure(TestClass2).foreignKeys).toEqual([]);
	});
});