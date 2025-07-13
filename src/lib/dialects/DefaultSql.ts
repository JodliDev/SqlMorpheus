import {ForeignKeyInfo} from "../typings/ForeignKeyInfo.ts";
import {DatabaseAccess} from "../typings/DatabaseAccess.ts";
import {ColumnInfo} from "../typings/ColumnInfo.ts";

export default abstract class DefaultSql {
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	public canInspectForeignKeys: boolean = false;
	public canInspectPrimaryKey: boolean = false;
	
	public typeString = "TEXT";
	public typeNumber = "INTEGER";
	public typeBoolean = "BOOLEAN";
	public typeNull = "NULL";
	
	public formatValueToSql(value: string | number | boolean): string {
		return value.toString();
	}
	
	public changeForeignKeysState(enabled: boolean): string {
		return "";
	}
	public async getForeignKeys(tableName: string, db: DatabaseAccess): Promise<ForeignKeyInfo[]> {
		throw new Error("Inspecting foreign keys is not supported!");
	}
	
	public addForeignKey(fromTableName: string, foreignKey: string): string {
		throw new Error("Adding foreign keys is not supported!");
	}
	public removeForeignKey(tableName: string, foreignKeyName: string): string {
		throw new Error("Foreign key removal is not supported!");
	}
	public addPrimaryKey(tableName: string, columnName: string): string {
		throw new Error("Adding foreign keys is not supported!");
	}
	public removePrimaryKey(tableName: string, columnName: string): string {
		throw new Error("Foreign key removal is not supported!");
	}
	
	public foreignKey(column: string, foreignTable: string, foreignColumn: string, onUpdate?: string, onDelete?: string): string {
		let query = `FOREIGN KEY (${column}) REFERENCES ${foreignTable} (${foreignColumn})`;
		
		if(onUpdate)
			query += ` ON UPDATE ${onUpdate}`
		if(onDelete)
			query += ` ON DELETE ${onDelete}`
		
		return query;
	}
	
	
	public createTable(tableName: string, entries: string[]) {
		return `CREATE TABLE IF NOT EXISTS ${tableName}  (\n\t${entries.join(",\n\t")}\n);`;
	}
	public renameTable(tableName: string, newTableName: string) {
		return `ALTER TABLE ${tableName} RENAME TO ${newTableName};`;
	}
	public dropTable(tableName: string) {
		return `DROP TABLE IF EXISTS ${tableName};`
	}
	
	public abstract getColumnInformation(tableName: string, db: DatabaseAccess): Promise<ColumnInfo[]>;
	public abstract getTableNames(db: DatabaseAccess): Promise<string[]>;
	
	public columnDefinition(tableName: string, type: string, defaultValue: string, isPrimaryKey: boolean): string {
		const query = `${tableName} ${type} DEFAULT ${defaultValue}`;
		return isPrimaryKey ? `${query} PRIMARY KEY` : query;
	}
	public createColumn(columnTable: string, entry: string): string {
		return `ALTER TABLE ${columnTable} ADD ${entry};`
	}
	public renameColumn(tableName: string, oldColumnName: string, newColumnName: string): string {
		return `ALTER TABLE ${tableName} RENAME COLUMN ${newColumnName} TO ${oldColumnName};`
	}
	public copyColumn(tableName: string, oldColumnName: string, newColumnName: string): string {
		return `UPDATE ${tableName} SET ${newColumnName} = ${oldColumnName};`
	}
	public dropColumn(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`
	}
	
	public select(tableName: string, select: string[], where?: string): string {
		let query = `SELECT ${select.join(",")} FROM ${tableName}`
		
		if(where)
			query += ` WHERE ${where}`
		
		return `${query};`
	}
	public insert(tableName: string, content: string): string {
		return `INSERT INTO ${tableName} ${content};`;
	}
	public insertValues(keys: string[], valueString?: string) {
		return `(${keys}) ${valueString ?? `VALUES (${keys.map(() => "?").join(",")})`}`;
	}
}