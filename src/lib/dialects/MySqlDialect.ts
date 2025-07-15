import DefaultSql from "./DefaultSql";
import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {DatabaseAccess} from "../typings/DatabaseAccess";
import {ColumnInfo} from "../typings/ColumnInfo";

export default class MySqlDialect extends DefaultSql {
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	public canInspectForeignKeys: boolean = true;
	public canInspectPrimaryKey: boolean = true;
	
	public changeForeignKeysState(enabled: boolean): string {
		return `SET FOREIGN_KEY_CHECKS ${enabled ? "1" : "0"}\n;`;
	}
	public async getForeignKeys(tableName: string, db: DatabaseAccess): Promise<ForeignKeyInfo[]> {
		const data = await db.runGetStatement(`SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME, REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = (SELECT DATABASE()) AND REFERENCED_TABLE_NAME = '${tableName}';`);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: tableName,
				fromColumn: entry["COLUMN_NAME"],
				toTable: entry["REFERENCED_TABLE_NAME"],
				toColumn: entry["REFERENCED_COLUMN_NAME"]
			}
		});
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
	
	public async getTableNames(db: DatabaseAccess): Promise<string[]> {
		return await db.runGetStatement("SHOW TABLES;") as string[];
	}
	
	public async getColumnInformation(tableName: string, db: DatabaseAccess): Promise<ColumnInfo[]> {
		const data = await db.runGetStatement(`SHOW COLUMNS FROM ${tableName};`);
		
		return (data as Record<string, string>[]).map(entry => {
			return {
				name: entry["Field"],
				type: entry["Type"],
				defaultValue: entry["Default"],
				isPrimaryKey: entry["Key"] == "PRI",
			};
		});
	}
}