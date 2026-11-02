import DefaultSql from "./DefaultSql.ts";
import {ForeignKeyActions, ForeignKeyInfo} from "../typings/ForeignKeyInfo.ts";
import {ColumnInfo} from "../typings/ColumnInfo.ts";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions.ts";
import {SqlChanges} from "../typings/SqlChanges.ts";
import {IndexInfo} from "../typings/IndexInfo.ts";

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
	public canRecreateTable: boolean = true;
	public canAlterColumnStructure: boolean = false;
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	
	
	public formatIdentifier(identifier: string): string {
		return `"${identifier}"`;
	}
	public async runTransactionWithoutForeignKeys(query: string): Promise<void> {
		await this.db.runWriteStatement(`PRAGMA foreign_keys = OFF;`);
		await this.db.runWriteStatement(`PRAGMA defer_foreign_keys = ON;`);
		
		await this.db.runTransaction(query);
		
		await this.db.runWriteStatement(`PRAGMA foreign_keys = ON;`);
		await this.db.runWriteStatement(`PRAGMA foreign_key_check;`);
		await this.db.runWriteStatement(`PRAGMA defer_foreign_keys = OFF;`);
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
	
	public async getIndexes(tableName: string): Promise<IndexInfo[]> {
		//origin "c" means the index was created with CREATE INDEX (instead of automatically for a PRIMARY KEY or UNIQUE constraint)
		const data = await this.db.runReadStatement(`SELECT il.name AS index_name, il."unique" AS is_unique, ii.name AS column_name
			FROM pragma_index_list('${tableName}') AS il JOIN pragma_index_info(il.name) AS ii
			WHERE il.origin = 'c'
			ORDER BY il.name, ii.seqno;`
		);
		return this.rowsToIndexInfo(data as {index_name: string, is_unique: number, column_name: string}[]);
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