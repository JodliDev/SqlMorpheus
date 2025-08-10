import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {DatabaseAccess} from "../typings/DatabaseAccess";
import {ColumnInfo} from "../typings/ColumnInfo";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions";
import {TableStructure} from "../typings/TableStructure";

const MIGRATION_DATA_TABLE_NAME = "__sqlmorpheus_migrations";

/**
 * Provides syntax for SQL queries. Specified dialects extend from this class.
 * Needs a {@link DatabaseAccess} object for database operations
 */
export default abstract class DefaultSql {
	protected readonly db: DatabaseAccess;
	public canAlterForeignKeys: boolean = false;
	public canAlterPrimaryKey: boolean = false;
	public canInspectForeignKeys: boolean = false;
	public canInspectPrimaryKey: boolean = false;
	
	public types = {
		string: "TEXT",
		number: "INTEGER",
		bigint: "BIGINT",
		boolean: "BOOLEAN",
		date: "DATE",
		time: "TIME",
		dateTime: "DATETIME",
		null: "NULL",
	};
	
	constructor(db: DatabaseAccess) {
		this.db = db;
	}
	
	/**
	 * Formats a given value to a SQL-equivalent string based on the provided data type.
	 *
	 * @param value - The value to be formatted.
	 * @param type - The data type of the value. Either determined through typeof or {@link TableStructure} setting
	 * @return A string representation of the value formatted for SQL.
	 */
	public formatValueToSql(value: any, type: DataTypeOptions): string {
		function toDate(value: any): Date {
			return (value instanceof Date) ? value : new Date(value);
		}
		
		switch(type) {
			case "string":
				return `"${value}"`;
			case "time":
				return `"${toDate(value).toISOString().slice(11, 19)}"`;
			case "date":
				return `"${toDate(value).toISOString().slice(0, 10)}"`;
			case "dateTime":
				return `"${toDate(value).toISOString().slice(0, 19).replace("T", " ")}"`;
			default:
				return value.toString();
		}
	}
	
	public getSqlType(dataType: DataTypeOptions, _?: ColumnInfo) {
		return this.types[dataType];
	}
	
	/**
	 * Statement to enable / disable foreign keys in the database.
	 * Is dialect specific.
	 *
	 * @param enabled - A boolean indicating whether to enable or disable foreign key constraints.
	 * @return The SQL statement as a string.
	 */
	public changeForeignKeysState(enabled: boolean): string {
		return "";
	}
	
	/**
	 * Statement to add a foreign key to a specified table.
	 * Is only used if {@link canAlterForeignKeys} is true.
	 *
	 * @param fromTableName - The name of the table to which the foreign key will be added.
	 * @param foreignKey - The foreign key definition to be added, see {@link foreignKey()}.
	 * @return The SQL statement as a string.
	 */
	public addForeignKey(fromTableName: string, foreignKey: string): string {
		throw new Error("Adding foreign keys is not supported!");
	}
	
	/**
	 * Statement to remove a foreign key from a specified table.
	 * Is only used if {@link canAlterForeignKeys} is true.
	 *
	 * @param tableName - The name of the table to which the foreign key will be added.
	 * @param foreignKeyName - The name of the foreign key definition.
	 * @return The SQL statement as a string.
	 */
	public removeForeignKey(tableName: string, foreignKeyName: string): string {
		throw new Error("Foreign key removal is not supported!");
	}
	
	/**
	 * Statement to add a primary key to the specified table.
	 * Is only used if {@link canAlterPrimaryKey} is true.
	 *
	 * @param tableName - The name of the table to which the primary key will be added.
	 * @param columnName - The name of the column that will be set as the primary key.
	 * @return The SQL statement as a string.
	 */
	public addPrimaryKey(tableName: string, columnName: string): string {
		throw new Error("Adding foreign keys is not supported!");
	}
	
	/**
	 * Statement to remove a primary key from the specified table.
	 * Is only used if {@link canAlterPrimaryKey} is true.
	 *
	 * @param tableName - The name of the table to which the primary key will be added.
	 * @param columnName - The name of the column that will be set as the primary key.
	 * @return The SQL statement as a string.
	 */
	public removePrimaryKey(tableName: string, columnName: string): string {
		throw new Error("Foreign key removal is not supported!");
	}
	
