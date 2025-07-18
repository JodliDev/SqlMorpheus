import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {DatabaseAccess} from "../typings/DatabaseAccess";
import {ColumnInfo} from "../typings/ColumnInfo";

const MIGRATION_DATA_TABLE_NAME = "__sqlmorpheus_migrations";

export default abstract class DefaultSql {
	protected readonly db: DatabaseAccess;
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	public canInspectForeignKeys: boolean = false;
	public canInspectPrimaryKey: boolean = false;
	
	public typeString = "TEXT";
	public typeInt = "INTEGER";
	public typeBigInt = "BIGINT";
	public typeBoolean = "BOOLEAN";
	public typeNull = "NULL";
	
	constructor(db: DatabaseAccess) {
		this.db = db;
	}
	
	public formatValueToSql(value: any): string {
		return value.toString();
	}
	
	public changeForeignKeysState(enabled: boolean): string {
		return "";
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
	
	public columnDefinition(columnName: string, type: string, defaultValue: string, isPrimaryKey: boolean): string {
		const query = `${columnName} ${type} DEFAULT ${defaultValue}`;
		return isPrimaryKey ? `${query} PRIMARY KEY` : query;
	}
	public createColumn(columnTable: string, entry: string): string {
		return `ALTER TABLE ${columnTable} ADD ${entry};`
	}
	public renameColumn(tableName: string, oldColumnName: string, newColumnName: string): string {
		return `ALTER TABLE ${tableName} RENAME COLUMN ${oldColumnName} TO ${newColumnName};`
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
	
	protected migrationTableQuery(): string {
		return this.createTable(MIGRATION_DATA_TABLE_NAME, [
			this.columnDefinition("version", this.typeInt, "0", false)
		]);
	}
	
	
	public abstract getColumnInformation(tableName: string): Promise<ColumnInfo[]>;
	
	public async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		throw new Error("Inspecting foreign keys is not supported!");
	}
	
	protected async createMigrationTableIfNeeded(): Promise<void> {
		await this.db.runMultipleWriteStatements(this.migrationTableQuery());
	}
	
	public abstract getTableNames(): Promise<string[]>;
	
	//TODO: untested
	public async getVersion(): Promise<number> {
		await this.createMigrationTableIfNeeded();
		const query = this.select(MIGRATION_DATA_TABLE_NAME, ["version"]);
		const data = await this.db.runGetStatement(query) as {version: number}[];
		return data.length ? data[0].version : 0;
	}
	//TODO: untested
	public async setVersion(newVersion: number): Promise<void> {
		const query = `${this.migrationTableQuery()};
INSERT INTO ${MIGRATION_DATA_TABLE_NAME} (version) VALUES ${newVersion} WHERE NOT EXISTS (SELECT 1 FROM ${MIGRATION_DATA_TABLE_NAME})
UNION ALL
UPDATE ${MIGRATION_DATA_TABLE_NAME} SET version = ${newVersion} WHERE EXISTS (SELECT 1 FROM ${MIGRATION_DATA_TABLE_NAME});
`;
		await this.db.runMultipleWriteStatements(query);
		
	}
}