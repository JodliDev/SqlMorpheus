import DefaultSql from "./DefaultSql";
import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {ColumnInfo} from "../typings/ColumnInfo";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions";

export default class MySqlDialect extends DefaultSql {
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	public canInspectForeignKeys: boolean = true;
	public canInspectPrimaryKey: boolean = true;
	
	
	public types = {
		text: "TEXT",
		string: "VARCHAR",
		number: "INT",
		bigint: "BIGINT",
		boolean: "BOOLEAN",
		date: "DATE",
		time: "TIME",
		dateTime: "DATETIME",
		null: "NULL",
	};
	
	public getSqlType(dataType: DataTypeOptions, columnInfo?: ColumnInfo) {
		switch(dataType) {
			case "string":
				return this.types[dataType] + `(${columnInfo?.maxLength})`;
			default:
				return super.getSqlType(dataType, columnInfo);
		}
	}
	
	public changeForeignKeysState(enabled: boolean): string {
		return `SET FOREIGN_KEY_CHECKS ${enabled ? "1" : "0"};`;
	}
	public addForeignKey(fromTableName: string, foreignKey: string): string {
		return `ALTER TABLE ${fromTableName} ADD ${foreignKey};`;
	}
	public removeForeignKey(tableName: string, foreignKeyName: string): string {
		return `ALTER TABLE ${tableName} DROP FOREIGN KEY ${foreignKeyName};`;
	}
	
	public addPrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} PRIMARY KEY (${columnName});`;
	}
	public removePrimaryKey(tableName: string, _columnName: string): string {
		return `ALTER TABLE ${tableName} PRIMARY KEY;`;
	}
	
	public async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		const data = await this.db.runGetStatement(`SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME, REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = (SELECT DATABASE()) AND REFERENCED_TABLE_NAME = '${tableName}';`);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: tableName,
				fromColumn: entry["COLUMN_NAME"],
				toTable: entry["REFERENCED_TABLE_NAME"],
				toColumn: entry["REFERENCED_COLUMN_NAME"]
			}
		});
	}
	
	public async getTableNames(): Promise<string[]> {
		return (await this.db.runGetStatement("SELECT table_name FROM information_schema.tables;") as Record<string, string>[])
			.map(entry => entry.name);
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runGetStatement(`SHOW COLUMNS FROM ${tableName};`) as Record<string, string>[];
		const output: Record<string, ColumnInfo> = {};
		for(const entry of data) {
			output[entry["name"]] = {
				name: entry["name"],
				type: entry["type"],
				maxLength: 0,
				defaultValue: entry["dflt_value"],
				isPrimaryKey: entry["pk"] == "1",
			}
		}
		return output;
	}
}