import DefaultSql from "./DefaultSql";
import {ColumnInfo} from "../typings/ColumnInfo";

export default class PostgresDialect extends DefaultSql {
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	public canInspectForeignKeys: boolean = false;
	public canInspectPrimaryKey: boolean = false;
	
	public changeForeignKeysState(enabled: boolean): string {
		return `SET session_replication_role = '${enabled ? "replica" : "origin"}';`;
	}
	public addForeignKey(fromTableName: string, foreignKey: string): string {
		return `ALTER TABLE ${fromTableName} ADD CONSTRAINT ${fromTableName} ${foreignKey};`;
	}
	public removeForeignKey(tableName: string, foreignKeyName: string): string {
		return `ALTER TABLE ${tableName} DROP CONSTRAINT ${foreignKeyName};`;
	}
	
	public async getTableNames(): Promise<string[]> {
		return await this.db.runReadStatement("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';") as string[];
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runReadStatement(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}';`);
		
		const output: Record<string, ColumnInfo> = {};
		for(const entry of data as Record<string, string>[]) {
			output[entry["name"]] = {
				name: entry["column_name"],
				sqlType: entry["data_type"],
				maxLength: 0,
				defaultValue: entry["column_default"],
				isPrimaryKey: false,
			}
		}
		return output;
	}
	
	public addPrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} ADD PRIMARY KEY (${columnName});\n`;
	}
	public removePrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} DROP CONSTRAINT ${columnName};\n`;
	}
}