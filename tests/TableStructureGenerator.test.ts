import {describe, expect, it} from "vitest";
import TableStructureGenerator from "../src/lib/TableStructureGenerator";
import {TableStructure} from "../src/lib/typings/TableStructure";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import DefaultSql from "../src/lib/dialects/DefaultSql";
import {DatabaseAccess, ForeignKey, TableClass} from "../src";
import {ColumnInfo} from "../src/lib/typings/ColumnInfo";
import ForeignKeyToSelf from "../src/lib/tableInfo/decorators/ForeignKeyToSelf";
import DataType from "../src/lib/tableInfo/decorators/DataType";
import TableObj from "../src/lib/tableInfo/TableObj";

describe("TableStructureGenerator", () => {
	class DefaultDialect extends DefaultSql {
		public types = {
			string: "TEXT",
			number: "INTEGER",
			bigint: "BIGINT",
			boolean: "BOOLEAN",
			date: "DATE",
			time: "TIME",
			dateTime: "DATETIME",
			null: "NULL",
		};
		
		getColumnInformation(tableName: string): Promise<ColumnInfo[]> {
			return Promise.resolve([]);
		}
		
		getTableNames(): Promise<string[]> {
			return Promise.resolve([]);
		}
		
		constructor() {
			super({} as DatabaseAccess);
		}
	}
	
	const defaultDialect = new DefaultDialect();
	
	function generateStructureFromClass() {
		@TableClass("House", "houseId")
		class HouseClass {
			houseId: bigint = BigInt(3);
			address: string = "address";
			stories: number = 0;
			@DataType("string")
			ownerName: string | null = null;
			@DataType("dateTime")
			builtAt: Date = new Date(1712111880000);
			inhabitants: bigint = BigInt(0);
			hasInternet: boolean = true;
		}
		
		@TableClass("Car", "carId")
		@ForeignKeyToSelf("isSimilarTo", "carId")
		class CarClass {
			carId: bigint = BigInt(5);
			@ForeignKey(HouseClass, "houseId", {onUpdate: "SET DEFAULT", onDelete: "SET NULL"})
			belongsTo: bigint = BigInt(1);
			isSimilarTo: bigint = BigInt(9);
			electric: boolean = false;
			brand: string = "";
			km: number = 10;
			lastUsed: Date = new Date(602303880000);
		}
		
		const classInstructions = {
			dialect: "Sqlite",
			tables: [HouseClass, CarClass],
			version: 1,
			configPath: ":memory:",
			throwIfNotAllowed: true,
		} satisfies DatabaseInstructions;
		
		
		//generating:
		const generator = new TableStructureGenerator(classInstructions, defaultDialect);
		return generator.generateTableStructure();
	}
	function generateStructureFromObject() {
		const House = TableObj.create("House", {
			houseId: BigInt(3),
			address: "address",
			stories: 0,
			ownerName: null,
			builtAt: new Date(1712111880000),
			inhabitants: BigInt(0),
			hasInternet: true,
		})
			.primaryKey("houseId")
			.dataType("ownerName", "string")
			.dataType("builtAt", "dateTime");
		
		const Car = TableObj.create("Car", {
			carId: BigInt(5),
			belongsTo: BigInt(1),
			isSimilarTo: BigInt(9),
			electric: false,
			brand: "",
			km: 10,
			lastUsed: new Date(602303880000)
		})
			.primaryKey("carId")
			.foreignKey("belongsTo", House, "houseId", {onUpdate: "SET DEFAULT", onDelete: "SET NULL"});
		Car.foreignKey("isSimilarTo", Car, "carId");
		
		const classInstructions = {
			dialect: "Sqlite",
			tables: [House, Car],
			version: 1,
			configPath: ":memory:",
			throwIfNotAllowed: true,
		} satisfies DatabaseInstructions;
		
		
		//generating:
		const generator = new TableStructureGenerator(classInstructions, defaultDialect);
		return generator.generateTableStructure();
	}
	
	function testStructure(tables: Record<string, TableStructure>) {
		expect(tables).toHaveProperty("House");
		expect(tables).toHaveProperty("Car");
		
		const tableHouse: TableStructure = tables["House"];
		expect(tableHouse.primaryKey).toBe("houseId");
		expect(tableHouse.foreignKeys).toMatchObject([]);
		expect(tableHouse.columns).toMatchObject([
			{name: "houseId", type: "BIGINT", defaultValue: "3", isPrimaryKey: true},
			{name: "address", type: "TEXT", defaultValue: '"address"', isPrimaryKey: false},
			{name: "stories", type: "INTEGER", defaultValue: "0", isPrimaryKey: false},
			{name: "ownerName", type: "TEXT", defaultValue: "NULL", isPrimaryKey: false},
			{name: "builtAt", type: "DATETIME", defaultValue: "2024-04-03 02:38:00", isPrimaryKey: false},
			{name: "inhabitants", type: "BIGINT", defaultValue: "0", isPrimaryKey: false},
			{name: "hasInternet", type: "BOOLEAN", defaultValue: "true", isPrimaryKey: false},
		]);
		
		const tableCar: TableStructure = tables["Car"];
		expect(tableCar.primaryKey).toBe("carId");
		expect(tableCar.foreignKeys).toMatchObject([
			{
				fromTable: "Car",
				fromColumn: "belongsTo",
				toTable: "House",
				toColumn: "houseId",
				onUpdate: "SET DEFAULT",
				onDelete: "SET NULL"
			},
			{
				fromTable: "Car",
				fromColumn: "isSimilarTo",
				toTable: "Car",
				toColumn: "carId"
			}
		]);
		expect(tableCar.columns).toMatchObject([
			{name: "carId", type: "BIGINT", defaultValue: "5", isPrimaryKey: true},
			{name: "belongsTo", type: "BIGINT", defaultValue: "1", isPrimaryKey: false},
			{name: "isSimilarTo", type: "BIGINT", defaultValue: "9", isPrimaryKey: false},
			{name: "electric", type: "BOOLEAN", defaultValue: "false", isPrimaryKey: false},
			{name: "brand", type: "TEXT", defaultValue: '""', isPrimaryKey: false},
			{name: "km", type: "INTEGER", defaultValue: '10', isPrimaryKey: false},
			{name: "lastUsed", type: "DATE", defaultValue: '1989-02-01', isPrimaryKey: false},
		]);
	}
	
	
	it("should generate correct table structure from class tables", () => {
		//setup:
		const tables = generateStructureFromClass();
		
		
		//results:
		testStructure(tables);
	});
	it("should generate correct table structure from object tables", () => {
		//setup:
		const tables = generateStructureFromObject();
		
		//results:
		testStructure(tables);
	});
});