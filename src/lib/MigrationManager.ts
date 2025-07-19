import DatabaseInstructions from "./typings/DatabaseInstructions";
import {ColumnInfo} from "./typings/ColumnInfo";
import TableStructureGenerator from "./TableStructureGenerator";
import {Migrations} from "./typings/Migrations";
import DefaultSql from "./dialects/DefaultSql";
import {SqlChanges} from "./typings/SqlChanges";
import {ForeignKeyInfo} from "./typings/ForeignKeyInfo";
import {Logger} from "./Logger";
import {TableStructure} from "./typings/TableStructure";

export type MigrationOutput = {
	fromVersion: number;
	toVersion: number;
	changes: SqlChanges
};

/**
 * The MigrationManager class is responsible for managing database schema migrations.
 * It handles tasks such as generating SQL for migrations, creating migration histories,
 * and synchronizing database schema changes between different versions.
 */
export class MigrationManager {
	private readonly migrations = new Migrations();
	private newTables: Record<string, TableStructure> = {};
	
	/**
	 * Table names that currently exist in the database
	 * Note: If tables are set to be renamed, then names in this array will be corrected to their future name.
	 */
	private existingTables: string[] = [];
	
	private readonly dialect: DefaultSql;
	
	constructor(dialect: DefaultSql) {
		this.dialect = dialect;
	}
	
	/**
	 * Generates the SQL changes required to migrate a database from its current version
	 * to the target version defined in the database instructions. Handles the creation
	 * and deletion of tables, migration of foreign keys and columns, renaming of columns,
	 * and recreating tables, along with executing any pre- and post-migration custom logic.
	 *
	 * @return A promise that resolves to an object containing the SQL
	 * changes for the migration (`up` and `down` changes) or null if no migration is required.
	 * Throws an error in scenarios such as attempting to migrate to a lower version
	 * or an invalid starting version.
	 */
	public async generateSqlChanges(dbInstructions: DatabaseInstructions): Promise<MigrationOutput | null> {
		const fromVersion = await this.dialect.getVersion();
		const toVersion = dbInstructions.version;
		
		if(toVersion <= 0)
			throw new Error("Cannot migrate to version 0 or lower");
		if(fromVersion == toVersion) {
			Logger.log("Version has not changed. No migrations needed.")
			return null;
		}
		if(fromVersion > toVersion)
			throw new Error(`You cannot create new migrations with a lower version (from ${fromVersion} to ${toVersion})`);
		
		//disable foreign keys to prevent errors:
		const foreignKeyOffQuery = this.dialect.changeForeignKeysState(false);
		const changes = {
			up: foreignKeyOffQuery,
			down: foreignKeyOffQuery
		} satisfies SqlChanges;
		this.migrations.reset(dbInstructions, fromVersion);
		
		//Run pre-migrations:
		const preSQL = dbInstructions.preMigration?.(
			this.migrations,
			fromVersion,
			toVersion,
		);
		if(preSQL) {
			changes.up += `\n\n-- Custom SQL from preMigration()\n${preSQL.up}`;
			changes.down += `\n\n-- Custom SQL from preMigration()\n${preSQL.down}`;
		}
		
		//generate new table structure:
		const tableStructureGenerator = new TableStructureGenerator(dbInstructions, this.dialect);
		this.newTables = tableStructureGenerator.generateTableStructure();
		
		//generate migrations:
		
		if(fromVersion == 0) {
			Logger.log(`Creating initial migration to version ${dbInstructions.version}`);
			
			const initialChanges = await this.createAndDropTables();
			changes.up += initialChanges.up;
			changes.down += initialChanges.down;
		}
		else {
			Logger.log(`Creating migration SQL from version ${fromVersion} to ${toVersion}`);
			
			this.existingTables = (await this.dialect.getTableNames()).map(oldTableName => this.migrations.getNewestTableName(oldTableName));
			
			[
				this.renameTables(),
				await this.createAndDropTables(),
				await this.migrateForeignKeys(),
				await this.migrateColumns(),
				this.renameColumns(),
				await this.recreateTables()
			].forEach(entry => {
				changes.up += entry.up;
				changes.down += entry.down;
			})
		}
		
		//Run post-migrations:
		const postSql = dbInstructions.postMigration?.(fromVersion, toVersion);
		if(postSql) {
			changes.up += `\n\n-- Custom SQL from postMigration()\n${postSql.up}`;
			changes.down += `\n\n-- Custom SQL from postMigration()\n${postSql.down}`;
		}
		
		//Enable foreign key constraints again:
		const foreignKeyOnQuery = this.dialect.changeForeignKeysState(true);
		changes.up += `\n\n${foreignKeyOnQuery}`;
		changes.down += `\n\n${foreignKeyOnQuery}`;
		
		const exception = this.migrations.verifyRenamingTasks(this.newTables) ?? this.migrations.verifyAllowedMigrations();
		
		if(exception) {
			Logger.debug(`\nCanceled changes:\n${changes.up}\n`);
			
			if(dbInstructions.throwIfNotAllowed)
				throw exception;
			else {
				console.error(exception.message);
				return null;
			}
		}
		
		return {
			fromVersion:fromVersion,
			toVersion:toVersion,
			changes: changes
		};
	}
	
