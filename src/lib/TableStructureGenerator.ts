import {BackendTable, Class} from "./typings/BackendTable";
import {ColumnInfo} from "./typings/ColumnInfo";
import DatabaseInstructions from "./typings/DatabaseInstructions";
import {TableStructure} from "./typings/TableStructure";
import DefaultSql from "./dialects/DefaultSql";
import {Logger} from "./Logger";
import {getTableInfo} from "./tableInfo/TableInfo";
import {TableObjects} from "./tableInfo/TableObjects";

export default class TableStructureGenerator {
	private readonly dialect: DefaultSql;
	private readonly dbInstructions: DatabaseInstructions;
	
	constructor(dbInstructions: DatabaseInstructions, dialect: DefaultSql) {
		this.dialect = dialect;
		this.dbInstructions = dbInstructions;
	}
	
	public generateTableStructure(): Record<string, TableStructure> {
		if(this.dbInstructions.tables.length) {
			const tableObjects: TableObjects = {};
			
			for(const table of this.dbInstructions.tables as Class<BackendTable>[]) {
				tableObjects[table.name] = {columns: new table, tableInfo: getTableInfo(table)};
			}
			return this.getExpectedStructure(tableObjects);
		}
		else {
			const tableObjects = this.dbInstructions.tables as TableObjects;
			return this.getExpectedStructure(tableObjects);
		}
	}
	
	private getExpectedStructure(tableObjects: TableObjects): Record<string, TableStructure> {
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
	
	
	private getColumns(obj: BackendTable, primaryKey?: keyof BackendTable): ColumnInfo[] {
		const columns: ColumnInfo[] = [];
		for(const property in obj) {
			const propertyKey = property as keyof BackendTable;
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