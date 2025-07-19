import {describe, expect, it} from "vitest";
import {getTableInfo} from "../../../src/lib/tableInfo/TableInfo";
import {ForeignKeyInfo} from "../../../src/lib/typings/ForeignKeyInfo";
import ForeignKeyToSelf from "../../../src/lib/tableInfo/decorators/ForeignKeyToSelf";

class TestClass2 {
	id: number = 5;
}

@ForeignKeyToSelf("foreignKey1", "id", {onUpdate: "SET DEFAULT", onDelete: "CASCADE"})
class TestClass {
	id: number = 3;
	foreignKey1: number = 1;
}


describe("Foreign Key to Self", () => {
	it("should save data correctly", () =>  {
		const info = getTableInfo(TestClass);
		expect(info.foreignKeys).toHaveLength(1);
		expect(info.foreignKeys![0]).toEqual({
			fromTable: "TestClass",
			fromColumn: "foreignKey1",
			toTable: "TestClass",
			toColumn: "id",
			onDelete: "CASCADE",
			onUpdate: "SET DEFAULT",
		} satisfies ForeignKeyInfo);
	});
	
	it("should not have data when no decorator exists", () =>  {
		expect(getTableInfo(TestClass2).foreignKeys).toEqual([]);
	});
});