	private renameTables() {
		const changes: SqlChanges = {
			up: "\n\n-- Rename tables\n",
			down: "\n\n-- Rename tables\n"
		}
		const data = this.migrations.getMigrationData();
		for(const tableName in data) {
			const migrationEntry = data[tableName];
			if(migrationEntry.tableRenaming) {
				Logger.log(`Table "${migrationEntry.tableRenaming.oldName}" will be renamed to "${tableName}"!`);
				changes.up += this.dialect.renameTable(migrationEntry.tableRenaming.oldName, tableName);
				changes.down += this.dialect.renameTable(tableName, migrationEntry.tableRenaming.oldName);
			}
		}
		return changes;
	}
	
	
	/**
	 * Generates SQL change statements for creating and dropping tables based on the current table structure
	 * and existing table configurations in the database. The `up` changes include SQL statements for creating
	 * new tables, while the `down` changes include SQL statements for dropping the corresponding tables or
	 * recreating them if necessary.
	 *
	 * @return {Promise<SqlChanges>} A promise that resolves to an object containing `up` and `down` SQL
	 * change statements for migrating the database schema.
	 */
	private async createAndDropTables(): Promise<SqlChanges> {
		let changes = {
			up: "\n\n-- Create and drop tables\n",
			down: "\n\n-- Create and drop tables\n"
		} satisfies SqlChanges;
		
		for(const tableName in this.newTables) {
			if(this.tableDoesNotExists(tableName)) {
				const structure = this.newTables[tableName];
				changes.up += `${this.createTableSql(tableName, structure.columns, structure.foreignKeys)}\n`;
				changes.down += `${this.dialect.dropTable(tableName)}\n`;
			}
		}
		
		for(const tableName of this.existingTables) {
			if(!this.newTables[tableName]) {
				this.migrations.compareWithAllowedMigration(tableName, "dropTable");
				if(!this.dialect.canInspectForeignKeys || !this.dialect.canInspectPrimaryKey)
					this.migrations.compareWithAllowedMigration(tableName, "continueWithoutRollback");
				
				const dbTableName = this.migrations.getOldTableName(tableName);
				
				changes.up += `${this.dialect.dropTable(tableName)}\n`;
				changes.down += this.dialect.canInspectForeignKeys && this.dialect.canInspectPrimaryKey
					? this.createTableSql(tableName, await this.dialect.getColumnInformation(dbTableName), await this.dialect.getForeignKeys(dbTableName))
					: "\n\n-- Cannot recreate foreign keys or load primary keys with this database! Table will not be recreated!\n";
			}
		}
		
		return changes;
	}
	
	/**
	 * Generates an SQL string to create a table with the specified schema.
	 *
	 * @param tableName - The name of the table to be created.
	 * @param columns - An array of objects defining the columns of the table, including their names, types
	 * default values, and whether they are primary keys.
	 * @param foreignKeys - An optional array of objects defining the foreign key constraints for the table,
	 * including the source column, target table, target column, action on update, and action on delete.
	 * @return The complete SQL string to create the table with the specified structure and constraints.
	 */
	private createTableSql(tableName: string, columns: ColumnInfo[], foreignKeys?: ForeignKeyInfo[]): string {
		
		//columns:
		const queryLines = [];
		for(const columnInfo of columns) {
			queryLines.push(this.dialect.columnDefinition(columnInfo.name, columnInfo.type, columnInfo.defaultValue, columnInfo.isPrimaryKey))
		}
		
		//foreign keys:
		if(foreignKeys) {
			for(const foreignKeyInfo of foreignKeys) {
				queryLines.push(this.dialect.foreignKey(foreignKeyInfo.fromColumn, foreignKeyInfo.toTable, foreignKeyInfo.toColumn.toString(), foreignKeyInfo.onUpdate, foreignKeyInfo.onDelete))
			}
		}
		return this.dialect.createTable(tableName, queryLines);
	}
	