	/**
	 * Constructs a SQL FOREIGN KEY constraint clause.
	 * Used in combination with {@link addForeignKey} or {@link createTable}
	 *
	 * @param column - The name of the column in the current table to apply the foreign key constraint.
	 * @param foreignTable - The name of the referenced table.
	 * @param foreignColumn - The name of the referenced column in the foreign table.
	 * @param onUpdate - Optional action to specify the behavior on update (e.g., CASCADE, SET NULL).
	 * @param onDelete - Optional action to specify the behavior on delete (e.g., CASCADE, SET NULL).
	 * @return The SQL string representing the foreign key constraint.
	 */
	public foreignKey(column: string, foreignTable: string, foreignColumn: string, onUpdate?: string, onDelete?: string): string {
		let query = `FOREIGN KEY (${column}) REFERENCES ${foreignTable} (${foreignColumn})`;
		
		if(onUpdate)
			query += ` ON UPDATE ${onUpdate}`
		if(onDelete)
			query += ` ON DELETE ${onDelete}`
		
		return query;
	}
	
	/**
	 * Statement to create a table if it does not already exist.
	 *
	 * @param tableName - The name of the table to be created.
	 * @param entries - An array containing the column definitions for the table.
	 * @return The SQL statement as a string.
	 */
	public createTable(tableName: string, entries: string[]): string {
		return `CREATE TABLE IF NOT EXISTS ${tableName}  (\n\t${entries.join(",\n\t")}\n);`;
	}
	
	/**
	 * Statement to rename a table.
	 *
	 * @param tableName - The name of the existing table to be renamed.
	 * @param newTableName - The new name for the table.
	 * @return The SQL statement as a string.
	 */
	public renameTable(tableName: string, newTableName: string): string {
		return `ALTER TABLE ${tableName} RENAME TO ${newTableName};`;
	}
	
	/**
	 * Statement to drop a table if it exists.
	 *
	 * @param tableName - The name of the table to be dropped.
	 * @return The SQL statement as a string.
	 */
	public dropTable(tableName: string): string {
		return `DROP TABLE IF EXISTS ${tableName};`
	}
	
	/**
	 * Constructs a SQL column definition based on the provided parameters.
	 *
	 * @param columnName - The name of the column.
	 * @param type - The data type of the column.
	 * @param defaultValue - The default value for the column.
	 * @param isPrimaryKey - Indicates whether the column is a primary key.
	 * @return The constructed SQL column definition string.
	 */
	public columnDefinition(columnName: string, type: string, isPrimaryKey: boolean, defaultValue?: string): string {
		const query = `${columnName} ${type}${defaultValue ? ` DEFAULT ${defaultValue}` : ""}`;
		return isPrimaryKey ? `${query} PRIMARY KEY` : query;
	}
	
	/**
	 * Statement to add a new column to a specified table.
	 *
	 * @param columnTable - The name of the table to which the column will be added.
	 * @param entry - The column definition including the column name and its data type. See {@link columnDefinition()}
	 * @return The SQL statement as a string.
	 */
	public createColumn(columnTable: string, entry: string): string {
		return `ALTER TABLE ${columnTable} ADD ${entry};`
	}
	
	/**
	 * Statement to rename a column in an existing table.
	 *
	 * @param tableName - The name of the table containing the column to rename.
	 * @param oldColumnName - The current name of the column to be renamed.
	 * @param newColumnName - The new name for the column.
	 * @return The SQL statement as a string.
	 */
	public renameColumn(tableName: string, oldColumnName: string, newColumnName: string): string {
		return `ALTER TABLE ${tableName} RENAME COLUMN ${oldColumnName} TO ${newColumnName};`
	}
	
