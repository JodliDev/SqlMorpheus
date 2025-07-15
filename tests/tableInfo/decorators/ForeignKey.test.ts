import {describe, expect, it} from "vitest";
import ForeignKey from "../../../src/lib/tableInfo/decorators/ForeignKey";
import DbTable from "../../../src/lib/tableInfo/decorators/DbTable";
import {getTableInfo} from "../../../src/lib/tableInfo/TableInfo";
import {ForeignKeyInfo} from "../../../src/lib/typings/ForeignKeyInfo";

@DbTable("TestClass2Name", "id")
class TestClass2 {
	id: number = 5;
}

@DbTable("TestClassName", "id")
class TestClass {
	id: number = 3;
	@ForeignKey(TestClass2,  "id", "CASCADE", "SET DEFAULT")
	foreignKey1: number = 1;
}


describe("Integration tests", () => {
	it("Foreign Key", () =>  {
		const info = getTableInfo(TestClass);
		expect(info.foreignKeys).toBeDefined();
		expect(info.foreignKeys).toHaveLength(1);
		expect(info.foreignKeys![0]).toEqual({
			fromTable: "TestClassName",
			fromColumn: "foreignKey1",
			toTable: "TestClass2Name",
			toColumn: "id",
			onDelete: "CASCADE",
			onUpdate: "SET DEFAULT",
		} satisfies ForeignKeyInfo);
		
		expect(getTableInfo(TestClass2).foreignKeys).toEqual([]);
	})
});