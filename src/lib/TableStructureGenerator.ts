import {BackendTable, Class} from "./typings/BackendTable.ts";
import {ColumnInfo} from "./typings/ColumnInfo.ts";
import {getPrimaryKey} from "./decorators/Entity.ts";
import {getForeignKeys} from "./decorators/ForeignKeys.ts";
import DatabaseInstructions from "./typings/DatabaseInstructions.ts";
import {TableStructure} from "./typings/TableStructure.ts";
import DefaultSql from "./dialects/DefaultSql.ts";

export default class TableStructureGenerator {
	private readonly dialect: DefaultSql;
	public readonly tables: Record<string, TableStructure<BackendTable>> = {}
	
	constructor(dbContext: DatabaseInstructions, dialect: DefaultSql) {
		this.dialect = dialect;
		this.getExpectedStructure(dbContext.tables);
	}
	
	private getExpectedStructure(tables: Class<BackendTable>[]): void {
		for(const table of tables) {
			const obj = new table;
			
			const primaryKey = getPrimaryKey(table);
			if(!obj.hasOwnProperty(primaryKey)) {
				console.log(`Skipping table ${table.name} because it has no primary key (Could not find: "${primaryKey}")`);
				continue;
			}
			
			this.tables[table.name] = {
				table: table,
				primaryKey: primaryKey,
				columns: this.getColumns(obj, primaryKey),
				foreignKeys: getForeignKeys(table)
			};
		}
	}
	
	
	private getColumns(obj: BackendTable, primaryKey: keyof BackendTable): ColumnInfo[] {
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
				case "number":
					columnData.type = this.dialect.typeNumber;
					columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
					break
				case "boolean":
					columnData.type = this.dialect.typeBoolean;
					columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
					break
				case "function":
					continue;
				default:
					console.log(`${obj.constructor.name}.${property} was skipped because its type is not supported (${typeof value})`);
					continue;
			}
			
			columns.push(columnData);
		}
		return columns;
	}
}