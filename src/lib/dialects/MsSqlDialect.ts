import DefaultSql from "./DefaultSql";
import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {DatabaseAccess} from "../typings/DatabaseAccess";
import {ColumnInfo} from "../typings/ColumnInfo";

export default class MsSqlDialect extends DefaultSql {
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	public canInspectForeignKeys: boolean = true;
	public canInspectPrimaryKey: boolean = false;
	
	public changeForeignKeysState(enabled: boolean): string {
		return `EXEC sp_MSforeachtable "${enabled ? "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all" : "ALTER TABLE ? NOCHECK CONSTRAINT all"}"`;
	}
	public async getForeignKeys(tableName: string, db: DatabaseAccess): Promise<ForeignKeyInfo[]> {
		const data = await db.runGetStatement(`EXEC sp_fkeys @fktable_name = ${tableName};`);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: entry[tableName],
				fromColumn: entry["FKCOLUMN_NAME"],
				toTable: entry["PKTABLE_NAME"],
				toColumn: entry["PKCOLUMN_NAME"],
			}
		});
	}
	public addForeignKey(fromTableName: string, foreignKey: string): string {
		return `ALTER TABLE ${fromTableName} ADD ${foreignKey};`;
	}
	public removeForeignKey(tableName: string, foreignKeyName: string): string {
		return `ALTER TABLE ${tableName} DROP CONSTRAINT ${foreignKeyName};`;
	}
	
	public addPrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_primary PRIMARY KEY (${columnName});`;
	}
	public removePrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} DROP CONSTRAINT ${columnName}_primary;`;
	}
	
	public async getTableNames(db: DatabaseAccess): Promise<string[]> {
		return await db.runGetStatement("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'") as string[];
	}
	
	public async getColumnInformation(tableName: string, db: DatabaseAccess): Promise<ColumnInfo[]> {
		const data = await db.runGetStatement(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'${tableName};'`);
		
		return (data as Record<string, string>[]).map(entry => {
			return {
				name: entry["COLUMN_NAME"],
				type: entry["DATA_TYPE"],
				defaultValue: entry["COLUMN_DEFAULT"],
				isPrimaryKey: false,
			};
		});
	}
}