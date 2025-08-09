import AllowedMigrations from "./typings/AllowedMigrations";
import MigrationInstructions from "./typings/MigrationInstructions";
import MigrationNotAllowedException from "./exceptions/NotAllowedException";
import DatabaseInstructions, {TableInput} from "./typings/DatabaseInstructions";
import {TableStructure} from "./typings/TableStructure";
import TableObj from "./tableInfo/TableObj";
import {Logger} from "./Logger";

export type NotAllowedChangeEntry = {version: number, tableName: string, type: keyof AllowedMigrations};

/**
 * The Migrations class is responsible for managing manual database schema migrations.
 */
export class Migrations {
	private fromVersion: number = 0;
	private toVersion: number = 0;
	private lastUsedVersion: number = 0;
	private migrationData: Record<string, MigrationInstructions> = {};
	private migrationDataForOldTableNames: Record<string, MigrationInstructions> = {};
	private alwaysAllowed: AllowedMigrations = {};
	private notAllowedChanges: NotAllowedChangeEntry[] = [];
	
	
	/**
	 * Resets the migration state to its initial values.
	 * Only used internally.
	 *
	 * @param dbInstructions - The instructions containing database metadata and migration details.
	 * @param fromVersion - The version of the actual database.
	 */
	public reset(dbInstructions: DatabaseInstructions, fromVersion: number): void {
		this.fromVersion = fromVersion;
		this.toVersion = dbInstructions.version;
		this.migrationData = {};
		this.migrationDataForOldTableNames = {};
		this.alwaysAllowed = dbInstructions.alwaysAllowedMigrations ?? {};
		this.notAllowedChanges = [];
	}
	
	/**
	 * Retrieves the migration instructions for the specified table.
	 * @see getEntryFromTableName
	 *
	 * @param table - The {@link TableInput} object from which the table name will be retrieved.
	 * @return The migration instructions corresponding to the given table input.
	 */
	private getEntry(table: TableInput): MigrationInstructions {
		const tableName = this.getTableName(table);
		return this.getEntryFromTableName(tableName);
	}
	
	/**
	 * Retrieves the migration instructions for the specified table.
	 *
	 * @param tableName - The name of the table for which the entry is to be retrieved or created.
	 * @return The migration instructions corresponding to the given table input.
	 */
	private getEntryFromTableName(tableName: string) {
		if(!this.migrationData.hasOwnProperty(tableName)) {
			this.migrationData[tableName] = {
				recreate: false,
				renamedColumns: [],
				allowedMigrations: {},
				usedMigrations: {}
			};
		}
		return this.migrationData[tableName];
	}
	
	/**
	 * Retrieves the table name from the given table input.
	 *
	 * @param table - The {@link TableInput} object.
	 * @return The name of the table derived from either {@link TableObj} or a class.
	 */
	private getTableName(table: TableInput): string {
		return TableObj.isDbTable(table) ? table.tableName : table.name;
	}
	
	
	/**
	 * Checks whether a provided version is relevant based on database version ({@link fromVersion}) and target version ({@link toVersion}).
	 * Also makes sure that version checks happen in order.
	 *
	 * @param version - The version to check for relevance.
	 * @return Returns true if the version is relevant, otherwise false.
	 * @throws Error if versions are not properly ordered
	 */
	private versionIsRelevant(version: number): boolean {
		if(version <= this.fromVersion || version > this.toVersion)
			return false;
		
		if(version < this.lastUsedVersion)
			throw new Error("Migrations in preMigration() have to be ordered by version (beginning with the lowest version).");
		this.lastUsedVersion = version;
		return true;
	}
	
	
	/**
	 * Verifies the renaming tasks specified in {@link DatabaseInstructions.preMigration} that were considered are valid.
	 * Called after all SQL queries have been generated.
	 * Only used internally.
	 *
	 * @param newTables - The table structures extracted from {@link DatabaseInstructions.tables}.
	 * @throws Error if a renaming task is invalid.
	 */
	public verifyRenamingTasks(newTables: Record<string, TableStructure>): Error | void {
		for(const tableName in this.migrationData) {
			const migrationEntry = this.migrationData[tableName];
			
			//Tables:
			if(migrationEntry.tableRenaming) {
				if(migrationEntry.tableRenaming.oldName == tableName)
					return new Error(`You set table "${tableName}" to be renamed to itself!`);
				if(migrationEntry.tableRenaming.newName != tableName)
					return new Error(`You set table "${tableName}" to be renamed to a different name than the one in your structure (${migrationEntry.tableRenaming.newName})!`);
				else if(!newTables[tableName])
					return new Error(`You set table "${migrationEntry.tableRenaming}" migrations for "${tableName}". But "${tableName}" does not exist in your structure.`);
			}
			
			//Columns:
			for(const renamingData of migrationEntry.renamedColumns) {
				const oldColumnName = renamingData.oldName;
				const newColumnName = renamingData.newName;
				
				if(oldColumnName == newColumnName)
					return new Error(`You set column ${tableName}.${oldColumnName} to be renamed to itself!`);
				else if(!newTables[tableName]?.columns[newColumnName])
					return new Error(`You set column ${tableName}.${oldColumnName} to be renamed to ${tableName}.${newColumnName}. But ${tableName}.${newColumnName} does not exist in your structure.`);
			}
		}
	}
	
