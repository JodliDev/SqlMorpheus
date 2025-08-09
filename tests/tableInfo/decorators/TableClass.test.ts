import {describe, expect, it} from "vitest";
import ForeignKey from "../../../src/lib/tableInfo/decorators/ForeignKey";
import TableClass from "../../../src/lib/tableInfo/decorators/TableClass";
import {ForeignKeyInfo} from "../../../src/lib/typings/ForeignKeyInfo";
import {getTableStructure} from "../../../src/lib/tableInfo/getTableStructure";

@TableClass("TestClass2Name", "id")
class TestClass2 {
	id: number = 5;
}

@TableClass("TestClassName", "id")
class TestClass {
	id: number = 3;
	@ForeignKey(TestClass2,  "id", {onDelete: "CASCADE", onUpdate: "SET DEFAULT"})
	foreignKey1: number = 1;
}

describe("TableClass", () => {
	it("should change the table name", () => {
		expect(TestClass.name).toBe("TestClassName");
	});
	it("should set fromTable", () => {
		const info = getTableStructure(TestClass);
		expect(info.foreignKeys![0]).toEqual({
			fromTable: "TestClassName",
			fromColumn: "foreignKey1",
			toTable: "TestClass2Name",
			toColumn: "id",
			onDelete: "CASCADE",
			onUpdate: "SET DEFAULT",
		} satisfies ForeignKeyInfo);
	});
});