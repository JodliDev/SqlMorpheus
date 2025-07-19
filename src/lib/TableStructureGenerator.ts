import {TableClassInterface, Class} from "./typings/TableClassInterface";
import {ColumnInfo} from "./typings/ColumnInfo";
import DatabaseInstructions from "./typings/DatabaseInstructions";
import {TableStructure} from "./typings/TableStructure";
import DefaultSql from "./dialects/DefaultSql";
import {Logger} from "./Logger";
import TableInfo, {getTableInfo} from "./tableInfo/TableInfo";
import {TableObj} from "./TableObj";

export type TableInformation = Record<string, { columns: TableClassInterface, tableInfo?: TableInfo }>;

export default class TableStructureGenerator {
	private readonly dialect: DefaultSql;
	private readonly dbInstructions: DatabaseInstructions;
	
	constructor(dbInstructions: DatabaseInstructions, dialect: DefaultSql) {
		this.dialect = dialect;
		this.dbInstructions = dbInstructions;
	}
	
	public generateTableStructure(): Record<string, TableStructure> {
		const tableObjects: TableInformation = {};
		for(const table of this.dbInstructions.tables) {
			if(TableObj.isDbTable(table))
				tableObjects[table.tableName] = table;
			else {
				const classTable = table as Class<TableClassInterface>;
				tableObjects[classTable.name] = {columns: new classTable, tableInfo: getTableInfo(classTable)};
			}
		}
		return this.getExpectedStructure(tableObjects);
	}
	
	private getExpectedStructure(tableObjects: TableInformation): Record<string, TableStructure> {
		const tables: Record<string, TableStructure> = {};
		for(const tableName in tableObjects) {
			const obj = tableObjects[tableName];
			const tableInfo = obj.tableInfo;
			
			
			tables[tableName] = {
				table: tableName,
				primaryKey: tableInfo?.primaryKey,
				columns: this.getColumns(obj.columns, tableInfo?.primaryKey),
				foreignKeys: tableInfo?.foreignKeys
			};
		}
		
		return tables;
	}
	
	
	private getColumns(obj: TableClassInterface, primaryKey?: keyof TableClassInterface): ColumnInfo[] {
		const columns: ColumnInfo[] = [];
		for(const property in obj) {
			const propertyKey = property as keyof TableClassInterface;
			const value = obj[propertyKey];
			const columnData = {
				name: property,
				isPrimaryKey: property == primaryKey,
				type: "TEXT",
				defaultValue: this.dialect.typeNull
			} satisfies ColumnInfo;
			
			switch(typeof value) {
				case "string":
					columnData.type = this.dialect.typeString;
					columnData.defaultValue = value === null ? this.dialect.typeNull : `"${this.dialect.formatValueToSql(value)}"`;
					break
				case "bigint":
					columnData.type = this.dialect.typeBigInt;
					columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
					break
				case "number":
					columnData.type = this.dialect.typeInt;
					columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
					break
				case "boolean":
					columnData.type = this.dialect.typeBoolean;
					columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
					break
				case "function":
					continue;
				default:
					Logger.warn(`${obj.constructor.name}.${property} was skipped because its type is not supported (${typeof value})`);
					continue;
			}
			
			columns.push(columnData);
		}
		return columns;
	}
}