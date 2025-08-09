import DefaultSql from "./DefaultSql";
import {ForeignKeyActions, ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {ColumnInfo} from "../typings/ColumnInfo";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions";

/**
 * SQLite-specific syntax for SQL queries
 */
export default class SqliteDialect extends DefaultSql {
	public types = {
		string: "TEXT",
		number: "INTEGER",
		bigint: "INTEGER",
		boolean: "INTEGER",
		date: "INTEGER",
		time: "INTEGER",
		dateTime: "INTEGER",
		null: "NULL",
	};
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	public canInspectForeignKeys: boolean = true;
	public canInspectPrimaryKey: boolean = true;
	
	public changeForeignKeysState(enabled: boolean): string {
		return `PRAGMA foreign_keys = ${enabled ? "ON" : "OFF"};`;
	}
	
	public async getTableNames(): Promise<string[]> {
		return (await this.db.runGetStatement("SELECT name FROM sqlite_master WHERE type = 'table'") as Record<string, string>[])
			.map((obj) => obj.name);
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runGetStatement(`PRAGMA table_info(${tableName})`) as Record<string, string>[];
		const output: Record<string, ColumnInfo> = {};
		
		for(const entry of data) {
			output[entry["name"]] = {
				name: entry["name"],
				type: entry["type"],
				defaultValue: entry["dflt_value"],
				isPrimaryKey: entry["pk"] == "1",
			}
		}
		return output;
	}
	
	public formatValueToSql(value: any, type: DataTypeOptions): string {
		function toDate(value: any): Date {
			return (value instanceof Date) ? value : new Date(value);
		}
		switch(type) {
			case "boolean":
				return value ? "1" : "0";
			case "date":
			case "time":
			case "dateTime":
				return toDate(value).getTime().toString();
			default:
				return super.formatValueToSql(value, type);
		}
	}
	
	public async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		const data = await this.db.runGetStatement(`PRAGMA foreign_key_list(${tableName});`);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: tableName,
				fromColumn: entry["from"],
				toTable: entry["table"],
				toColumn: entry["to"],
				onUpdate: (entry["on_update"] ?? "NO ACTION") as ForeignKeyActions,
				onDelete: (entry["on_delete"] ?? "NO ACTION") as ForeignKeyActions,
			}
		});
	}
	
	public async getVersion(): Promise<number> {
		const output = await this.db.runGetStatement(`PRAGMA user_version;`) as [{user_version: number}];
		
		return output[0].user_version as number;
	}
	public async setVersion(newVersion: number): Promise<void> {
		await this.db.runMultipleWriteStatements(`PRAGMA user_version = ${newVersion};`)
	}
}