	/**
	 * Checks if the specified table does not exist in the list of existing tables.
	 *
	 * @param tableName - The name of the table to check.
	 * @return Returns true if the table does not exist, otherwise false.
	 */
	private tableDoesNotExists(tableName: string): boolean {
		return this.existingTables.indexOf(tableName) == -1
	}
	
	/**
	 * Recreates database tables that have been flagged to be recreated in migration data.
	 * This method generated the necessary SQL code for backing up the current table data, dropping and recreating
	 * the tables, and reinserting the preserved data into the recreated tables.
	 */
	private async recreateTables(): Promise<SqlChanges> {
		const changes = {
			up: "\n\n-- Recreate tables\n",
			down: "\n\n-- Recreate tables\n"
		} satisfies SqlChanges;
		
		const migrationData = this.migrations.getMigrationData();
		for(const tableName in migrationData) {
			const migrationEntry = migrationData[tableName];
			
			if(!migrationEntry.recreate)
				continue;
			
			Logger.log(`Table ${tableName} will be recreated!`);
			this.migrations.compareWithAllowedMigration(tableName, "recreateTable");
			if(!this.dialect.canInspectForeignKeys || !this.dialect.canInspectPrimaryKey)
				this.migrations.compareWithAllowedMigration(tableName, "continueWithoutRollback");
				
			const oldColumnList = await this.dialect.getColumnInformation(this.migrations.getOldTableName(tableName));
			const newColumnList = this.newTables[tableName].columns;
			const moveableColumns = newColumnList
				.filter(entry => oldColumnList.find(oldEntry => oldEntry.name == entry.name) != undefined)
				.map(entry => entry.name);
			
			const backupTableName = `${tableName}__backup`;
			const insertQuery = this.dialect.insert(
				backupTableName,
				this.dialect.insertValues(moveableColumns, this.dialect.select(tableName, moveableColumns))
			);
			const moveDataQuery = insertQuery
				+ "\n"
				+ this.dialect.dropTable(tableName)
				+ "\n"
				+ this.dialect.renameTable(backupTableName, tableName);
			
			const structure = this.newTables[tableName];
			changes.up += this.createTableSql(backupTableName, structure.columns, structure.foreignKeys)
				+ "\n"
				+ moveDataQuery
				+ "\n"
			
			const dbTableName = this.migrations.getOldTableName(tableName);
			changes.down += this.dialect.canInspectForeignKeys && this.dialect.canInspectPrimaryKey
				? this.createTableSql(backupTableName, await this.dialect.getColumnInformation(dbTableName), await this.dialect.getForeignKeys(dbTableName))
				+ "\n"
				+ moveDataQuery
				: "\n\n-- Cannot recreate foreign keys or load primary keys with this database! Table will not be recreated!\n";
		}
		
		return changes;
	}
	
