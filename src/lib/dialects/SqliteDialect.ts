import DefaultSql from "./DefaultSql";
import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {DatabaseAccess} from "../typings/DatabaseAccess";
import {ColumnInfo} from "../typings/ColumnInfo";

export default class SqliteDialect extends DefaultSql {
	public typeBoolean = "INTEGER";
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	public canInspectForeignKeys: boolean = true;
	public canInspectPrimaryKey: boolean = true;
	
	public changeForeignKeysState(enabled: boolean): string {
		return `PRAGMA foreign_keys = ${enabled ? "ON" : "OFF"};`;
	}
	public async getForeignKeys(tableName: string, db: DatabaseAccess): Promise<ForeignKeyInfo[]> {
		const data = await db.runGetStatement(`PRAGMA foreign_key_list(${tableName});`);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: tableName,
				fromColumn: entry["from"],
				toTable: entry["table"],
				toColumn: entry["to"],
				on_update: entry["on_update"],
				on_delete: entry["on_delete"],
			}
		});
	}
	
	public async getTableNames(db: DatabaseAccess): Promise<string[]> {
		return (await db.runGetStatement("SELECT name FROM sqlite_master WHERE type = 'table'") as Record<string, string>[])
			.map((obj) => obj.name);
	}
	
	public async getColumnInformation(tableName: string, db: DatabaseAccess): Promise<ColumnInfo[]> {
		const data = await db.runGetStatement(`PRAGMA table_info(${tableName})`);
		
		return (data as Record<string, string>[]).map(entry => {
			return {
				name: entry["name"],
				type: entry["type"],
				defaultValue: entry["dflt_value"],
				isPrimaryKey: entry["pk"] == "1",
			};
		});
	}
	
	public formatValueToSql(value: string | number | boolean): string {
		switch(typeof value) {
			case "boolean":
				return value ? "1" : "0";
			default:
				return value.toString();
		}
	}
	
	public async getVersion(db: DatabaseAccess): Promise<number> {
		const output = await db.runGetStatement(`PRAGMA user_version;`) as [{user_version: number}];
		
		return output[0].user_version as number;
	}
	public async setVersion(db: DatabaseAccess, newVersion: number): Promise<void> {
		await db.runMultipleWriteStatements(`PRAGMA user_version = ${newVersion};`)
	}
}