	/**
	 * Statement to drop a column from a specified table.
	 *
	 * @param tableName - The name of the table from which the column will be dropped.
	 * @param columnName - The name of the column to be dropped.
	 * @return The SQL statement as a string.
	 */
	public dropColumn(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`
	}
	
	/**
	 * Statement to return data from a table.
	 *
	 * @param tableName - The name of the database table to select data from.
	 * @param select - An array of column names to include in the SELECT clause.
	 * @param where - An optional condition.
	 * @return The SQL statement as a string.
	 */
	public select(tableName: string, select: string[], where?: string): string {
		let query = `SELECT ${select.join(",")} FROM ${tableName}`
		
		if(where)
			query += ` WHERE ${where}`
		
		return `${query};`
	}
	
	/**
	 * Statement to insert data into a table.
	 *
	 * @param tableName - The name of the table where the data will be inserted.
	 * @param content - The value query. See {@link insertValues()}.
	 * @return The SQL statement as a string.
	 */
	public insert(tableName: string, content: string): string {
		return `INSERT INTO ${tableName} ${content};`;
	}
	
	/**
	 * A SQL insert query string. See {@link insert()}.
	 *
	 * @param keys - An array of column names to be used in the query.
	 * @param [valueString] - An optional preformatted value string to be included in the query.
	 * If not provided, the method generates a default placeholder string with "?" for each key.
	 * @return The SQL statement as a string.
	 */
	public insertValues(keys: string[], valueString?: string) {
		return `(${keys}) ${valueString ?? `VALUES (${keys.map(() => "?").join(",")})`}`;
	}
	
	/**
	 * Returns a SQL query string to create a migration table.
	 * The table is used to store migration data, specifically the version of the migration.
	 *
	 * @return The SQL query string for creating the migration table.
	 */
	protected migrationTableQuery(): string {
		return this.createTable(MIGRATION_DATA_TABLE_NAME, [
			this.columnDefinition("version", this.types.number, false, "0")
		]);
	}
	
	/**
	 * Retrieves information about the columns of a specified table.
	 *
	 * @param tableName The name of the table whose column information is to be retrieved.
	 * @return A promise that resolves to an array of {@link ColumnInfo} containing the details of the table's columns.
	 */
	public abstract getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>>;
	
	/**
	 * Fetches the foreign keys for the specified table.
	 * This method is only used if {@link canInspectForeignKeys} is true
	 *
	 * @param tableName - The name of the table for which to retrieve foreign key information.
	 * @return {Promise<ForeignKeyInfo[]>} A promise that resolves to an array of {@link ForeignKeyInfo}.
	 */
	public async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		throw new Error("Inspecting foreign keys is not supported!");
	}
	
	/**
	 * Ensures that the migration table exists in the database.
	 * If the table does not exist, it creates the table using the defined migration table query.
	 *
	 * @return A promise that resolves when the migration table is created successfully.
	 */
	protected async createMigrationTableIfNeeded(): Promise<void> {
		await this.db.runMultipleWriteStatements(this.migrationTableQuery());
	}
	
	/**
	 * Retrieves a list of table names from the database.
	 *
	 * @return A promise that resolves to an array of table names as strings.
	 */
	public abstract getTableNames(): Promise<string[]>;
	
	/**
	 * Retrieves the current version from the migration data table.
	 *
	 * @return A promise that resolves to the current version number. Returns 0 if no version is found.
	 */
	public async getVersion(): Promise<number> {
		//TODO: untested
		await this.createMigrationTableIfNeeded();
		const query = this.select(MIGRATION_DATA_TABLE_NAME, ["version"]);
		const data = await this.db.runGetStatement(query) as {version: number}[];
		return data.length ? data[0].version : 0;
	}
	
	/**
	 * Updates the migration version in the database. If the version entry does not exist, it inserts a new one;
	 * if it exists, it updates the version to the specified value.
	 *
	 * @param newVersion - The new migration version to set in the database.
	 * @return A promise that resolves when the operation is complete.
	 */
	public async setVersion(newVersion: number): Promise<void> {
		//TODO: untested
		const query = `${this.migrationTableQuery()};
INSERT INTO ${MIGRATION_DATA_TABLE_NAME} (version) VALUES ${newVersion} WHERE NOT EXISTS (SELECT 1 FROM ${MIGRATION_DATA_TABLE_NAME})
UNION ALL
UPDATE ${MIGRATION_DATA_TABLE_NAME} SET version = ${newVersion} WHERE EXISTS (SELECT 1 FROM ${MIGRATION_DATA_TABLE_NAME});
`;
		await this.db.runMultipleWriteStatements(query);
		
	}
}