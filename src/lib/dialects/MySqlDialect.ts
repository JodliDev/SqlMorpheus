import DefaultSql from "./DefaultSql.ts";
import {ForeignKeyActions, ForeignKeyInfo} from "../typings/ForeignKeyInfo.ts";
import {ColumnInfo} from "../typings/ColumnInfo.ts";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions.ts";
import {IndexInfo} from "../typings/IndexInfo.ts";

export default class MySqlDialect extends DefaultSql {
	public canRecreateTable: boolean = true;
	public canAlterColumnStructure: boolean = true;
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	
	
	public types = {
		text: "TEXT",
		string: "VARCHAR",
		number: "INT",
		bigint: "BIGINT",
		boolean: "TINYINT(1)",
		date: "DATE",
		time: "TIME",
		dateTime: "DATETIME",
	};
	
	public formatValueToSql(value: any, type: DataTypeOptions): string {
		switch(type) {
			case "boolean":
				return value ? "1" : "0";
			default:
				return super.formatValueToSql(value, type);
		}
	}
	
	public getSqlType(dataType: DataTypeOptions, columnInfo?: ColumnInfo) {
		switch(dataType) {
			case "string":
				return this.types[dataType] + `(${columnInfo?.maxLength ?? 100})`;
			default:
				return super.getSqlType(dataType, columnInfo);
		}
	}
	public alterColumnStructure(tableName: string, columnName: string, sqlType: string, defaultValue?: string): string {
		const typeQuery = `ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${sqlType}`;
		return defaultValue ? `${typeQuery} DEFAULT ${defaultValue}` : `${typeQuery}; ALTER TABLE ${tableName} ALTER ${columnName} DROP DEFAULT;`;
		
	}
	public async runTransactionWithoutForeignKeys(query: string): Promise<void> {
		await this.db.runWriteStatement("SET FOREIGN_KEY_CHECKS = 0;");
		await this.db.runTransaction(query);
		await this.db.runWriteStatement("SET FOREIGN_KEY_CHECKS = 1;");
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
		const data = await this.db.runReadStatement(`SELECT
				info.TABLE_NAME, info.COLUMN_NAME, info.REFERENCED_TABLE_NAME, info.REFERENCED_COLUMN_NAME, constr.UPDATE_RULE, constr.DELETE_RULE
			FROM information_schema.KEY_COLUMN_USAGE AS info INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS AS constr ON info.CONSTRAINT_NAME = constr.CONSTRAINT_NAME
			WHERE info.REFERENCED_TABLE_SCHEMA = (SELECT DATABASE()) AND info.TABLE_NAME = '${tableName}';`
		);
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: tableName,
				fromColumn: entry["COLUMN_NAME"],
				toTable: entry["REFERENCED_TABLE_NAME"],
				toColumn: entry["REFERENCED_COLUMN_NAME"],
				onUpdate: entry["UPDATE_RULE"] as ForeignKeyActions,
				onDelete: entry["DELETE_RULE"] as ForeignKeyActions
			}
		});
	}
	
	public dropIndex(tableName: string, indexName: string): string {
		return `DROP INDEX ${this.formatIdentifier(indexName)} ON ${this.formatIdentifier(tableName)};`;
	}
	
	public async getIndexes(tableName: string): Promise<IndexInfo[]> {
		//MySQL automatically creates indexes for foreign keys (named after the constraint or the column), which we need to skip
		const data = await this.db.runReadStatement(`SELECT s.INDEX_NAME AS index_name, s.NON_UNIQUE = 0 AS is_unique, s.COLUMN_NAME AS column_name
			FROM information_schema.STATISTICS AS s
			WHERE s.TABLE_SCHEMA = (SELECT DATABASE()) AND s.TABLE_NAME = '${tableName}' AND s.INDEX_NAME <> 'PRIMARY'
				AND NOT EXISTS (
					SELECT 1 FROM information_schema.KEY_COLUMN_USAGE AS k
					WHERE k.TABLE_SCHEMA = s.TABLE_SCHEMA AND k.TABLE_NAME = s.TABLE_NAME AND k.REFERENCED_TABLE_NAME IS NOT NULL
						AND (k.CONSTRAINT_NAME = s.INDEX_NAME OR k.COLUMN_NAME = s.INDEX_NAME)
				)
			ORDER BY s.INDEX_NAME, s.SEQ_IN_INDEX;`
		);
		return this.rowsToIndexInfo(data as {index_name: string, is_unique: number, column_name: string}[]);
	}
	
	public async getTableNames(): Promise<string[]> {
		// const entries = await this.db.runGetStatement("SELECT table_name, table_schema  FROM information_schema.tables;") as Record<string, string>[]
		const entries = await this.db.runReadStatement("SHOW TABLES") as Record<string, string>[]
		return entries.map(entry => Object.values(entry)[0]);
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runReadStatement(`SHOW COLUMNS FROM ${tableName};`) as Record<string, string>[];
		const output: Record<string, ColumnInfo> = {};
		for(const entry of data) {
			const sqlType = entry["Type"].toUpperCase();
			
			const info: ColumnInfo = {
				name: entry["Field"],
				sqlType: sqlType,
				isPrimaryKey: entry["Key"] == "PRI",
			}
			switch(sqlType.substring(0, 4)) {
				case "TEXT":
				case "VARC":
				case "DATE":
				case "TIME":
					info.defaultValue = entry["Default"] ? `'${entry["Default"]}'` : this.nullType;
					break;
				default:
					info.defaultValue = entry["Default"] ?? this.nullType;
			}
			// const lengthMatch = entry["Type"].match(/^\w+\((\d+)\)/);
			// if(lengthMatch) {
			// 	info.maxLength = parseInt(lengthMatch[1]) ?? 0
			// }
			output[entry["Field"]] = info;
		}
		return output;
	}
}