	/**
	 * Making sure all considered calls to {@link allowMigration()} where necessary to prevent input mistakes.
	 * Called after all SQL queries have been generated.
	 * Only used internally.
	 *
	 * @throws Error if unnecessary calls were discovered. All discovered calls are collected and thrown as one Error.
	 */
	public verifyAllowedMigrations(): Error | void {
		if(this.notAllowedChanges.length)
			return new MigrationNotAllowedException(this.notAllowedChanges);
		
		let errorMsg = "";
		for(const tableName in this.migrationData) {
			const migration = this.migrationData[tableName];
			for(const type in migration.allowedMigrations) {
				if(!migration.usedMigrations[type])
					errorMsg += `Migration \"${type}\" for ${tableName} was allowed but not needed.\n`;
			}
		}
		
		if(errorMsg)
			return new Error(errorMsg);
	}
	
	/**
	 * Called by {@link MigrationManager} to check if a specific destructive query is allowed.
	 * Only used internally.
	 *
	 * @see allowMigration()
	 * @param tableName - The name of the table to check the migration against.
	 * @param type - The type of destructive migration being checked.
	 */
	public compareWithAllowedMigration(tableName: string, type: keyof AllowedMigrations): void {
		const migrationEntry = this.migrationData[tableName];
		
		if(!migrationEntry?.allowedMigrations[type]) {
			if(!this.alwaysAllowed[type])
				this.notAllowedChanges.push({version: this.toVersion, tableName: tableName, type: type});
		}
		else if(migrationEntry)
			migrationEntry.usedMigrations[type] = true;
	}
	
	/**
	 * Retrieves the migration data containing instructions for data migration.
	 * Only used internally.
	 *
	 * @return An object where each key corresponds to the table name,
	 * and the value is the associated migration instructions.
	 */
	public getMigrationData(): Record<string, MigrationInstructions> {
		return this.migrationData;
	}
	
	/**
	 * Iterates over renamed columns for the specified table and executes a callback for each pair of old and new column names.
	 * Only used internally.
	 *
	 * @param tableName - Name of the table whose renamed columns should be processed.
	 * @param callback - A function to execute for each renamed column, receiving the old and new column names as arguments.
	 */
	public loopRenamedColumns(tableName: string, callback: (oldColumnName: string, newColumnName: string) => void): void {
		const migrationEntry = this.migrationData[tableName];
		
		for(const renamingData of migrationEntry.renamedColumns) {
			callback(renamingData.oldName, renamingData.newName);
		}
	}
	
	/**
	 * Considers the renaming of a table and returns its (newest) name after the migration or
	 * the original name if no renaming is queued.
	 * Only used internally.
	 *
	 * @see getOldTableName()
	 * @param tableName - The current table name in the database.
	 * @return The newest table name if available, otherwise the current table name.
	 */
	public getNewestTableName(tableName: string): string {
		return this.migrationDataForOldTableNames[tableName]?.tableRenaming?.newName ?? tableName;
	}
	
	/**
	 * Retrieves the current table name in the database.
	 * Only used internally.
	 *
	 * @see getNewestTableName()
	 * @param tableName - The name of the newest table name.
	 * @return The current table name in the database.
	 */
	public getOldTableName(tableName: string): string {
		return this.migrationData[tableName]?.tableRenaming?.oldName ?? tableName;
	}
	
	/**
	 * Considers the renaming of a column in a table and returns its (newest) name after the migration or
	 * the original name if no renaming is queued.
	 * Only used internally.
	 *
	 * @param tableName - The name of the table containing the column.
	 * @param oldColumnName - The current name of the column in the database.
	 * @return The newest column name if available, otherwise the original column name.
	 */
	public getNewestColumnName(tableName: string, oldColumnName: string): string {
		const columnNames = this.migrationData[tableName]?.renamedColumns.find((columns) => columns.oldName == oldColumnName);
		return columnNames ? columnNames.newName : oldColumnName;
	}
	
	/**
	 * Determines if the specified table is marked to be recreated.
	 * Only used internally.
	 *
	 * @param tableName The name of the table to check.
	 * @return Returns true if the table will be recreated, false otherwise.
	 */
	public willBeRecreated(tableName: string): boolean {
		return this.migrationData[tableName]?.recreate;
	}
	
