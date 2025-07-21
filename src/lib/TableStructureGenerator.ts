import {TableClassInterface, Class} from "./typings/TableClassInterface";
import {ColumnInfo} from "./typings/ColumnInfo";
import DatabaseInstructions from "./typings/DatabaseInstructions";
import {TableStructure} from "./typings/TableStructure";
import DefaultSql from "./dialects/DefaultSql";
import {Logger} from "./Logger";
import TableInfo, {getTableInfo} from "./tableInfo/TableInfo";
import TableObj from "./tableInfo/TableObj";

export type TableInputStructure = Record<string, { columns: TableClassInterface, tableInfo?: TableInfo }>;

export default class TableStructureGenerator {
	private readonly dialect: DefaultSql;
	private readonly dbInstructions: DatabaseInstructions;
	
	constructor(dbInstructions: DatabaseInstructions, dialect: DefaultSql) {
		this.dialect = dialect;
		this.dbInstructions = dbInstructions;
	}
	
	public generateTableStructure(): Record<string, TableStructure> {
		const tableObjects: TableInputStructure = {};
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
	
	private getExpectedStructure(tableObjects: TableInputStructure): Record<string, TableStructure> {
		const tables: Record<string, TableStructure> = {};
		for(const tableName in tableObjects) {
			const obj = tableObjects[tableName];
			const tableInfo = obj.tableInfo;
			
			
			tables[tableName] = {
				table: tableName,
				primaryKey: tableInfo?.primaryKey,
				columns: this.getColumns(obj.columns, tableInfo),
				foreignKeys: tableInfo?.foreignKeys
			};
		}
		
		return tables;
	}
	
	
	private getColumns(obj: TableClassInterface, tableInfo?: TableInfo): ColumnInfo[] {
		const columns: ColumnInfo[] = [];
		for(const property in obj) {
			const propertyKey = property as keyof TableClassInterface;
			const value = obj[propertyKey];
			const columnData = {
				name: property,
				isPrimaryKey: property == tableInfo?.primaryKey,
				type: this.dialect.types.string,
				defaultValue: this.dialect.types.null
			} satisfies ColumnInfo;
			
			let dataType = tableInfo?.dataTypes?.[property] ?? typeof value;
			switch(dataType) {
				case "function":
					continue
				case "object":
					if(value instanceof Date) {
						dataType = "date";
						break;
					}
					else {
						Logger.warn(`${property} was skipped because its type (${typeof value}) is not supported`);
						continue;
					}
				case "undefined":
				case "symbol":
					Logger.warn(`${property} was skipped because its type (${typeof value}) is not supported`);
					continue;
			}
			
			columnData.defaultValue = value === null ? this.dialect.types.null : this.dialect.formatValueToSql(value, dataType);
			columnData.type = this.dialect.types[dataType];
			
			
			columns.push(columnData);
		}
		return columns;
	}
}