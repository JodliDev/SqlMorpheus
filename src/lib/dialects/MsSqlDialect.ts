import DefaultSql from "./DefaultSql";
import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {ColumnInfo} from "../typings/ColumnInfo";

export default class MsSqlDialect extends DefaultSql {
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	public canInspectForeignKeys: boolean = true;
	public canInspectPrimaryKey: boolean = false;
	
	public async changeForeignKeysState(enabled: boolean): Promise<void> {
		if(enabled) {
			await this.db.runWriteStatement(`EXEC sp_MSforeachtable ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all`);
		}
		else {
			await this.db.runWriteStatement(`EXEC sp_MSforeachtable ALTER TABLE ? NOCHECK CONSTRAINT all`);
		}
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
	
	public async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		const data = await this.db.runReadStatement(`EXEC sp_fkeys @fktable_name = ${tableName};`);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: entry[tableName],
				fromColumn: entry["FKCOLUMN_NAME"],
				toTable: entry["PKTABLE_NAME"],
				toColumn: entry["PKCOLUMN_NAME"],
			}
		});
	}
	
	public async getTableNames(): Promise<string[]> {
		return (await this.db.runReadStatement("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'") as Record<string, string>[])
			.map(entry => entry.name);
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runReadStatement(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'${tableName};'`);
		const output: Record<string, ColumnInfo> = {};
		for(const entry of data as Record<string, string>[]) {
			output[entry["name"]] = {
				name: entry["name"],
				sqlType: entry["DATA_TYPE"],
				maxLength: 0,
				defaultValue: entry["COLUMN_DEFAULT"],
				isPrimaryKey: entry["pk"] == "1",
			}
		}
		return output;
	}
}