	/**
	 * Marks a table to be recreated and logs the recreation reason for the user.
	 * Only used internally.
	 *
	 * @param tableName - The name of the table to be marked for recreation.
	 * @param reason - The reason why the table is being marked for recreation.
	 */
	public internalRecreate(tableName: string, reason: string): void {
		const entry = this.getEntryFromTableName(tableName);
		entry.recreate = true;
		Logger.log(`Table ${tableName} will be recreated(${reason})!`);
	}
	
	
	
	/**
	 * SqlMorpheus only allows destructive statements if it was specifically allowed in {@link DatabaseInstructions.preMigration()}.
	 * Use this method to allow a destructive statement for a specific version.
	 * This method will be ignored if {@link version} is smaller than the current database version or higher than the target version of {@link DatabaseInstructions}.
	 *
	 * @param version - The target version for which the specific migration is allowed. Must be provided to make sure this method will only have an effect when specified.
	 * @param table - Either a {@link TableObj} or a class decorated with @TableClass.
	 * @param allowedMigrations - The keys representing the migrations to be allowed. Multiple migrations can be provided
	 */
	public allowMigration(version: number, table: TableInput, ... allowedMigrations: (keyof AllowedMigrations)[]): void {
		if(!this.versionIsRelevant(version))
			return;
		const entry = this.getEntry(table);
		
		for(const key of allowedMigrations) {
			entry.allowedMigrations[key] = true;
		}
	}
	
	/**
	 * When you change the name of a table, SqlMorpheus will assume the original table was meant to be dropped
	 * and the new table was meant to be added, which would lead to data loss.
	 * Use this method to mark a table to be renamed instead.
	 * This method will be ignored if {@link version} is smaller than the current database version or higher than the target version of {@link DatabaseInstructions}.
	 *
	 * @param version - The target version for which the table should be renamed. Must be provided to make sure this method will only have an effect when specified.
	 * @param oldTableName - The current name in the database at the time of the migration.
	 * @param newTableName - The new table name or its equivalent input format.
	 */
	public renameTable(version: number, oldTableName: string, newTableName: TableInput): void {
		if(!this.versionIsRelevant(version))
			return;
		const newTableNameString = this.getTableName(newTableName);
		
		//add data for renaming:
		const entry = this.getEntry(newTableName);
		this.migrationDataForOldTableNames[oldTableName] = entry;
		
		if(!entry.tableRenaming)
			entry.tableRenaming = {oldName: oldTableName, newName: newTableNameString};
		else //we only care about the oldest (=current) table name
			entry.tableRenaming.newName = newTableNameString;
	}
	
	/**
	 * When you change the name of a column, SqlMorpheus will assume the original column was meant to be removed
	 * and the new column was meant to be added, which would lead to data loss.
	 * Use this method to mark a column to be renamed instead.
	 * This method will be ignored if {@link version} is smaller than the current database version or higher than the target version of {@link DatabaseInstructions}.
	 *
	 * @param version - The target version for which the table should be renamed. Must be provided to make sure this method will only have an effect when specified.
	 * @param table Either a {@link TableObj} or a class decorated with @TableClass containing the column to be renamed.
	 * @param oldColumn The current name in the database at the time of the migration.
	 * @param newColumn The new name to assign to the column.
	 */
	public renameColumn(version: number, table: TableInput, oldColumn: string, newColumn: string): void {
		if(!this.versionIsRelevant(version))
			return;
		const entry = this.getEntry(table);
		const existingColumnEntry = entry.renamedColumns.find((entry) => entry.newName == oldColumn);
		
		if(existingColumnEntry)
			existingColumnEntry.newName = newColumn;
		else
			entry.renamedColumns.push({oldName: oldColumn, newName: newColumn});
	}
	
	/**
	 * Should not be needed most of the time.
	 * Marks a table to be recreated
	 * (a copy of the table will be created, all data will be moved over, the original table will be dropped and the new table will be renamed to the original name).
	 * This method will be ignored if {@link version} is smaller than the current database version or higher than the target version of {@link DatabaseInstructions}.
	 *
	 * @param version - The target version for which the table should be renamed. Must be provided to make sure this method will only have an effect when specified.
	 * @param table Either a {@link TableObj} or a class decorated with @TableClass.
	 */
	public recreateTable(version: number, table: TableInput): void {
		if(!this.versionIsRelevant(version))
			return;
		const entry = this.getEntry(table);
		entry.recreate = true;
		Logger.log(`Table ${this.getTableName(table)} will be recreated!`);
	}
}

export type PublicMigrations = Pick<Migrations, "recreateTable" | "renameTable" | "renameColumn" | "allowMigration">;