	/**
	 * Migrates foreign key constraints for all defined tables.
	 */
	private async migrateForeignKeys(): Promise<SqlChanges> {
		let changes = {
			up: "\n\n-- Foreign keys\n",
			down: "\n\n-- Foreign keys\n"
		} satisfies SqlChanges;
		
		for(const tableName in this.newTables) {
			if(this.migrations.willBeRecreated(tableName) || this.tableDoesNotExists(tableName))
				continue;
			const structure = this.newTables[tableName];
			const newForeignKeys = structure.foreignKeys ?? [];
			const oldForeignKeys = await this.dialect.getForeignKeys(this.migrations.getOldTableName(tableName));
			
			let checkForNewForeignKeys = true;
			
			for(const oldForeignKey of oldForeignKeys) {
				const newForeignKey = newForeignKeys.find(entry => entry.fromColumn == oldForeignKey.fromColumn);
				
				//Check for removed foreign key:
				if(!newForeignKey) {
					Logger.log(`Foreign key ${oldForeignKey.fromTable}.${oldForeignKey.fromColumn} to ${oldForeignKey.toTable}.${oldForeignKey.toColumn} will be removed!`);
					this.migrations.compareWithAllowedMigration(tableName, "removeForeignKey");
					if(this.dialect.canAlterForeignKeys) {
						changes.up += this.dialect.removeForeignKey(oldForeignKey.fromTable, oldForeignKey.fromColumn);
						changes.down += this.dialect.addForeignKey(
							oldForeignKey.fromTable,
							this.dialect.foreignKey(oldForeignKey.fromColumn, oldForeignKey.toTable, oldForeignKey.toColumn, oldForeignKey.onUpdate, oldForeignKey.onDelete)
						);
					}
					else {
						this.migrations.internalRecreate(structure.table);
						checkForNewForeignKeys = false;
					}
				}
				//Check for altered foreign key:
				else {
					if(!newForeignKey
						|| oldForeignKey.toColumn != newForeignKey.toColumn
						|| ((oldForeignKey.onUpdate ?? "NO ACTION") != (newForeignKey.onUpdate ?? "NO ACTION"))
						|| ((oldForeignKey.onDelete ?? "NO ACTION") != (newForeignKey.onDelete ?? "NO ACTION"))
					) {
						Logger.log(`Foreign key ${oldForeignKey.fromTable}.${oldForeignKey.fromColumn} to ${oldForeignKey.toTable}.${oldForeignKey.toColumn} will be changed!`);
						this.migrations.compareWithAllowedMigration(tableName, "alterForeignKey");
						if(this.dialect.canAlterForeignKeys) {
							changes.up += this.dialect.removeForeignKey(oldForeignKey.fromTable, oldForeignKey.fromColumn)
								+ this.dialect.addForeignKey(
									newForeignKey.fromTable,
									this.dialect.foreignKey(newForeignKey.fromColumn, newForeignKey.toTable, newForeignKey.toColumn, newForeignKey.onUpdate, newForeignKey.onDelete)
								)
							changes.down += this.dialect.addForeignKey(
								oldForeignKey.fromTable,
								this.dialect.foreignKey(oldForeignKey.fromColumn, oldForeignKey.toTable, oldForeignKey.toColumn, oldForeignKey.onUpdate, oldForeignKey.onDelete)
							) + this.dialect.removeForeignKey(newForeignKey.fromTable, newForeignKey.fromColumn);
							
						}
						else {
							this.migrations.internalRecreate(structure.table);
							checkForNewForeignKeys = false;
						}
					}
				}
			}
			
			//Check for new foreign keys:
			if(checkForNewForeignKeys) {
				for(const newForeignKey of newForeignKeys) {
					const oldForeignKey = oldForeignKeys.find(entry => entry.fromColumn == newForeignKey.fromColumn);
					
					if(oldForeignKey)
						continue;
					
					Logger.log(`Foreign key ${newForeignKey.fromTable}.${newForeignKey.fromColumn} to ${newForeignKey.toTable}.${newForeignKey.toColumn} will be added!`);
					if(this.dialect.canAlterForeignKeys) {
						changes.up += this.dialect.addForeignKey(
							newForeignKey.toTable,
							this.dialect.foreignKey(newForeignKey.fromColumn, newForeignKey.toTable, newForeignKey.toColumn, newForeignKey.onUpdate, newForeignKey.onDelete)
						);
						
						changes.down += this.dialect.removeForeignKey(newForeignKey.fromTable, newForeignKey.fromColumn);
					} else {
						this.migrations.internalRecreate(structure.table);
						break;
					}
				}
			}
		}
		
		return changes;
	}
	
