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
import {ForeignKeyInfo} from "../src/lib/typings/ForeignKeyInfo";

describe("TableStructureGenerator", () => {
	class DefaultDialect extends DefaultSql {
		public types = {
			string: "VARCHAR",
			text: "TEXT",
			number: "INTEGER",
			bigint: "BIGINT",
			boolean: "BOOLEAN",
			date: "DATE",
			time: "TIME",
			dateTime: "DATETIME",
		};
		
		public runTransactionWithoutForeignKeys(): Promise<void> {
			throw new Error("Method not implemented.");
		}
		
		public getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
			throw new Error("Method not implemented.");
		}
		getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
			return Promise.resolve({});
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
			@DataType("text")
			description: string = "";
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
		} satisfies DatabaseInstructions;
		
		
		//generating:
		const generator = new TableStructureGenerator(classInstructions, defaultDialect);
		return generator.generateTableStructure();
	}
	function generateStructureFromObject() {
		const House = TableObj.create("House", {
			houseId: [BigInt(3), {primaryKey: true}],
			address: "address",
			description: ["", {dataType: "text"}],
			stories: 0,
			ownerName: [null, {dataType: "string"}],
			builtAt: [new Date(1712111880000), {dataType: "dateTime"}],
			inhabitants: BigInt(0),
			hasInternet: true,
		});
		
		const Car = TableObj.create("Car", {
			carId: [BigInt(5), {primaryKey: true}],
			belongsTo: BigInt(1),
			isSimilarTo: BigInt(9),
			electric: false,
			brand: "",
			km: 10,
			lastUsed: new Date(602303880000)
		})
			.foreignKey("belongsTo", House, "houseId", {onUpdate: "SET DEFAULT", onDelete: "SET NULL"});
		Car.foreignKey("isSimilarTo", Car, "carId");
		
		const classInstructions = {
			dialect: "Sqlite",
			tables: [House, Car],
			version: 1,
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
		expect(tableHouse.columns).toMatchObject({
			houseId: {name: "houseId", sqlType: "BIGINT", defaultValue: "3", isPrimaryKey: true},
			address: {name: "address", sqlType: "VARCHAR", defaultValue: '"address"', isPrimaryKey: false},
			description: {name: "description", sqlType: "TEXT", defaultValue: '""', isPrimaryKey: false},
			stories: {name: "stories", sqlType: "INTEGER", defaultValue: "0", isPrimaryKey: false},
			ownerName: {name: "ownerName", sqlType: "VARCHAR", defaultValue: "NULL", isPrimaryKey: false},
			builtAt: {name: "builtAt", sqlType: "DATETIME", defaultValue: "\"2024-04-03 02:38:00\"", isPrimaryKey: false},
			inhabitants: {name: "inhabitants", sqlType: "BIGINT", defaultValue: "0", isPrimaryKey: false},
			hasInternet: {name: "hasInternet", sqlType: "BOOLEAN", defaultValue: "true", isPrimaryKey: false},
		});
		
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
		expect(tableCar.columns).toMatchObject({
			carId: {name: "carId", sqlType: "BIGINT", defaultValue: "5", isPrimaryKey: true},
			belongsTo: {name: "belongsTo", sqlType: "BIGINT", defaultValue: "1", isPrimaryKey: false},
			isSimilarTo: {name: "isSimilarTo", sqlType: "BIGINT", defaultValue: "9", isPrimaryKey: false},
			electric: {name: "electric", sqlType: "BOOLEAN", defaultValue: "false", isPrimaryKey: false},
			brand: {name: "brand", sqlType: "VARCHAR", defaultValue: "\"\"", isPrimaryKey: false},
			km: {name: "km", sqlType: "INTEGER", defaultValue: '10', isPrimaryKey: false},
			lastUsed: {name: "lastUsed", sqlType: "DATE", defaultValue: "\"1989-02-01\"", isPrimaryKey: false},
		});
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