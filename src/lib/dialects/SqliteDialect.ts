import DefaultSql from "./DefaultSql";
import {ForeignKeyActions, ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {ColumnInfo} from "../typings/ColumnInfo";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions";
import {SqlChanges} from "../typings/SqlChanges";

/**
 * SQLite-specific syntax for SQL queries
 */
export default class SqliteDialect extends DefaultSql {
	public types = {
		text: "TEXT",
		string: "TEXT",
		number: "INTEGER",
		bigint: "INTEGER",
		boolean: "INTEGER",
		date: "INTEGER",
		time: "INTEGER",
		dateTime: "INTEGER",
	};
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	
	public async changeForeignKeysState(enabled: boolean): Promise<void> {
		if(enabled) {
			await this.db.runWriteStatement(`PRAGMA foreign_keys = ON;`);
			await this.db.runWriteStatement(`PRAGMA foreign_key_check;`);
			await this.db.runWriteStatement(`PRAGMA defer_foreign_keys = OFF;`);
		}
		else {
			await this.db.runWriteStatement(`PRAGMA foreign_keys = OFF;`);
			await this.db.runWriteStatement(`PRAGMA defer_foreign_keys = ON;`);
		}
	}
	
	public async getTableNames(): Promise<string[]> {
		return (await this.db.runReadStatement("SELECT name FROM sqlite_master WHERE type = 'table'") as Record<string, string>[])
			.map((obj) => obj.name);
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runReadStatement(`PRAGMA table_info(${tableName})`) as Record<string, string>[];
		const output: Record<string, ColumnInfo> = {};
		
		for(const entry of data) {
			output[entry["name"]] = {
				name: entry["name"],
				sqlType: entry["type"],
				defaultValue: entry["dflt_value"] ?? this.nullType,
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
		const data = await this.db.runReadStatement(`PRAGMA foreign_key_list(${tableName});`);
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
	
	public async setChanges(fromVersion: number, toVersion: number, changes: SqlChanges): Promise<void> {
		await this.db.runTransaction(`PRAGMA user_version = ${toVersion};`);
		await super.setChanges(fromVersion, toVersion, changes);
	}
	
	public async getVersion(): Promise<number> {
		const output = await this.db.runReadStatement(`PRAGMA user_version;`) as [{user_version: number}];
		
		return output[0].user_version as number;
	}
	public async rollbackHistory(toVersion: number): Promise<void> {
		await this.db.runTransaction(`PRAGMA user_version = ${toVersion};`);
		await super.rollbackHistory(toVersion);
	}
}