	/**
	 * Checks all columns of all tables, creates them if they do not exist in the database and modifies them if needed.
	 * If types, default values or primary key change, the table is recreated
	 */
	private async migrateColumns(): Promise<SqlChanges> {
		const changes = {
			up: "\n\n-- Migrate columns\n",
			down: "\n\n-- Migrate columns\n"
		} satisfies SqlChanges;
		
		for(const tableName in this.newTables) {
			if(this.migrations.willBeRecreated(tableName) || this.tableDoesNotExists(tableName))
				continue;
			
			const newTableDefinition = this.newTables[tableName];
			
			const oldColumnList = await this.dialect.getColumnInformation(this.migrations.getOldTableName(tableName));
			
			const oldPrimaryKey = this.dialect.canInspectPrimaryKey ? this.getPrimaryKeyColumn(oldColumnList) : false;
			
			const newColumnList = newTableDefinition.columns;
			const newPrimaryKey = newTableDefinition.primaryKey;
			
			//Search for changed primary key:
			if(this.dialect.canInspectPrimaryKey && oldPrimaryKey != newPrimaryKey) {
				Logger.log(`Primary key in ${tableName} will be changed from ${oldPrimaryKey} to ${newPrimaryKey}!`);
				this.migrations.compareWithAllowedMigration(tableName, "alterPrimaryKey");
				if(this.dialect.canAlterPrimaryKey) {
					if(oldPrimaryKey) {
						changes.up += this.dialect.removePrimaryKey(tableName, oldPrimaryKey);
						changes.down += this.dialect.addPrimaryKey(tableName, oldPrimaryKey);
					}
					if(newPrimaryKey) {
						changes.up += this.dialect.addPrimaryKey(tableName, newPrimaryKey.toString());
						changes.down += this.dialect.removePrimaryKey(tableName, newPrimaryKey.toString());
					}
				}
				else
					this.migrations.internalRecreate(newTableDefinition.table);
				continue;
			}
			
			//Search for added or changed columns:
			for(const newColumn of newColumnList) {
				const oldColumn = oldColumnList.find(entry =>
					this.migrations.getNewestColumnName(tableName, entry.name) == newColumn.name
				);
				
				if(oldColumn == undefined) {
					changes.up += this.dialect.createColumn(tableName, this.dialect.columnDefinition(newColumn.name, newColumn.type, newColumn.defaultValue, newColumn.isPrimaryKey)) + "\n";
					changes.down += this.dialect.dropColumn(tableName, newColumn.name) + "\n";
				}
				else if(newColumn.type != oldColumn.type || newColumn.defaultValue != oldColumn.defaultValue) {
					this.migrations.internalRecreate(newTableDefinition.table);
				}
			}
			
			//Search for removed columns:
			for(const oldColumn of oldColumnList) {
				const newColumn = newColumnList.find(entry =>
					entry.name == this.migrations.getNewestColumnName(tableName, oldColumn.name)
				);
				if(newColumn == undefined) {
					this.migrations.compareWithAllowedMigration(tableName, "dropColumn");
					changes.up += this.dialect.dropColumn(tableName, oldColumn.name) + "\n";
					changes.down += this.dialect.createColumn(tableName, this.dialect.columnDefinition(oldColumn.name, oldColumn.type, oldColumn.defaultValue, oldColumn.isPrimaryKey)) + "\n";
				}
			}
		}
		
		return changes;
	}
	
	/**
	 * Retrieves the name of the primary key column from a list of column information.
	 *
	 * @param columnInfoList - An array of ColumnInfo objects containing details about each column.
	 * @return The name of the primary key column if found; otherwise, undefined.
	 */
	private getPrimaryKeyColumn(columnInfoList: ColumnInfo[]): string | undefined{
		for(const columnInfo of columnInfoList) {
			if(columnInfo.isPrimaryKey)
				return columnInfo.name
		}
	}
	
	/**
	 * Handles the renaming of columns in database tables by generating SQL changes for both applying and reverting the renames.
	 * Skips tables that are marked for recreation.
	 */
	private renameColumns(): SqlChanges {
		const changes = {
			up: "\n\n-- Rename columns\n",
			down: "\n\n-- Rename columns\n"
		} satisfies SqlChanges;
		
		const migrationData = this.migrations.getMigrationData();
		
		for(const tableName in migrationData) {
			if(migrationData[tableName].recreate)
				continue;
			
			this.migrations.loopRenamedColumns(tableName, (oldColumnName, newColumnName) => {
				Logger.log(`Column ${tableName}.${oldColumnName} will be renamed to ${tableName}.${newColumnName}!`);
				changes.up += this.dialect.renameColumn(tableName, oldColumnName, newColumnName);
				changes.down += this.dialect.renameColumn(tableName, newColumnName, oldColumnName);
			})
		}
		return changes;
	}
}
